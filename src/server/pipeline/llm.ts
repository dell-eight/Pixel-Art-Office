import { createHash } from "node:crypto";
import type { z } from "zod";
import type { TextProvider } from "@/server/providers/types";

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

/** Strip ```json fences that LLMs like to add. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced ? fenced[1] : text).trim());
}

/**
 * Ask a TextProvider for JSON, validate with zod, and on failure re-ask
 * with the validation error appended (spec: auto-retry with the error).
 */
export async function generateValidated<T>(
  provider: TextProvider,
  req: { role: string; system: string; user: string; params?: Record<string, unknown> },
  schema: z.ZodType<T>,
  maxAttempts = 3,
): Promise<{ value: T; attempts: number; raw: string }> {
  let user = req.user;
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await provider.generate({ ...req, user, json: true });
    try {
      const parsed = schema.safeParse(extractJson(res.text));
      if (parsed.success) return { value: parsed.data, attempts: attempt, raw: res.text };
      lastError = JSON.stringify(parsed.error.issues);
    } catch (e) {
      lastError = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
    }
    user = `${req.user}\n\nYour previous reply failed validation. Fix it and reply with JSON only.\nErrors: ${lastError}`;
  }
  throw new Error(`${req.role}: output failed validation after ${maxAttempts} attempts: ${lastError}`);
}
