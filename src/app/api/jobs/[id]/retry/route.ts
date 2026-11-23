import { prisma } from "@/server/db";
import { dataDir } from "@/server/env";
import { DbRecorder } from "@/server/pipeline/dbRecorder";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    const brief = JSON.parse(job.briefJson);
    const jobDir = path.join(dataDir(), "jobs", job.id);
    const rec = new DbRecorder(prisma, job.id, true, false);

    await prisma.job.update({
      where: { id },
      data: { error: null },
    });

    runStateMachinePipeline(brief, jobDir, rec, {
      autoApproveGates: false,
      enableCache: true,
    }).catch((err) => {
      console.error(`Retrying job ${job.id} error:`, err);
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
