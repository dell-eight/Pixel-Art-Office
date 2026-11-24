import path from "node:path";
import { prisma } from "@/server/db";
import { dataDir, env } from "@/server/env";
import { DbRecorder } from "@/server/pipeline/dbRecorder";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const e = env();
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    const brief = JSON.parse(job.briefJson);
    const jobDir = path.join(dataDir(), "jobs", job.id);
    const rec = new DbRecorder(prisma, job.id, true, e.MOCK_AUTO_APPROVE, job.title);

    await prisma.job.update({
      where: { id },
      data: { error: null },
    });

    runStateMachinePipeline(brief, jobDir, rec, {
      autoApproveGates: e.MOCK_AUTO_APPROVE,
      enableCache: true,
      sameJobCacheOnly: e.MOCK_MODE,
      stageDelayMs: e.MOCK_MODE ? e.MOCK_STAGE_MS : 0,
    }).catch((err) => {
      console.error(`Retrying job ${job.id} error:`, err);
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
