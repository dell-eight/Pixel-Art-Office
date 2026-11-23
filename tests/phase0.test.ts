import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateValidated } from "@/server/pipeline/llm";
import { runMockPipeline } from "@/server/pipeline/mockRun";
import { ConsoleRecorder } from "@/server/pipeline/recorder";
import { MockTextProvider, mockWordTimestamps, pngSize } from "@/server/providers/mock";
import type { TextProvider } from "@/server/providers/types";
import { ROLES } from "@/shared/roster";
import { ScriptSchema, SocialSchema } from "@/shared/schemas";

describe("mock fixtures", () => {
  it("every text fixture passes its zod schema", async () => {
    const t = new MockTextProvider();
    const s = await generateValidated(t, { role: "scriptwriter", system: "", user: "" }, ScriptSchema);
    expect(s.attempts).toBe(1);
    const total = s.value.beats.reduce((a, b) => a + b.seconds, 0);
    expect(total).toBeGreaterThanOrEqual(20);
    expect(total).toBeLessThanOrEqual(35);
    const social = await generateValidated(t, { role: "socialManager", system: "", user: "" }, SocialSchema);
    for (const p of social.value.posts) expect(p.aiDisclosure.length).toBeGreaterThan(0);
  });

  it("roster has 8 employees", () => expect(ROLES).toHaveLength(8));
});

describe("generateValidated", () => {
  it("re-asks with the validation error and succeeds on a later attempt", async () => {
    const prompts: string[] = [];
    let n = 0;
    const flaky: TextProvider = {
      name: "flaky",
      generate: async (req) => {
        prompts.push(req.user);
        n++;
        const text = n === 1 ? "not json" : n === 2 ? '{"posts": []}' : (await new MockTextProvider().generate(req)).text;
        return { text, meta: { provider: "flaky", model: "x", unit: "tokens", units: 1, latencyMs: 0 } };
      },
    };
    const r = await generateValidated(flaky, { role: "socialManager", system: "", user: "brief" }, SocialSchema);
    expect(r.attempts).toBe(3);
    expect(prompts[1]).toContain("Invalid JSON");
    expect(prompts[2]).toContain("failed validation");
  });
});

describe("mock word timestamps", () => {
  it("are monotonic and non-overlapping", () => {
    const w = mockWordTimestamps("You do X, but problem Y, so you add Z.");
    expect(w).toHaveLength(10);
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].end);
  });
});

describe("mock pipeline end-to-end (real ffmpeg)", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "pao-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("produces N+1 same-size keyframes and a reel", async () => {
    const res = await runMockPipeline(
      { topic: "test topic", audience: "general", platforms: ["tiktok"], tone: "x" },
      dir,
      new ConsoleRecorder(),
    );
    expect(res.keyframes).toHaveLength(res.clips.length + 1);
    const sizes = await Promise.all(res.keyframes.map(pngSize));
    for (const s of sizes) expect(s).toEqual({ width: 1080, height: 1920 });
    expect(res.durationSec).toBe(24);
  });
});
