/**
 * Background worker (npm run worker). Phase 0: placeholder that verifies
 * ffmpeg + env. Phase 1 turns this into the job runner that advances the
 * state machine (DB-polled queue; Redis/BullMQ optional later).
 */
import { env } from "@/server/env";
import { ffmpegPath } from "@/server/ffmpeg";

const e = env();
console.log(`[worker] mockMode=${e.MOCK_MODE} ffmpeg=${ffmpegPath()}`);
console.log("[worker] phase 0: no queue yet - use `npm run mock:demo` to run the pipeline.");
