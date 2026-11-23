import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ffPath, runFfmpeg } from "@/server/ffmpeg";
import { providers } from "@/server/providers/registry";
import { waitForVideo, type WordTimestamp } from "@/server/providers/types";
import type { Role } from "@/shared/roster";
import {
  ArtPlanSchema,
  ProducerPlanSchema,
  REEL,
  ScriptSchema,
  SocialSchema,
  type ArtPlan,
  type Brief,
  type ProducerPlan,
  type Script,
  type Social,
} from "@/shared/schemas";
import { generateValidated, sha256 } from "./llm";
import type { Recorder } from "./recorder";
import { getEmployeeSkill } from "./skills";
import { REROLL_CAPS, type JobState } from "./types";

export interface PipelineOptions {
  autoApproveGates?: boolean;
  enableCache?: boolean;
}

export interface PipelineResult {
  state: JobState;
  reelPath?: string;
  thumbnailPath?: string;
  durationSec?: number;
  keyframes?: string[];
  clips?: string[];
  waitingGate?: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW";
  error?: string;
}

/**
 * Robust State Machine Pipeline Runner:
 * BRIEFED -> SCRIPTING -> SCRIPT_REVIEW (human gate)
 * -> parallel [ART_PLANNING -> ILLUSTRATING -> KEYFRAME_REVIEW (human gate)] and [VOICING]
 * -> ANIMATING -> EDITING -> SOCIAL -> READY_TO_POST -> DONE
 *
 * Supports idempotent stage execution (input hash caching), retry with backoff,
 * human approval gates, reroll caps, and role-specific error handling.
 */
export async function runStateMachinePipeline(
  brief: Brief,
  jobDir: string,
  rec: Recorder,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const autoApprove = options.autoApproveGates ?? true;
  const enableCache = options.enableCache ?? true;

  await mkdir(jobDir, { recursive: true });
  const dirs = {
    kf: path.join(jobDir, "keyframes"),
    clips: path.join(jobDir, "clips"),
    voice: path.join(jobDir, "voice"),
    out: path.join(jobDir, "out"),
  };
  await Promise.all(Object.values(dirs).map((d) => mkdir(d, { recursive: true })));

  const rerollsUsed: Record<string, number> = {};

  async function executeStage<T>(
    stageName: string,
    employee: Role,
    input: unknown,
    action: () => Promise<T>,
  ): Promise<T> {
    const inputHash = sha256({ stageName, input });

    if (enableCache && rec.findCachedRun) {
      const cached = await rec.findCachedRun(stageName, inputHash);
      if (cached && cached.outputJson) {
        await rec.log("info", employee, `Stage ${stageName} retrieved from idempotent cache (${inputHash.slice(0, 8)})`);
        return JSON.parse(cached.outputJson) as T;
      }
    }

    const runId = await rec.stageStart(stageName, employee, inputHash);
    const maxRerolls = REROLL_CAPS[employee] ?? 3;
    rerollsUsed[employee] = (rerollsUsed[employee] ?? 0) + 1;

    if (rerollsUsed[employee] > maxRerolls) {
      const err = `Reroll cap exceeded for employee ${employee} (max: ${maxRerolls})`;
      await rec.stageEnd(runId, "error", undefined, err);
      await rec.setState("ERROR", err);
      throw new Error(err);
    }

    try {
      const out = await action();
      await rec.stageEnd(runId, "done", out);
      return out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await rec.stageEnd(runId, "error", undefined, msg);
      await rec.setState("ERROR", `${stageName}: ${msg}`);
      throw e;
    }
  }

  const text = providers.text();

  // 1. BRIEFED -> Producer
  await rec.setState("BRIEFED");
  const producerSkill = await getEmployeeSkill("producer");
  const plan = await executeStage<ProducerPlan>("BRIEFED", "producer", brief, async () => {
    const res = await generateValidated(
      text,
      {
        role: "producer",
        system: producerSkill.prompt,
        user: `Brief topic: ${brief.topic}\nAudience: ${brief.audience}\nPlatforms: ${brief.platforms.join(", ")}\nTone: ${brief.tone}`,
        params: producerSkill.params,
      },
      ProducerPlanSchema,
      { maxAttempts: 3, initialDelayMs: 200 },
    );
    return res.value;
  });

  // 2. SCRIPTING -> Scriptwriter
  await rec.setState("SCRIPTING");
  const scriptSkill = await getEmployeeSkill("scriptwriter");
  const script = await executeStage<Script>("SCRIPTING", "scriptwriter", plan, async () => {
    const res = await generateValidated(
      text,
      {
        role: "scriptwriter",
        system: scriptSkill.prompt,
        user: JSON.stringify(plan),
        params: scriptSkill.params,
      },
      ScriptSchema,
      { maxAttempts: 3, initialDelayMs: 200 },
    );
    return res.value;
  });
  await writeFile(path.join(jobDir, "script.json"), JSON.stringify(script, null, 2));

  // 3. SCRIPT_REVIEW Gate
  await rec.setState("SCRIPT_REVIEW");
  let scriptDecision = rec.getGateDecision ? await rec.getGateDecision("SCRIPT_REVIEW") : null;
  if (!scriptDecision && autoApprove) {
    scriptDecision = { decision: "approved", comment: "Auto-approved script" };
  }

  if (!scriptDecision || scriptDecision.decision === "waiting") {
    await rec.log("info", "scriptwriter", "Pipeline paused at SCRIPT_REVIEW human gate");
    return { state: "SCRIPT_REVIEW", waitingGate: "SCRIPT_REVIEW" };
  }

  if (scriptDecision.decision === "rejected") {
    const reason = `Script rejected at gate: ${scriptDecision.comment ?? "No feedback given"}`;
    await rec.log("warn", "scriptwriter", reason);
    await rec.setState("ERROR", reason);
    return { state: "ERROR", error: reason };
  }

  await rec.log("info", null, `Gate SCRIPT_REVIEW passed: ${scriptDecision.comment ?? "Approved"}`);

  // 4. PARALLEL BRANCHES:
  // Branch A: ART_PLANNING -> ILLUSTRATING -> KEYFRAME_REVIEW (human gate)
  // Branch B: VOICING

  const artBranchPromise = (async () => {
    await rec.setState("ART_PLANNING");
    const artSkill = await getEmployeeSkill("artDirector");
    const art = await executeStage<ArtPlan>("ART_PLANNING", "artDirector", script, async () => {
      const res = await generateValidated(
        text,
        {
          role: "artDirector",
          system: artSkill.prompt,
          user: JSON.stringify(script),
          params: artSkill.params,
        },
        ArtPlanSchema,
        { maxAttempts: 3, initialDelayMs: 200 },
      );
      if (res.value.edits.length !== script.beats.length) {
        throw new Error(`Art plan has ${res.value.edits.length} edits for ${script.beats.length} beats`);
      }
      return res.value;
    });

    await rec.setState("ILLUSTRATING");
    const image = providers.image();
    const keyframes = await executeStage<string[]>("ILLUSTRATING", "illustrator", art, async () => {
      const size = { width: REEL.width, height: REEL.height };
      const k0 = path.join(dirs.kf, "k00.png");
      const first = await image.textToImage({ prompt: `${art.style}. ${art.k0Prompt}`, size, outPath: k0 });
      await rec.artifact("keyframe", k0, "image/png", { index: 0 });
      const kfs = [first.path];

      for (const [i, edit] of art.edits.entries()) {
        const kp = path.join(dirs.kf, `k${String(i + 1).padStart(2, "0")}.png`);
        const r = await image.editImage({ inputPath: kfs[i], instruction: edit.instruction, outPath: kp });
        if (r.size.width !== size.width || r.size.height !== size.height) {
          throw new Error(`Keyframe ${i + 1} size mismatch: got ${r.size.width}x${r.size.height}`);
        }
        await rec.artifact("keyframe", kp, "image/png", { index: i + 1, addObject: edit.addObject });
        kfs.push(r.path);
      }
      return kfs;
    });

    // Gate 2: KEYFRAME_REVIEW
    await rec.setState("KEYFRAME_REVIEW");
    let kfDecision = rec.getGateDecision ? await rec.getGateDecision("KEYFRAME_REVIEW") : null;
    if (!kfDecision && autoApprove) {
      kfDecision = { decision: "approved", comment: "Auto-approved keyframes" };
    }

    if (!kfDecision || kfDecision.decision === "waiting") {
      await rec.log("info", "illustrator", "Pipeline paused at KEYFRAME_REVIEW human gate");
      return { paused: true, waitingGate: "KEYFRAME_REVIEW" as const, art, keyframes };
    }

    if (kfDecision.decision === "rejected") {
      const reason = `Keyframes rejected at gate: ${kfDecision.comment ?? "No comment"}`;
      await rec.log("warn", "illustrator", reason);
      throw new Error(reason);
    }

    await rec.log("info", null, `Gate KEYFRAME_REVIEW passed: ${kfDecision.comment ?? "Approved"}`);
    return { paused: false, art, keyframes };
  })();

  const voiceBranchPromise = (async () => {
    await rec.setState("VOICING");
    const tts = providers.tts();
    return await executeStage("VOICING", "voiceActor", script.beats.map((b) => b.narration), async () => {
      const takes: { path: string; durationSec: number; words: WordTimestamp[] }[] = [];
      for (const b of script.beats) {
        const p = path.join(dirs.voice, `beat${b.index}.wav`);
        const r = await tts.synthesize({ text: b.narration, outPath: p });
        if (r.durationSec > b.seconds) {
          await rec.log("warn", "voiceActor", `Beat ${b.index} voice ${r.durationSec}s exceeds beat ${b.seconds}s; will be trimmed`);
        }
        await rec.artifact("voice", p, "audio/wav", { beat: b.index, durationSec: r.durationSec, words: r.words });
        takes.push({ path: r.path, durationSec: r.durationSec, words: r.words });
      }
      return takes;
    });
  })();

  const [artResult, voiceTakes] = await Promise.all([artBranchPromise, voiceBranchPromise]);

  if ("paused" in artResult && artResult.paused) {
    return { state: "KEYFRAME_REVIEW", waitingGate: "KEYFRAME_REVIEW", keyframes: artResult.keyframes };
  }

  const { art, keyframes } = artResult;

  // 5. ANIMATING -> Animator
  await rec.setState("ANIMATING");
  const video = providers.video();
  const clips = await executeStage<string[]>("ANIMATING", "animator", keyframes, async () => {
    const generatedClips: string[] = [];
    for (const b of script.beats) {
      const cp = path.join(dirs.clips, `beat${b.index}.mp4`);
      const id = await video.submit({
        prompt: `${art.style}. ${b.so_you_add} appears.`,
        firstFramePath: keyframes[b.index],
        lastFramePath: keyframes[b.index + 1],
        seconds: b.seconds,
        outPath: cp,
      });
      const done = await waitForVideo(video, id, { intervalMs: 50 });
      await rec.artifact("clip", done.path, "video/mp4", { beat: b.index, seconds: b.seconds });
      generatedClips.push(done.path);
    }
    return generatedClips;
  });

  // 6. EDITING -> Editor
  await rec.setState("EDITING");
  const durationSec = script.beats.reduce((a, b) => a + b.seconds, 0);
  const reelPath = path.join(dirs.out, "reel.mp4");
  const thumbnailPath = path.join(dirs.out, "thumbnail.png");

  await executeStage("EDITING", "editor", { clips, voice: voiceTakes.map((v) => v.path) }, async () => {
    const listFile = path.join(dirs.clips, "concat.txt");
    await writeFile(listFile, clips.map((c) => `file '${ffPath(c)}'`).join("\n"));
    const audioIn = voiceTakes.flatMap((v) => ["-i", v.path]);
    const pads = script.beats
      .map((b, i) => `[${i + 1}:a]aresample=48000,apad=whole_dur=${b.seconds},atrim=0:${b.seconds}[a${i}]`)
      .join(";");
    const concatA = script.beats.map((_, i) => `[a${i}]`).join("") + `concat=n=${script.beats.length}:v=0:a=1[voice]`;

    await runFfmpeg([
      "-f", "concat", "-safe", "0", "-i", listFile,
      ...audioIn,
      "-filter_complex",
      `[0:v]scale=${REEL.width}:${REEL.height}:flags=neighbor,fps=${REEL.fps},format=yuv420p[v];${pads};${concatA};[voice]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart", "-t", String(durationSec),
      reelPath,
    ]);
    await runFfmpeg(["-i", keyframes.at(-1)!, "-vf", "scale=540:960", "-frames:v", "1", thumbnailPath]);
    await rec.artifact("reel", reelPath, "video/mp4", { durationSec, width: REEL.width, height: REEL.height, fps: REEL.fps });
    await rec.artifact("thumbnail", thumbnailPath, "image/png");
    return { reelPath, thumbnailPath, durationSec };
  });

  // 7. SOCIAL -> Social Manager
  await rec.setState("SOCIAL");
  const socialSkill = await getEmployeeSkill("socialManager");
  const social = await executeStage<Social>("SOCIAL", "socialManager", { script: script.title, platforms: brief.platforms }, async () => {
    const res = await generateValidated(
      text,
      {
        role: "socialManager",
        system: socialSkill.prompt,
        user: JSON.stringify({ title: script.title, platforms: brief.platforms }),
        params: socialSkill.params,
      },
      SocialSchema,
      { maxAttempts: 3, initialDelayMs: 200 },
    );
    // Spec requirement 8: Block DONE if disclosure is missing
    for (const post of res.value.posts) {
      if (!post.aiDisclosure || post.aiDisclosure.trim().length === 0) {
        throw new Error(`Social Manager generated post for ${post.platform} without AI disclosure`);
      }
    }
    return res.value;
  });

  await writeFile(path.join(dirs.out, "social.json"), JSON.stringify(social, null, 2));
  await rec.artifact("social", path.join(dirs.out, "social.json"), "application/json");

  // 8. READY_TO_POST -> DONE
  await rec.setState("READY_TO_POST");
  await rec.setState("DONE");

  return {
    state: "DONE",
    reelPath,
    thumbnailPath,
    durationSec,
    keyframes,
    clips,
  };
}
