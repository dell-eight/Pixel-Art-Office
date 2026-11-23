/**
 * Provider adapter interfaces. Every concrete provider (Gemini, Veo, Vidu,
 * ElevenLabs, OpenAI, Kling, Mock) implements one or more of these.
 */

export interface CallMeta {
  provider: string;
  model: string;
  /** billable units for the budget ledger (tokens, images, seconds, chars) */
  units: number;
  unit: string;
  latencyMs: number;
}

export interface TextRequest {
  role: string;
  system: string;
  user: string;
  /** JSON output expected; caller validates with zod and may re-ask with the error */
  json?: boolean;
  params?: Record<string, unknown>;
}
export interface TextResult {
  text: string;
  meta: CallMeta;
}
export interface TextProvider {
  readonly name: string;
  generate(req: TextRequest): Promise<TextResult>;
}

export interface ImageSize {
  width: number;
  height: number;
}
export interface ImageResult {
  /** absolute path of the written PNG */
  path: string;
  size: ImageSize;
  meta: CallMeta;
}
export interface ImageProvider {
  readonly name: string;
  textToImage(req: { prompt: string; size: ImageSize; outPath: string }): Promise<ImageResult>;
  /** Edit an existing image (keyframe chain: add exactly one object). Must keep dimensions. */
  editImage(req: { inputPath: string; instruction: string; outPath: string }): Promise<ImageResult>;
}

export interface VideoCapabilities {
  firstLastFrame: boolean;
  minSeconds: number;
  maxSeconds: number;
  aspectRatios: string[];
  maxResolution: ImageSize;
}
export interface VideoRequest {
  prompt: string;
  firstFramePath: string;
  lastFramePath: string;
  seconds: number;
  outPath: string;
}
export type VideoJobStatus =
  | { state: "queued" | "running"; progress?: number }
  | { state: "succeeded"; path: string; meta: CallMeta }
  | { state: "failed"; error: string };
export interface VideoProvider {
  readonly name: string;
  capabilities(): VideoCapabilities;
  /** Submit async generation; returns provider job id. */
  submit(req: VideoRequest): Promise<string>;
  poll(jobId: string): Promise<VideoJobStatus>;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}
export interface TtsResult {
  path: string;
  durationSec: number;
  words: WordTimestamp[];
  meta: CallMeta;
}
export interface TtsProvider {
  readonly name: string;
  synthesize(req: { text: string; voiceId?: string; outPath: string }): Promise<TtsResult>;
}

export class NotImplementedProviderError extends Error {
  constructor(provider: string, method: string) {
    super(`${provider}.${method} is not implemented yet (enable MOCK_MODE=true or wait for its phase)`);
    this.name = "NotImplementedProviderError";
  }
}

/** Generic async poll helper with backoff for VideoProvider. */
export async function waitForVideo(
  p: VideoProvider,
  jobId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<Extract<VideoJobStatus, { state: "succeeded" }>> {
  const start = Date.now();
  let interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 10 * 60_000;
  for (;;) {
    const s = await p.poll(jobId);
    if (s.state === "succeeded") return s;
    if (s.state === "failed") throw new Error(`${p.name} video job ${jobId} failed: ${s.error}`);
    if (Date.now() - start > timeout) throw new Error(`${p.name} video job ${jobId} timed out`);
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * 1.5, 15_000);
  }
}
