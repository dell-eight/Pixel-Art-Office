import { prisma } from "@/server/db";
import type { Role } from "@/shared/roster";

export interface LoadedSkill {
  prompt: string;
  provider: string;
  model: string;
  params: Record<string, unknown>;
  outputSchema?: string;
  version: number;
}

/**
 * Loads the active versioned skill prompt and config for an employee from the database,
 * falling back to an in-memory fallback if the database has not seeded or is unavailable.
 */
export async function getEmployeeSkill(role: Role): Promise<LoadedSkill> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: role },
      include: {
        skills: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (employee && employee.skills.length > 0) {
      const active = employee.skills[0];
      const parsed = JSON.parse(active.skillJson);
      return {
        prompt: parsed.prompt,
        provider: parsed.provider,
        model: parsed.model,
        params: parsed.params ?? {},
        outputSchema: parsed.outputSchema,
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
    version: 1,
  };
}
