/**
 * Seeds the 8 employees with skill v1.
 * NOTE: prompts are PLACEHOLDERS. Phase 1 replaces them with the system
 * prompts from the blueprint's roster (as skill v2, keeping history).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ROSTER } from "../src/shared/roster";

const prisma = new PrismaClient();

const DEFAULT_PROVIDER: Record<string, { provider: string; modelEnv: string }> = {
  text: { provider: "gemini", modelEnv: "GEMINI_TEXT_MODEL" },
  image: { provider: "gemini", modelEnv: "GEMINI_IMAGE_MODEL" },
  video: { provider: "veo", modelEnv: "VEO_MODEL" },
  tts: { provider: "elevenlabs", modelEnv: "ELEVENLABS_MODEL" },
  ffmpeg: { provider: "ffmpeg", modelEnv: "" },
};

async function main() {
  for (const [i, e] of ROSTER.entries()) {
    const d = DEFAULT_PROVIDER[e.kind];
    const skill = {
      prompt: `PLACEHOLDER - You are ${e.name}, the ${e.title} of a faceless explainer-reel studio. Reply with JSON only.`,
      provider: d.provider,
      model: d.modelEnv ? `env:${d.modelEnv}` : "local",
      params: e.kind === "text" ? { temperature: 0.7 } : {},
      outputSchema: e.id,
    };
    await prisma.employee.upsert({
      where: { id: e.id },
      update: { name: e.name, title: e.title, sortOrder: i },
      create: { id: e.id, name: e.name, title: e.title, sortOrder: i, activeVersion: 1 },
    });
    await prisma.skillVersion.upsert({
      where: { employeeId_version: { employeeId: e.id, version: 1 } },
      update: {},
      create: { employeeId: e.id, version: 1, skillJson: JSON.stringify(skill), note: "phase 0 placeholder" },
    });
  }
  await prisma.setting.upsert({
    where: { key: "seededAt" },
    update: { valueJson: JSON.stringify(new Date().toISOString()) },
    create: { key: "seededAt", valueJson: JSON.stringify(new Date().toISOString()) },
  });
  console.log(`Seeded ${ROSTER.length} employees (skill v1 placeholders).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
