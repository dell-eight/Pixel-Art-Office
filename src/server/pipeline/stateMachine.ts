import { access, mkdir, writeFile } from "node:fs/promises";
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
import { getEmployeeSkill, type LoadedSkill } from "./skills";
import { REROLL_CAPS, type JobState } from "./types";

export interface PipelineOptions {
  autoApproveGates?: boolean;
  enableCache?: boolean;
  /** When true, only reuse cached stage runs belonging to the same job (e.g. when resuming after a gate). */
  sameJobCacheOnly?: boolean;
  /** Artificial minimum duration per stage (ms) so UI animations are observable in mock mode. */
  stageDelayMs?: number;
  /** Optional skill loader override (for unit tests). */
  loadSkill?: (role: Role) => Promise<LoadedSkill>;
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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Robust State Machine Pipeline Runner:
 * BRIEFED -> SCRIPTING -> SCRIPT_REVIEW (human gate)
 * -> parallel [ART_PLANNING -> ILLUSTRATING] and [VOICING] -> KEYFRAME_REVIEW (human gate)
 * -> ANIMATING -> EDITING -> SOCIAL -> READY_TO_POST -> DONE
 *
 * Supports idempotent stage execution (input hash caching), retry with backoff,
 * human approval gates (Approve / Request changes / Reject + single-frame reroll),
 * versioned employee skills, reroll caps, courier handoffs, and visible stage timing in mock mode.
 */
export async function runStateMachinePipeline(
  brief: Brief,
  jobDir: string,
  rec: Recorder,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const autoApprove = options.autoApproveGates ?? false;
  const enableCache = options.enableCache ?? true;
  const sameJobCacheOnly = options.sameJobCacheOnly ?? true;
  const stageDelayMs = Math.max(0, options.stageDelayMs ?? 0);
  const loadSkill = options.loadSkill ?? getEmployeeSkill;

  await mkdir(jobDir, { recursive: true });
  const dirs = {
    kf: path.join(jobDir, "keyframes"),
    clips: path.join(jobDir, "clips"),
    voice: path.join(jobDir, "voice"),
    out: path.join(jobDir, "out"),
  };
  await Promise.all(Object.values(dirs).map((d) => mkdir(d, { recursive: true })));

  const rerollsUsed: Record<string, number> = {};

  async function runWithVisibleDuration<T>(
    stageName: string,
    employee: Role,
    action: () => Promise<T>,
  ): Promise<T> {
    if (stageDelayMs <= 0) {
      return action();
    }
    const tStart = Date.now();
    const checkpoints = [25, 50, 75];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const pct of checkpoints) {
      const at = Math.round((stageDelayMs * pct) / 100);
      timers.push(
        setTimeout(() => {
          void rec.stageProgress?.(stageName, employee, pct, `${stageName} (${pct}%)`);
        }, at),
      );
    }
    try {
      const result = await action();
      const elapsed = Date.now() - tStart;
      if (elapsed < stageDelayMs) {
        await sleep(stageDelayMs - elapsed);
      }
      return result;
    } finally {
      for (const t of timers) clearTimeout(t);
    }
  }

  async function executeStage<T>(
    stageName: string,
    employee: Role,
    input: unknown,
    action: () => Promise<T>,
    opts: { setState?: boolean } = {},
  ): Promise<{ value: T; cached: boolean; inputHash: string }> {
    const inputHash = sha256({ stageName, input });

    if (enableCache && rec.findCachedRun) {
      const cached = await rec.findCachedRun(stageName, inputHash, { sameJobOnly: sameJobCacheOnly });
      if (cached && cached.outputJson) {
        await rec.log("info", employee, `Stage ${stageName} retrieved from idempotent cache (${inputHash.slice(0, 8)})`);
        return { value: JSON.parse(cached.outputJson) as T, cached: true, inputHash };
      }
    }

    if (opts.setState !== false) {
      await rec.setState(stageName);
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
      const out = await runWithVisibleDuration(stageName, employee, action);
      await rec.stageEnd(runId, "done", out);
      return { value: out, cached: false, inputHash };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await rec.stageEnd(runId, "error", undefined, msg);
      await rec.setState("ERROR", `${stageName}: ${msg}`);
      throw e;
    }
  }

  async function handoff(fromDesk: string, toDesk: string, message: string) {
    await rec.handoff?.(fromDesk, toDesk, message);
    if (stageDelayMs > 0) {
      await sleep(Math.min(900, Math.max(250, Math.round(stageDelayMs * 0.25))));
    }
  }

  const text = providers.text();

  // 1. BRIEFED -> Producer
  const producerSkill = await loadSkill("producer");
  const planRes = await executeStage<ProducerPlan>(
    "BRIEFED",
    "producer",
    { brief, skillVersion: producerSkill.version },
    async () => {
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
    },
  );
  const plan = planRes.value;
  if (!planRes.cached) {
    await handoff("producer", "scriptwriter", "Brief ready → Scriptwriter");
  }

  // 2. SCRIPTING -> Scriptwriter (incorporating Gate 1 revision note if request_changes was submitted)
  const scriptSkill = await loadSkill("scriptwriter");
  const scriptRev = await rec.getLatestRevision?.("SCRIPT_REVIEW");
  const scriptInput = {
    plan,
    skillVersion: scriptSkill.version,
    revisionId: scriptRev?.id ?? null,
    revisionNote: scriptRev?.comment ?? null,
  };
  const scriptRes = await executeStage<Script>("SCRIPTING", "scriptwriter", scriptInput, async () => {
    const userPrompt = scriptRev?.comment
      ? `${JSON.stringify(plan)}\n\nHuman reviewer requested changes:\n${scriptRev.comment}`
      : JSON.stringify(plan);
    const res = await generateValidated(
      text,
      {
        role: "scriptwriter",
        system: scriptSkill.prompt,
        user: userPrompt,
        params: scriptSkill.params,
      },
      ScriptSchema,
      { maxAttempts: 3, initialDelayMs: 200 },
    );
    return res.value;
  });
  const script = scriptRes.value;
  await writeFile(path.join(jobDir, "script.json"), JSON.stringify(script, null, 2));
  if (!scriptRes.cached) {
    await handoff("scriptwriter", "SCRIPT_REVIEW", "Script ready → Gate 1 (Script Review)");
  }

  // 3. SCRIPT_REVIEW Gate
  let scriptDecision = rec.getGateDecision ? await rec.getGateDecision("SCRIPT_REVIEW") : null;
  if (!scriptDecision && autoApprove) {
    scriptDecision = { decision: "approved", comment: "Auto-approved script" };
  }

  if (scriptDecision?.decision === "rejected") {
    const reason = `Script rejected at gate: ${scriptDecision.comment ?? "No feedback given"}`;
    await rec.log("warn", "scriptwriter", reason);
    await rec.setState("REJECTED", reason);
    return { state: "REJECTED", error: reason };
  }

  if (!scriptDecision || scriptDecision.decision === "waiting" || scriptDecision.decision === "request_changes") {
    await rec.setState("SCRIPT_REVIEW");
    await rec.gateWaiting?.(
      "SCRIPT_REVIEW",
      scriptDecision?.decision === "request_changes"
        ? "Revised script ready for Gate 1 review"
        : "Waiting for human approval at SCRIPT_REVIEW",
    );
    await rec.log("info", "scriptwriter", "Pipeline paused at SCRIPT_REVIEW human gate");
    return { state: "SCRIPT_REVIEW", waitingGate: "SCRIPT_REVIEW" };
  }

  await rec.log("info", null, `Gate SCRIPT_REVIEW passed: ${scriptDecision.comment ?? "Approved"}`);

  // Gate 2 revision check (whole set vs single-frame)
  const kfRev = await rec.getLatestRevision?.("KEYFRAME_REVIEW");
  const artSkill = await loadSkill("artDirector");
  const illSkill = await loadSkill("illustrator");
  const voiceSkill = await loadSkill("voiceActor");

  const isWholeSetKfRev = kfRev && kfRev.frameIndex === undefined;
  const artInput = {
    script,
    skillVersion: artSkill.version,
    revisionId: isWholeSetKfRev ? kfRev.id : null,
    revisionNote: isWholeSetKfRev ? kfRev.comment : null,
  };

  const artAlreadyCached =
    enableCache && rec.findCachedRun
      ? Boolean(await rec.findCachedRun("ART_PLANNING", sha256({ stageName: "ART_PLANNING", input: artInput }), { sameJobOnly: sameJobCacheOnly }))
      : false;
  if (!artAlreadyCached && !kfRev) {
    await handoff("SCRIPT_REVIEW", "artDirector", "Gate 1 approved → Art & Voice");
  }

  // 4. PARALLEL BRANCHES:
  // Branch A: ART_PLANNING -> ILLUSTRATING
  // Branch B: VOICING
  const artBranchPromise = (async () => {
    const artRes = await executeStage<ArtPlan>("ART_PLANNING", "artDirector", artInput, async () => {
      const userPrompt = isWholeSetKfRev && kfRev?.comment
        ? `${JSON.stringify(script)}\n\nHuman reviewer requested changes:\n${kfRev.comment}`
        : JSON.stringify(script);
      const res = await generateValidated(
        text,
        {
          role: "artDirector",
          system: artSkill.prompt,
          user: userPrompt,
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
    const art = artRes.value;
    if (!artRes.cached) {
      await handoff("artDirector", "illustrator", "Style bible & plan → Illustrator");
    }

    const image = providers.image();
    const illInput = {
      art,
      skillVersion: illSkill.version,
      revisionId: kfRev?.id ?? null,
      revisionNote: kfRev?.comment ?? null,
      frameIndex: kfRev?.frameIndex ?? null,
    };

    const kfRes = await executeStage<string[]>("ILLUSTRATING", "illustrator", illInput, async () => {
      const size = { width: REEL.width, height: REEL.height };
      const expectedPaths = [
        path.join(dirs.kf, "k00.png"),
        ...art.edits.map((_, i) => path.join(dirs.kf, `k${String(i + 1).padStart(2, "0")}.png`)),
      ];
      const targetFrame =
        kfRev?.frameIndex !== undefined &&
        kfRev.frameIndex >= 0 &&
        kfRev.frameIndex < expectedPaths.length
          ? kfRev.frameIndex
          : undefined;

      const allExist =
        targetFrame !== undefined
          ? (await Promise.all(expectedPaths.map(fileExists))).every(Boolean)
          : false;

      if (targetFrame !== undefined && allExist) {
        const note = kfRev?.comment ? ` Revision note: ${kfRev.comment}` : "";
        if (targetFrame === 0) {
          await image.textToImage({
            prompt: `${art.style}. ${art.k0Prompt}.${note}`,
            size,
            outPath: expectedPaths[0],
          });
          await rec.artifact("keyframe", expectedPaths[0], "image/png", {
            index: 0,
            revised: true,
            revisionId: kfRev?.id,
          });
        } else {
          const edit = art.edits[targetFrame - 1];
          const r = await image.editImage({
            inputPath: expectedPaths[targetFrame - 1],
            instruction: `${edit.instruction}${note}`,
            outPath: expectedPaths[targetFrame],
          });
          if (r.size.width !== size.width || r.size.height !== size.height) {
            throw new Error(`Keyframe ${targetFrame} size mismatch: got ${r.size.width}x${r.size.height}`);
          }
          await rec.artifact("keyframe", expectedPaths[targetFrame], "image/png", {
            index: targetFrame,
            addObject: edit.addObject,
            revised: true,
            revisionId: kfRev?.id,
          });
        }
        return expectedPaths;
      }

      // Full generation (first run or whole-set revision)
      const note = kfRev?.comment ? ` Revision note: ${kfRev.comment}` : "";
      const k0 = expectedPaths[0];
      const first = await image.textToImage({
        prompt: `${art.style}. ${art.k0Prompt}.${note}`,
        size,
        outPath: k0,
      });
      await rec.artifact("keyframe", k0, "image/png", { index: 0 });
      const kfs = [first.path];

      for (const [i, edit] of art.edits.entries()) {
        const kp = expectedPaths[i + 1];
        const r = await image.editImage({
          inputPath: kfs[i],
          instruction: `${edit.instruction}${note}`,
          outPath: kp,
        });
        if (r.size.width !== size.width || r.size.height !== size.height) {
          throw new Error(`Keyframe ${i + 1} size mismatch: got ${r.size.width}x${r.size.height}`);
        }
        await rec.artifact("keyframe", kp, "image/png", { index: i + 1, addObject: edit.addObject });
        kfs.push(r.path);
      }
      return kfs;
    });

    if (!kfRes.cached) {
      await handoff("illustrator", "KEYFRAME_REVIEW", "Keyframes ready → Gate 2 (Keyframe Review)");
    }

    return { art, keyframes: kfRes.value };
  })();

  const voiceBranchPromise = (async () => {
    const tts = providers.tts();
    // VOICING input does NOT depend on kfRev so Gate 2 rerolls preserve existing voice takes
    const voiceRes = await executeStage(
      "VOICING",
      "voiceActor",
      { narrations: script.beats.map((b) => b.narration), skillVersion: voiceSkill.version },
      async () => {
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
      },
      { setState: false },
    );
    return voiceRes.value;
  })();

  const [{ art, keyframes }, voiceTakes] = await Promise.all([artBranchPromise, voiceBranchPromise]);

  // Gate 2: KEYFRAME_REVIEW (checked only after both parallel branches complete to avoid DB state race)
  let kfDecision = rec.getGateDecision ? await rec.getGateDecision("KEYFRAME_REVIEW") : null;
  if (!kfDecision && autoApprove) {
    kfDecision = { decision: "approved", comment: "Auto-approved keyframes" };
  }

  if (kfDecision?.decision === "rejected") {
    const reason = `Keyframes rejected at gate: ${kfDecision.comment ?? "No comment"}`;
    await rec.log("warn", "illustrator", reason);
    await rec.setState("REJECTED", reason);
    return { state: "REJECTED", error: reason };
  }

  if (!kfDecision || kfDecision.decision === "waiting" || kfDecision.decision === "request_changes") {
    await rec.setState("KEYFRAME_REVIEW");
    await rec.gateWaiting?.(
      "KEYFRAME_REVIEW",
      kfDecision?.decision === "request_changes"
        ? "Revised keyframes ready for Gate 2 review"
        : "Waiting for human approval at KEYFRAME_REVIEW",
    );
    await rec.log("info", "illustrator", "Pipeline paused at KEYFRAME_REVIEW human gate");
    return { state: "KEYFRAME_REVIEW", waitingGate: "KEYFRAME_REVIEW", keyframes };
  }

  await rec.log("info", null, `Gate KEYFRAME_REVIEW passed: ${kfDecision.comment ?? "Approved"}`);

  const animSkill = await loadSkill("animator");
  const animInput = { keyframes, skillVersion: animSkill.version };
  const animAlreadyCached =
    enableCache && rec.findCachedRun
      ? Boolean(await rec.findCachedRun("ANIMATING", sha256({ stageName: "ANIMATING", input: animInput }), { sameJobOnly: sameJobCacheOnly }))
      : false;
  if (!animAlreadyCached) {
    await handoff("KEYFRAME_REVIEW", "animator", "Gate 2 approved → Animator");
  }

  // 5. ANIMATING -> Animator
  const video = providers.video();
  const clipsRes = await executeStage<string[]>("ANIMATING", "animator", animInput, async () => {
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
  const clips = clipsRes.value;
  if (!clipsRes.cached) {
    await handoff("animator", "editor", "Animated clips → Editor");
  }

  // 6. EDITING -> Editor
  const editorSkill = await loadSkill("editor");
  const durationSec = script.beats.reduce((a, b) => a + b.seconds, 0);
  const reelPath = path.join(dirs.out, "reel.mp4");
  const thumbnailPath = path.join(dirs.out, "thumbnail.png");

  const editRes = await executeStage(
    "EDITING",
    "editor",
    { clips, voice: voiceTakes.map((v) => v.path), skillVersion: editorSkill.version },
    async () => {
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
    },
  );
  if (!editRes.cached) {
    await handoff("editor", "socialManager", "Master reel assembled → Social Manager");
  }

  // 7. SOCIAL -> Social Manager
  const socialSkill = await loadSkill("socialManager");
  const socialRes = await executeStage<Social>(
    "SOCIAL",
    "socialManager",
    { script: script.title, platforms: brief.platforms, skillVersion: socialSkill.version },
    async () => {
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
    },
  );
  const social = socialRes.value;

  await writeFile(path.join(dirs.out, "social.json"), JSON.stringify(social, null, 2));
  await rec.artifact("social", path.join(dirs.out, "social.json"), "application/json");
  if (!socialRes.cached) {
    await handoff("socialManager", "POSTED", "Post pack ready → Outbox");
  }

  // 8. READY_TO_POST -> DONE
  await rec.setState("READY_TO_POST");
  if (stageDelayMs > 0) {
    await sleep(Math.min(700, Math.max(200, Math.round(stageDelayMs * 0.2))));
  }
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
