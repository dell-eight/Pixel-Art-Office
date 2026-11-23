import { checkDb } from "@/server/db";
import { env } from "@/server/env";
import { ffmpegPath } from "@/server/ffmpeg";

export const dynamic = "force-dynamic";

export async function GET() {
  const e = env();
  let ffmpeg: string | null = null;
  try {
    ffmpeg = ffmpegPath();
  } catch {
    ffmpeg = null;
  }
  const db = await checkDb();
  return Response.json(
    { ok: db.ok && !!ffmpeg, mockMode: e.MOCK_MODE, db, ffmpeg: ffmpeg ? "found" : "missing" },
    { status: db.ok ? 200 : 503 },
  );
}
