import { prisma } from "@/server/db";
import { dataDir } from "@/server/env";
import { DbRecorder } from "@/server/pipeline/dbRecorder";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";
import { BriefSchema } from "@/shared/schemas";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        stageRuns: { orderBy: { startedAt: "desc" }, take: 10 },
        artifacts: true,
        gates: true,
      },
    });
    return Response.json({ jobs });
  } catch (e) {
    return Response.json({ error: String(e), jobs: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const brief = BriefSchema.parse({
      topic: body.topic || "Building the perfect home office",
      audience: body.audience || "general",
      platforms: body.platforms || ["tiktok"],
      tone: body.tone || "curious, friendly",
    });

    const job = await prisma.job.create({
      data: {
        title: brief.topic,
        briefJson: JSON.stringify(brief),
        mock: true,
        state: "BRIEFED",
      },
    });

    // Fire off async execution
    const jobDir = path.join(dataDir(), "jobs", job.id);
    const rec = new DbRecorder(prisma, job.id, true, false);

    // Run non-blocking in background
    runStateMachinePipeline(brief, jobDir, rec, {
      autoApproveGates: false,
      enableCache: true,
    }).catch((err) => {
      console.error(`Job ${job.id} background run error:`, err);
    });

    return Response.json({ ok: true, job }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
