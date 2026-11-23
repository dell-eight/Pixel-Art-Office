import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import { env } from "./env";

export function ffmpegPath(): string {
  const custom = env().FFMPEG_PATH;
  if (custom) return custom;
  const bundled = ffmpegStatic as unknown as string | null;
  if (!bundled) throw new Error("ffmpeg not found: set FFMPEG_PATH or reinstall ffmpeg-static");
  return bundled;
}

/** Run ffmpeg with args; rejects with the stderr tail on failure. */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      windowsHide: true,
    });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

/** Path escaping for ffmpeg filter arguments / concat lists on Windows. */
export function ffPath(p: string): string {
  return p.replace(/\\/g, "/");
}
