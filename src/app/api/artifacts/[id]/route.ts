import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { prisma } from "@/server/db";
import { dataDir } from "@/server/env";

export const dynamic = "force-dynamic";

/** Streams an artifact file (with Range support for video). Only serves files under DATA_DIR. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("bad id", { status: 400 });

  const art = await prisma.artifact.findUnique({ where: { id } });
  if (!art) return new Response("not found", { status: 404 });

  const root = dataDir();
  const file = path.resolve(/*turbopackIgnore: true*/ art.path);
  if (!file.toLowerCase().startsWith(root.toLowerCase() + path.sep)) {
    return new Response("forbidden", { status: 403 });
  }

  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response("file missing", { status: 410 });
  }

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        "Content-Type": art.mime,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, {
    headers: { "Content-Type": art.mime, "Content-Length": String(size), "Accept-Ranges": "bytes" },
  });
}
