import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => (v ?? "true").trim().toLowerCase() !== "false");
const boolDefaultFalse = z
  .string()
  .optional()
  .transform((v) => (v ?? "false").trim().toLowerCase() === "true");
const optStr = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  MOCK_MODE: bool,
  MOCK_STAGE_MS: z.coerce.number().int().min(0).default(4000),
  MOCK_AUTO_APPROVE: boolDefaultFalse,
  DATA_DIR: z.string().default("./data"),
  FFMPEG_PATH: optStr,
  GEMINI_API_KEY: optStr,
  ELEVENLABS_API_KEY: optStr,
  VIDU_API_KEY: optStr,
  OPENAI_API_KEY: optStr,
  KLING_API_KEY: optStr,
  GEMINI_TEXT_MODEL: optStr,
  GEMINI_IMAGE_MODEL: optStr,
  VEO_MODEL: optStr,
  VIDU_MODEL: optStr,
  ELEVENLABS_MODEL: optStr,
  ELEVENLABS_VOICE_ID: optStr,
  BUDGET_CAP_PHP: z.coerce.number().positive().default(6000),
  FX_USD_PHP: z.coerce.number().positive().default(58),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error("Invalid environment:\n" + z.prettifyError(parsed.error));
    }
    cached = parsed.data;
  }
  return cached;
}

export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().DATA_DIR);
}
