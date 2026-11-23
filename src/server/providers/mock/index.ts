import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { runFfmpeg } from "@/server/ffmpeg";
import type { Role } from "@/shared/roster";
import { TEXT_FIXTURES } from "./fixtures";
import type {
  CallMeta,
  ImageProvider,
  ImageResult,
  ImageSize,
  TextProvider,
  TextRequest,
  TextResult,
  TtsProvider,
  TtsResult,
  VideoCapabilities,
  VideoJobStatus,
  VideoProvider,
  VideoRequest,
  WordTimestamp,
} from "../types";

const meta = (unit: string, units: number, t0: number): CallMeta => ({
  provider: "mock",
  model: "mock-v1",
  unit,
  units,
  latencyMs: Date.now() - t0,
});

function hashInt(s: string): number {
  return createHash("sha1").update(s).digest().readUInt32BE(0);
}

/* ----------------------------------------------------------------- text */

export class MockTextProvider implements TextProvider {
  readonly name = "mock";
  async generate(req: TextRequest): Promise<TextResult> {
    const t0 = Date.now();
    const fixture = TEXT_FIXTURES[req.role as Role];
    if (fixture === undefined) throw new Error(`mock text: no fixture for role "${req.role}"`);
    const text = JSON.stringify(fixture, null, 2);
    return { text, meta: meta("tokens", Math.ceil((req.system.length + req.user.length + text.length) / 4), t0) };
  }
}

/* ---------------------------------------------------------------- image */

const PALETTE = ["0xe4572e", "0xf3a712", "0x2a9d8f", "0x669bbc", "0xb56576", "0xa8c686", "0x6d597a"];

/**
 * Mock images are drawn with ffmpeg: K0 = a flat "isometric room" placeholder,
 * each edit adds exactly one coloured block (= one object), keeping dimensions.
 */
export class MockImageProvider implements ImageProvider {
  readonly name = "mock";

  async textToImage(req: { prompt: string; size: ImageSize; outPath: string }): Promise<ImageResult> {
    const t0 = Date.now();
    const { width: w, height: h } = req.size;
    const floorY = Math.round(h * 0.55);
    const vf = [
      `drawbox=x=0:y=${floorY}:w=${w}:h=${h - floorY}:color=0xd9c5a0:t=fill`, // floor
      `drawbox=x=0:y=0:w=${Math.round(w * 0.06)}:h=${floorY}:color=0xb8a98a:t=fill`, // left wall edge
      `drawbox=x=${Math.round(w * 0.3)}:y=${floorY - Math.round(h * 0.08)}:w=${Math.round(w * 0.4)}:h=${Math.round(h * 0.03)}:color=0x8b5a2b:t=fill`, // desk top
      `drawbox=x=${Math.round(w * 0.32)}:y=${floorY - Math.round(h * 0.05)}:w=${Math.round(w * 0.02)}:h=${Math.round(h * 0.07)}:color=0x6b4423:t=fill`,
      `drawbox=x=${Math.round(w * 0.66)}:y=${floorY - Math.round(h * 0.05)}:w=${Math.round(w * 0.02)}:h=${Math.round(h * 0.07)}:color=0x6b4423:t=fill`,
    ].join(",");
    await runFfmpeg(["-f", "lavfi", "-i", `color=c=0xf2e8cf:s=${w}x${h}`, "-vf", vf, "-frames:v", "1", req.outPath]);
    return { path: req.outPath, size: req.size, meta: meta("images", 1, t0) };
  }

  async editImage(req: { inputPath: string; instruction: string; outPath: string }): Promise<ImageResult> {
    const t0 = Date.now();
    const size = await pngSize(req.inputPath);
    const hsh = hashInt(req.instruction);
    const bw = Math.round(size.width * (0.12 + (hsh % 7) / 100));
    const bh = Math.round(size.height * (0.06 + ((hsh >>> 3) % 5) / 100));
    const x = Math.round((size.width - bw) * (((hsh >>> 6) % 100) / 100));
    const y = Math.round(size.height * 0.4 + (size.height * 0.45 - bh) * (((hsh >>> 13) % 100) / 100));
    const color = PALETTE[(hsh >>> 20) % PALETTE.length];
    const vf = `drawbox=x=${x}:y=${y}:w=${bw}:h=${bh}:color=${color}:t=fill,drawbox=x=${x}:y=${y}:w=${bw}:h=${bh}:color=0x222222:t=6`;
    await runFfmpeg(["-i", req.inputPath, "-vf", vf, "-frames:v", "1", req.outPath]);
    return { path: req.outPath, size, meta: meta("images", 1, t0) };
  }
}

/** Read width/height from a PNG IHDR chunk. */
export async function pngSize(file: string): Promise<ImageSize> {
  const { open } = await import("node:fs/promises");
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(24);
    await fh.read(buf, 0, 24, 0);
    if (buf.toString("ascii", 1, 4) !== "PNG") throw new Error(`${file} is not a PNG`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    await fh.close();
  }
}

/* ---------------------------------------------------------------- video */

/** First/last-frame "video": a crossfade from kf[n] to kf[n+1] with a slow push-in. Completes synchronously, polled like a real async API. */
export class MockVideoProvider implements VideoProvider {
  readonly name = "mock";
  private jobs = new Map<string, VideoJobStatus>();
  private seq = 0;

  capabilities(): VideoCapabilities {
    return {
      firstLastFrame: true,
      minSeconds: 2,
      maxSeconds: 10,
      aspectRatios: ["9:16"],
      maxResolution: { width: 1080, height: 1920 },
    };
  }

  async submit(req: VideoRequest): Promise<string> {
    const id = `mock-video-${++this.seq}`;
    this.jobs.set(id, { state: "running", progress: 0 });
    const t0 = Date.now();
    const d = req.seconds;
    const fade = (d * 0.5).toFixed(3);
    const offset = (d * 0.25).toFixed(3);
    try {
      await runFfmpeg([
        "-loop", "1", "-framerate", "30", "-t", String(d), "-i", req.firstFramePath,
        "-loop", "1", "-framerate", "30", "-t", String(d), "-i", req.lastFramePath,
        "-filter_complex",
        `[0:v][1:v]xfade=transition=fade:duration=${fade}:offset=${offset},format=yuv420p[v]`,
        "-map", "[v]", "-t", String(d), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        req.outPath,
      ]);
      this.jobs.set(id, { state: "succeeded", path: req.outPath, meta: meta("seconds", d, t0) });
    } catch (e) {
      this.jobs.set(id, { state: "failed", error: e instanceof Error ? e.message : String(e) });
    }
    return id;
  }

  async poll(jobId: string): Promise<VideoJobStatus> {
    return this.jobs.get(jobId) ?? { state: "failed", error: `unknown job ${jobId}` };
  }
}

/* ------------------------------------------------------------------ tts */

export const MOCK_WORD_SECONDS = 0.26;
export const MOCK_GAP_SECONDS = 0.04;

/** Deterministic word timings: fixed word length plus a pause after punctuation. */
export function mockWordTimestamps(text: string): WordTimestamp[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: WordTimestamp[] = [];
  let t = 0.1;
  for (const word of words) {
    const start = t;
    const end = start + MOCK_WORD_SECONDS;
    out.push({ word, start: round3(start), end: round3(end) });
    t = end + MOCK_GAP_SECONDS + (/[.,!?;:]$/.test(word) ? 0.25 : 0);
  }
  return out;
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Mock voice = soft tone "syllables" matching the word timestamps (real WAV via ffmpeg). */
export class MockTtsProvider implements TtsProvider {
  readonly name = "mock";
  async synthesize(req: { text: string; voiceId?: string; outPath: string }): Promise<TtsResult> {
    const t0 = Date.now();
    const words = mockWordTimestamps(req.text);
    const durationSec = round3((words.at(-1)?.end ?? 0) + 0.3);
    // volume gate: tone audible only inside word windows
    const gate = words.map((w) => `between(t,${w.start},${w.end})`).join("+") || "0";
    await runFfmpeg([
      "-f", "lavfi", "-i", `sine=frequency=196:sample_rate=48000:duration=${durationSec}`,
      "-af", `volume='0.25*gt(${gate},0)':eval=frame`,
      "-ac", "1", req.outPath,
    ]);
    await stat(req.outPath);
    return { path: req.outPath, durationSec, words, meta: meta("characters", req.text.length, t0) };
  }
}
