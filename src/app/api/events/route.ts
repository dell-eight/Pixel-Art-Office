import { prisma } from "@/server/db";
import { getRecentStudioEvents, subscribeStudioEvents } from "@/server/pipeline/events";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) for realtime studio updates:
 * sends an initial snapshot on connect, then pushes studio events immediately
 * as stages start, progress, finish, hand off folders, or pause at gates.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let active = true;

      const send = (payload: unknown) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          active = false;
        }
      };

      const unsubscribe = subscribeStudioEvents((event) => {
        send({ kind: "studio", event });
      });

      const heartbeat = setInterval(() => {
        if (!active) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          active = false;
          clearInterval(heartbeat);
        }
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        active = false;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });

      // Push initial snapshot immediately on connect
      try {
        const [jobs, logs] = await Promise.all([
          prisma.job.findMany({
            orderBy: { updatedAt: "desc" },
            take: 10,
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
            take: 20,
          }),
        ]);
        send({
          kind: "snapshot",
          jobs,
          logs: logs.reverse(),
          recentEvents: getRecentStudioEvents(),
          timestamp: new Date().toISOString(),
        });
      } catch {
        send({
          kind: "snapshot",
          jobs: [],
          logs: [],
          recentEvents: getRecentStudioEvents(),
          timestamp: new Date().toISOString(),
        });
      }
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
