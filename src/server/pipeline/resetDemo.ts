import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import { dataDir } from "@/server/env";
import { clearStudioEvents, emitStudioEvent } from "./events";

export interface ResetDemoResult {
  deletedJobs: number;
  removedDirs: number;
}

/** Delete all mock jobs from SQL Server (cascading runs/artifacts/logs/gates) and clean up data/jobs/<id>. */
export async function resetDemoData(): Promise<ResetDemoResult> {
  const mockJobs = await prisma.job.findMany({
    where: { mock: true },
    select: { id: true },
  });

  const { count } = await prisma.job.deleteMany({
    where: { mock: true },
  });

  const jobsRoot = path.resolve(/*turbopackIgnore: true*/ dataDir(), "jobs");
  let removedDirs = 0;
  for (const j of mockJobs) {
    const target = path.resolve(/*turbopackIgnore: true*/ jobsRoot, j.id);
    if (target.toLowerCase().startsWith(jobsRoot.toLowerCase() + path.sep)) {
      try {
        await rm(target, { recursive: true, force: true });
        removedDirs++;
      } catch {
        // ignore missing or locked artifact files
      }
    }
  }

  clearStudioEvents();
  emitStudioEvent({
    type: "demo:reset",
    jobId: "system",
    message: `Cleared ${count} mock job(s) and reset demo floor`,
  });

  return { deletedJobs: count, removedDirs };
}
