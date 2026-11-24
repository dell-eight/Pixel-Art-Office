import path from "node:path";
import { prisma } from "@/server/db";
import { dataDir, env } from "@/server/env";
import { DbRecorder } from "@/server/pipeline/dbRecorder";
import { emitStudioEvent } from "@/server/pipeline/events";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const e = env();
    const { gate, decision, comment } = await req.json();

    if (!["SCRIPT_REVIEW", "KEYFRAME_REVIEW"].includes(gate)) {
      return Response.json({ error: "Invalid gate name" }, { status: 400 });
    }
    if (!["approved", "rejected"].includes(decision)) {
      return Response.json({ error: "Decision must be approved or rejected" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    await prisma.gateDecision.create({
      data: {
        jobId: id,
        gate,
        decision,
        comment: comment ?? null,
      },
    });

    emitStudioEvent({
      type: "gate:resolved",
      jobId: id,
      jobTitle: job.title,
      gate,
      stage: gate,
      message: `${gate} ${decision}${comment ? `: ${comment}` : ""}`,
    });

    if (decision === "approved") {
      const brief = JSON.parse(job.briefJson);
      const jobDir = path.join(dataDir(), "jobs", job.id);
      const rec = new DbRecorder(prisma, job.id, true, e.MOCK_AUTO_APPROVE, job.title);

      runStateMachinePipeline(brief, jobDir, rec, {
        autoApproveGates: e.MOCK_AUTO_APPROVE,
        enableCache: true,
        sameJobCacheOnly: e.MOCK_MODE,
        stageDelayMs: e.MOCK_MODE ? e.MOCK_STAGE_MS : 0,
      }).catch((err) => {
        console.error(`Resuming job ${job.id} after approval error:`, err);
      });
    } else {
      const errMsg = `Rejected at ${gate}: ${comment || "No reason given"}`;
      await prisma.job.update({
        where: { id },
        data: { state: "ERROR", error: errMsg },
      });
      emitStudioEvent({
        type: "job:error",
        jobId: id,
        jobTitle: job.title,
        stage: "ERROR",
        level: "error",
        message: errMsg,
      });
    }

    return Response.json({ ok: true, gate, decision });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
