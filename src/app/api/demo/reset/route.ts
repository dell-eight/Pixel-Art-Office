import { resetDemoData } from "@/server/pipeline/resetDemo";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const res = await resetDemoData();
    return Response.json({ ok: true, ...res });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
