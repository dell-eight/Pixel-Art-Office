import { prisma } from "@/server/db";
import { dataDir } from "@/server/env";
import { DbRecorder } from "@/server/pipeline/dbRecorder";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const { gate, decision, comment } = await req.json();

    if (!["SCRIPT_REVIEW", "KEYFRAME_REVIEW"].includes(gate)) {
      return Response.json({ error: "Invalid gate name" }, { status: 400 });
    }
    if (!["approved", "rejected"].includes(decision)) {
      return Response.json({ error: "Decision must be approved or rejected" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    // Record human gate decision
    await prisma.gateDecision.create({
      data: {
        jobId: id,
        gate,
        decision,
        comment: comment ?? null,
      },
    });

    if (decision === "approved") {
      // Resume pipeline
      const brief = JSON.parse(job.briefJson);
      const jobDir = path.join(dataDir(), "jobs", job.id);
      const rec = new DbRecorder(prisma, job.id, true, false);

      runStateMachinePipeline(brief, jobDir, rec, {
        autoApproveGates: false,
        enableCache: true,
      }).catch((err) => {
        console.error(`Resuming job ${job.id} after approval error:`, err);
      });
    } else {
      await prisma.job.update({
        where: { id },
        data: { state: "ERROR", error: `Rejected at ${gate}: ${comment || "No reason given"}` },
      });
    }

    return Response.json({ ok: true, gate, decision });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
