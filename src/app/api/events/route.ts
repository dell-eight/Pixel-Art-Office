import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) for realtime studio updates:
 * broadcasts job state changes, stage logs, and courier movements.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let active = true;

      req.signal.addEventListener("abort", () => {
        active = false;
        try {
          controller.close();
        } catch {
          // ignore
        }
      });

      // Poll latest events and status periodically
      const interval = setInterval(async () => {
        if (!active) {
          clearInterval(interval);
          return;
        }

        try {
          const [jobs, recentLogs] = await Promise.all([
            prisma.job.findMany({
              orderBy: { updatedAt: "desc" },
              take: 5,
              select: {
                id: true,
                title: true,
                state: true,
                error: true,
                updatedAt: true,
              },
            }),
            prisma.logEntry.findMany({
              orderBy: { id: "desc" },
              take: 5,
            }),
          ]);

          const payload = JSON.stringify({
            jobs,
            logs: recentLogs.reverse(),
            timestamp: new Date().toISOString(),
          });

          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // Send heartbeat if db busy
          controller.enqueue(encoder.encode(`: ping\n\n`));
        }
      }, 2000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
