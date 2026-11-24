import { z } from "zod";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { EMPLOYEE_CHECKLISTS } from "@/shared/checklists";
import type { Role } from "@/shared/roster";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const e = env();
  const url = new URL(req.url);
  const jobIdParam = url.searchParams.get("jobId");
  const validJobId = jobIdParam && z.uuid().safeParse(jobIdParam).success ? jobIdParam : null;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        skills: { orderBy: { version: "desc" } },
      },
    });

    if (!employee) return Response.json({ error: "Employee not found" }, { status: 404 });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthRuns = await prisma.stageRun.findMany({
      where: { employeeId: id, startedAt: { gte: startOfMonth } },
      orderBy: { startedAt: "desc" },
    });

    const runsThisMonth = monthRuns.length;
    const finishedRuns = monthRuns.filter(
      (r) => r.finishedAt && (r.status === "done" || r.status === "error"),
    );
    const doneRuns = finishedRuns.filter((r) => r.status === "done").length;
    const successRatePercent =
      finishedRuns.length > 0 ? Math.round((doneRuns / finishedRuns.length) * 100) : 100;

    const avgDurationSec =
      finishedRuns.length > 0
        ? Math.round(
            (finishedRuns.reduce(
              (sum, r) => sum + Math.max(0, r.finishedAt!.getTime() - r.startedAt.getTime()),
              0,
            ) /
              finishedRuns.length /
              1000) *
              10,
          ) / 10
        : 0;

    const monthRunIds = monthRuns.map((r) => r.id);
    const monthLedger =
      monthRunIds.length > 0
        ? await prisma.ledgerEntry.findMany({
            where: { stageRunId: { in: monthRunIds } },
          })
        : [];

    const monthSpendEstUsd = monthLedger.reduce(
      (sum, l) => sum + Number(l.actualUsd ?? l.estUsd ?? 0),
      0,
    );
    const monthSpendEstPhp = Math.round(monthSpendEstUsd * e.FX_USD_PHP * 100) / 100;
    const monthUnitsEst = monthLedger.reduce((sum, l) => sum + Number(l.units ?? 0), 0);

    let jobSpendEstUsd = 0;
    let jobUnitsEst = 0;
    if (validJobId) {
      const jobRuns = await prisma.stageRun.findMany({
        where: { jobId: validJobId, employeeId: id },
        select: { id: true },
      });
      const jobRunIds = jobRuns.map((r) => r.id);
      if (jobRunIds.length > 0) {
        const jobLedger = await prisma.ledgerEntry.findMany({
          where: { stageRunId: { in: jobRunIds } },
        });
        jobSpendEstUsd = jobLedger.reduce(
          (sum, l) => sum + Number(l.actualUsd ?? l.estUsd ?? 0),
          0,
        );
        jobUnitsEst = jobLedger.reduce((sum, l) => sum + Number(l.units ?? 0), 0);
      }
    }
    const jobSpendEstPhp = Math.round(jobSpendEstUsd * e.FX_USD_PHP * 100) / 100;
    const avgCostEstPhp =
      runsThisMonth > 0 ? Math.round((monthSpendEstPhp / runsThisMonth) * 100) / 100 : 0;

    return Response.json({
      employee,
      checklist: EMPLOYEE_CHECKLISTS[id as Role] ?? [],
      stats: {
        runsThisMonth,
        successRatePercent,
        avgDurationSec,
        avgCostEstPhp,
        monthSpendEstUsd: Number(monthSpendEstUsd.toFixed(4)),
        monthSpendEstPhp,
        monthUnitsEst: Math.round(monthUnitsEst),
        jobSpendEstUsd: Number(jobSpendEstUsd.toFixed(4)),
        jobSpendEstPhp,
        jobUnitsEst: Math.round(jobUnitsEst),
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { skills: { orderBy: { version: "desc" } } },
    });

    if (!employee) return Response.json({ error: "Employee not found" }, { status: 404 });

    // Rollback to an existing version
    if (typeof body.rollbackToVersion === "number") {
      const target = employee.skills.find((s) => s.version === body.rollbackToVersion);
      if (!target) {
        return Response.json(
          { error: `Skill version v${body.rollbackToVersion} not found for ${id}` },
          { status: 404 },
        );
      }
      await prisma.employee.update({
        where: { id },
        data: { activeVersion: target.version },
      });
      return Response.json({ ok: true, version: target.version, skill: target });
    }

    const activeSkillRow =
      employee.skills.find((s) => s.version === employee.activeVersion) ?? employee.skills[0];
    const existingSkill = activeSkillRow ? JSON.parse(activeSkillRow.skillJson) : {};

    const newVersion = (employee.skills[0]?.version ?? 0) + 1;
    const skillData = {
      prompt: typeof body.prompt === "string" ? body.prompt : existingSkill.prompt ?? "",
      provider: body.provider ?? existingSkill.provider ?? "gemini",
      model: body.model ?? existingSkill.model ?? "env:GEMINI_TEXT_MODEL",
      params: body.params ?? existingSkill.params ?? {},
      outputSchema: existingSkill.outputSchema ?? id,
    };

    const newSkill = await prisma.skillVersion.create({
      data: {
        employeeId: id,
        version: newVersion,
        skillJson: JSON.stringify(skillData),
        note: body.note || `Updated via UI to v${newVersion}`,
      },
    });

    await prisma.employee.update({
      where: { id },
      data: { activeVersion: newVersion },
    });

    return Response.json({ ok: true, version: newVersion, skill: newSkill });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
