/**
 * Phase-0 linear mock pipeline. Runs every role once, in order, using whatever
 * providers the registry returns (mocks when MOCK_MODE=true) and assembles a
 * real 1080x1920 30fps MP4 with ffmpeg.
 *
 * Phase 1 replaces this with the full state machine (gates, parallel
 * branches, idempotent stage cache, retries, reroll caps).
 */
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
  type Brief,
} from "@/shared/schemas";
import { generateValidated, sha256 } from "./llm";
import type { Recorder } from "./recorder";

export interface MockRunResult {
  reelPath: string;
  thumbnailPath: string;
  durationSec: number;
  keyframes: string[];
  clips: string[];
}

/** Phase-0 placeholder prompts; replaced by versioned skills from the DB in phase 1. */
const SYSTEM = (role: Role) => `You are the ${role} of a faceless explainer-reel studio. Reply with JSON only.`;

export async function runMockPipeline(brief: Brief, jobDir: string, rec: Recorder): Promise<MockRunResult> {
  await mkdir(jobDir, { recursive: true });
  const dirs = {
    kf: path.join(jobDir, "keyframes"),
    clips: path.join(jobDir, "clips"),
    voice: path.join(jobDir, "voice"),
    out: path.join(jobDir, "out"),
  };
  await Promise.all(Object.values(dirs).map((d) => mkdir(d, { recursive: true })));

  async function stage<T>(name: string, employee: Role, input: unknown, fn: () => Promise<T>): Promise<T> {
    const runId = await rec.stageStart(name, employee, sha256({ name, input }));
    try {
      const out = await fn();
      await rec.stageEnd(runId, "done", out);
      return out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await rec.stageEnd(runId, "error", undefined, msg);
      await rec.setState("ERROR", `${name}: ${msg}`);
      throw e;
    }
  }

  const text = providers.text();

  // 1. Producer
  await rec.setState("BRIEFED");
  const plan = await stage("BRIEFED", "producer", brief, async () =>
    (await generateValidated(text, { role: "producer", system: SYSTEM("producer"), user: JSON.stringify(brief) }, ProducerPlanSchema)).value,
  );

  // 2. Scriptwriter
  await rec.setState("SCRIPTING");
  const script = await stage("SCRIPTING", "scriptwriter", plan, async () =>
    (await generateValidated(text, { role: "scriptwriter", system: SYSTEM("scriptwriter"), user: JSON.stringify(plan) }, ScriptSchema)).value,
  );
  await writeFile(path.join(jobDir, "script.json"), JSON.stringify(script, null, 2));
  await rec.log("info", null, "SCRIPT_REVIEW gate auto-approved (phase 0 has no human gates yet)");

  // 3. Art director -> keyframe plan (N beats -> N edits -> N+1 keyframes)
  await rec.setState("ART_PLANNING");
  const art = await stage("ART_PLANNING", "artDirector", script, async () => {
    const v = (await generateValidated(text, { role: "artDirector", system: SYSTEM("artDirector"), user: JSON.stringify(script) }, ArtPlanSchema)).value;
    if (v.edits.length !== script.beats.length) {
      throw new Error(`art plan has ${v.edits.length} edits for ${script.beats.length} beats`);
    }
    return v;
  });

  // 4. Illustrator: K0 text-to-image, Kn = edit(K(n-1)) adding exactly one object
  await rec.setState("ILLUSTRATING");
  const image = providers.image();
  const keyframes = await stage("ILLUSTRATING", "illustrator", art, async () => {
    const size = { width: REEL.width, height: REEL.height };
    const k0 = path.join(dirs.kf, "k00.png");
    const first = await image.textToImage({ prompt: `${art.style}. ${art.k0Prompt}`, size, outPath: k0 });
    await rec.artifact("keyframe", k0, "image/png", { index: 0 });
    const out = [first.path];
    for (const [i, edit] of art.edits.entries()) {
      const kp = path.join(dirs.kf, `k${String(i + 1).padStart(2, "0")}.png`);
      const r = await image.editImage({ inputPath: out[i], instruction: edit.instruction, outPath: kp });
      if (r.size.width !== size.width || r.size.height !== size.height) {
        throw new Error(`keyframe ${i + 1} is ${r.size.width}x${r.size.height}, expected ${size.width}x${size.height}`);
      }
      await rec.artifact("keyframe", kp, "image/png", { index: i + 1, addObject: edit.addObject });
      out.push(r.path);
    }
    return out;
  });
  await rec.log("info", null, "KEYFRAME_REVIEW gate auto-approved (phase 0 has no human gates yet)");

  // 5. Voice actor: one take per beat (keeps beat timing simple)
  await rec.setState("VOICING");
  const tts = providers.tts();
  const voice = await stage("VOICING", "voiceActor", script.beats.map((b) => b.narration), async () => {
    const takes: { path: string; durationSec: number; words: WordTimestamp[] }[] = [];
    for (const b of script.beats) {
      const p = path.join(dirs.voice, `beat${b.index}.wav`);
      const r = await tts.synthesize({ text: b.narration, outPath: p });
      if (r.durationSec > b.seconds) {
        await rec.log("warn", "voiceActor", `beat ${b.index} voice ${r.durationSec}s exceeds beat ${b.seconds}s; will be trimmed`);
      }
      await rec.artifact("voice", p, "audio/wav", { beat: b.index, durationSec: r.durationSec, words: r.words });
      takes.push({ path: r.path, durationSec: r.durationSec, words: r.words });
    }
    return takes;
  });

  // 6. Animator: clip n uses first = kf[n], last = kf[n+1]
  await rec.setState("ANIMATING");
  const video = providers.video();
  const clips = await stage("ANIMATING", "animator", keyframes, async () => {
    const out: string[] = [];
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
      out.push(done.path);
    }
    return out;
  });

  // 7. Editor: concat clips, lay each voice take on its beat, loudnorm -16 LUFS
  await rec.setState("EDITING");
  const durationSec = script.beats.reduce((a, b) => a + b.seconds, 0);
  const reelPath = path.join(dirs.out, "reel.mp4");
  const thumbnailPath = path.join(dirs.out, "thumbnail.png");
  await stage("EDITING", "editor", { clips, voice: voice.map((v) => v.path) }, async () => {
    const listFile = path.join(dirs.clips, "concat.txt");
    await writeFile(listFile, clips.map((c) => `file '${ffPath(c)}'`).join("\n"));
    const audioIn = voice.flatMap((v) => ["-i", v.path]);
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

  // 8. Social manager (disclosure is mandatory; never auto-posts)
  await rec.setState("SOCIAL");
  const social = await stage("SOCIAL", "socialManager", { script: script.title, platforms: brief.platforms }, async () =>
    (await generateValidated(text, { role: "socialManager", system: SYSTEM("socialManager"), user: JSON.stringify({ title: script.title, platforms: brief.platforms }) }, SocialSchema)).value,
  );
  await writeFile(path.join(dirs.out, "social.json"), JSON.stringify(social, null, 2));
  await rec.artifact("social", path.join(dirs.out, "social.json"), "application/json");

  await rec.setState("READY_TO_POST");
  return { reelPath, thumbnailPath, durationSec, keyframes, clips };
}
