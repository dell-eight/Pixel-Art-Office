import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

/** Singleton Prisma client (survives Next.js dev hot reloads). */
export const prisma: PrismaClient = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

export type DbStatus = { ok: true; server: string; database: string; login: string } | { ok: false; error: string };

export async function checkDb(): Promise<DbStatus> {
  try {
    const rows = await prisma.$queryRaw<{ server: string; db: string; login: string }[]>`
      SELECT CAST(@@SERVERNAME AS NVARCHAR(128)) AS server, DB_NAME() AS db, SUSER_SNAME() AS login`;
    const r = rows[0];
    return { ok: true, server: r.server, database: r.db, login: r.login };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // Prisma prefixes errors with an "Invalid `prisma.$queryRaw()` invocation:" line; keep the useful part.
    const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("Invalid `prisma"));
    return { ok: false, error: lines.join(" ") || raw };
  }
}
