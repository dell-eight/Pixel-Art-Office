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

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Ask a TextProvider for JSON, validate with zod, and on failure re-ask
 * with the validation error appended (spec: auto-retry with backoff).
 */
export async function generateValidated<T>(
  provider: TextProvider,
  req: { role: string; system: string; user: string; params?: Record<string, unknown> },
  schema: z.ZodType<T>,
  opts: RetryOptions = {},
): Promise<{ value: T; attempts: number; raw: string }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let delay = opts.initialDelayMs ?? 100;
  const backoff = opts.backoffFactor ?? 2;

  let user = req.user;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await provider.generate({ ...req, user, json: true });
      const parsed = schema.safeParse(extractJson(res.text));
      if (parsed.success) {
        return { value: parsed.data, attempts: attempt, raw: res.text };
      }
      lastError = JSON.stringify(parsed.error.issues);
    } catch (e) {
      lastError = `Invalid JSON or execution error: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (attempt < maxAttempts) {
      user = `${req.user}\n\nYour previous reply failed validation. Fix it and reply with strictly valid JSON only.\nErrors: ${lastError}`;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoff;
    }
  }

  throw new Error(`${req.role}: output failed validation after ${maxAttempts} attempts: ${lastError}`);
}
