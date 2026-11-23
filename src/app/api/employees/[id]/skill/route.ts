import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        skills: { orderBy: { version: "desc" } },
      },
    });

    if (!employee) return Response.json({ error: "Employee not found" }, { status: 404 });
    return Response.json({ employee });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const { prompt, provider, model, params, note } = body;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { skills: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (!employee) return Response.json({ error: "Employee not found" }, { status: 404 });

    const newVersion = (employee.skills[0]?.version ?? 0) + 1;
    const skillData = {
      prompt,
      provider,
      model,
      params: params ?? {},
      outputSchema: id,
    };

    const newSkill = await prisma.skillVersion.create({
      data: {
        employeeId: id,
        version: newVersion,
        skillJson: JSON.stringify(skillData),
        note: note || `Updated via UI to v${newVersion}`,
      },
    });

    await prisma.employee.update({
      where: { id },
      data: { activeVersion: newVersion },
    });

    return Response.json({ ok: true, version: newVersion, skill: newSkill });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
