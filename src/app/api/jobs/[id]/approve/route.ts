import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import { dataDir, env } from "@/server/env";
import { DbRecorder } from "@/server/pipeline/dbRecorder";
import { emitStudioEvent } from "@/server/pipeline/events";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";
import { ScriptSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const e = env();
    const { gate, decision, comment, frameIndex, editedScript } = await req.json();

    if (!["SCRIPT_REVIEW", "KEYFRAME_REVIEW"].includes(gate)) {
      return Response.json({ error: "Invalid gate name" }, { status: 400 });
    }
    if (!["approved", "request_changes", "rejected"].includes(decision)) {
      return Response.json(
        { error: "Decision must be approved, request_changes, or rejected" },
        { status: 400 },
      );
    }

    const cleanComment = typeof comment === "string" ? comment.trim() : "";
    if ((decision === "request_changes" || decision === "rejected") && !cleanComment) {
      return Response.json(
        { error: decision === "rejected" ? "Rejection reason is required" : "Revision note is required" },
        { status: 400 },
      );
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    const jobDir = path.join(dataDir(), "jobs", job.id);

    // If the reviewer edited the script at Gate 1 before approving, validate and save it for downstream stages
    if (decision === "approved" && gate === "SCRIPT_REVIEW" && editedScript) {
      const parsed = ScriptSchema.safeParse(editedScript);
      if (!parsed.success) {
        return Response.json(
          { error: `Invalid edited script: ${parsed.error.issues.map((i) => i.message).join("; ")}` },
          { status: 400 },
        );
      }
      await mkdir(jobDir, { recursive: true });
      await writeFile(path.join(jobDir, "script.json"), JSON.stringify(parsed.data, null, 2));
      const lastScriptRun = await prisma.stageRun.findFirst({
        where: { jobId: id, stage: "SCRIPTING", status: "done" },
        orderBy: [{ finishedAt: "desc" }, { startedAt: "desc" }],
      });
      if (lastScriptRun) {
        const now = new Date();
        await prisma.stageRun.create({
          data: {
            jobId: id,
            stage: "SCRIPTING",
            employeeId: "scriptwriter",
            status: "done",
            inputHash: lastScriptRun.inputHash,
            outputJson: JSON.stringify(parsed.data),
            startedAt: now,
            finishedAt: now,
          },
        });
      }
    }

    const storedComment =
      typeof frameIndex === "number" && Number.isInteger(frameIndex) && frameIndex >= 0
        ? `[Frame K${frameIndex}] ${cleanComment}`
        : cleanComment || null;

    const gateRow = await prisma.gateDecision.create({
      data: {
        jobId: id,
        gate,
        decision,
        comment: storedComment,
      },
    });

    const msg = `${gate} ${decision}${storedComment ? `: ${storedComment}` : ""}`;
    await prisma.logEntry.create({
      data: {
        jobId: id,
        employeeId: gate === "KEYFRAME_REVIEW" ? "illustrator" : "scriptwriter",
        level: decision === "rejected" ? "warn" : "info",
        message: msg,
      },
    });

    emitStudioEvent({
      type: "gate:resolved",
      jobId: id,
      jobTitle: job.title,
      gate,
      stage: gate,
      message: msg,
    });

    if (decision === "approved" || decision === "request_changes") {
      const brief = JSON.parse(job.briefJson);
      const rec = new DbRecorder(prisma, job.id, true, e.MOCK_AUTO_APPROVE, job.title);

      runStateMachinePipeline(brief, jobDir, rec, {
        autoApproveGates: e.MOCK_AUTO_APPROVE,
        enableCache: true,
        sameJobCacheOnly: e.MOCK_MODE,
        stageDelayMs: e.MOCK_MODE ? e.MOCK_STAGE_MS : 0,
      }).catch((err) => {
        console.error(`Resuming job ${job.id} after ${decision} error:`, err);
      });
    } else {
      const errMsg = `Rejected at ${gate}: ${storedComment}`;
      await prisma.job.update({
        where: { id },
        data: { state: "REJECTED", error: errMsg },
      });
      emitStudioEvent({
        type: "job:error",
        jobId: id,
        jobTitle: job.title,
        stage: "REJECTED",
        level: "error",
        message: errMsg,
      });
    }

    return Response.json({ ok: true, gate, decision, gateDecision: gateRow });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
