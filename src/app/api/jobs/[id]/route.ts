import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        stageRuns: { orderBy: { startedAt: "asc" } },
        artifacts: true,
        gates: { orderBy: { createdAt: "desc" } },
        logs: { orderBy: { createdAt: "asc" }, take: 50 },
        ledger: true,
      },
    });

    if (!job) return new Response("Not found", { status: 404 });
    return Response.json({ job });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
