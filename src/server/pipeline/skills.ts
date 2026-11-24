import { prisma } from "@/server/db";
import { EMPLOYEE_CHECKLISTS } from "@/shared/checklists";
import type { Role } from "@/shared/roster";

export interface LoadedSkill {
  prompt: string;
  provider: string;
  model: string;
  params: Record<string, unknown>;
  outputSchema?: string;
  checklist: readonly string[];
  version: number;
}

/**
 * Loads the active versioned skill prompt and config for an employee from the database,
 * resolving employee.activeVersion (falling back to latest if missing) so rollbacks apply
 * on the very next pipeline run.
 */
export async function getEmployeeSkill(role: Role): Promise<LoadedSkill> {
  const checklist = EMPLOYEE_CHECKLISTS[role] ?? [];
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: role },
      include: {
        skills: {
          orderBy: { version: "desc" },
        },
      },
    });

    if (employee && employee.skills.length > 0) {
      const active =
        employee.skills.find((s) => s.version === employee.activeVersion) ?? employee.skills[0];
      const parsed = JSON.parse(active.skillJson);
      return {
        prompt: parsed.prompt,
        provider: parsed.provider,
        model: parsed.model,
        params: parsed.params ?? {},
        outputSchema: parsed.outputSchema,
        checklist,
        version: active.version,
      };
    }
  } catch {
    // DB not available or offline fallback
  }

  return {
    prompt: `You are the ${role} of a faceless 3D cutaway explainer reel studio. Follow your role rules and reply with strictly valid JSON matching the requested schema.`,
    provider: "gemini",
    model: "gemini-flash",
    params: { temperature: 0.7 },
    checklist,
    version: 1,
  };
}
