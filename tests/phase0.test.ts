import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateValidated } from "@/server/pipeline/llm";
import { ConsoleRecorder } from "@/server/pipeline/recorder";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";
import { MockTextProvider, mockWordTimestamps, pngSize } from "@/server/providers/mock";
import type { TextProvider } from "@/server/providers/types";
import { ROLES } from "@/shared/roster";
import { ScriptSchema, SocialSchema } from "@/shared/schemas";

describe("mock fixtures & schemas", () => {
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

describe("generateValidated with retries", () => {
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
    const r = await generateValidated(flaky, { role: "socialManager", system: "", user: "brief" }, SocialSchema, {
      maxAttempts: 3,
      initialDelayMs: 10,
    });
    expect(r.attempts).toBe(3);
    expect(prompts[1]).toContain("Invalid JSON");
    expect(prompts[2]).toContain("failed validation");
  });
});

describe("word timestamps", () => {
  it("are monotonic and non-overlapping", () => {
    const w = mockWordTimestamps("You do X, but problem Y, so you add Z.");
    expect(w).toHaveLength(10);
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].end);
  });
});

describe("Phase 1 State Machine Pipeline", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "pao-sm-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("executes the full state machine to DONE with auto-approved gates", async () => {
    const rec = new ConsoleRecorder(true);
    const res = await runStateMachinePipeline(
      { topic: "test aquaponics system", audience: "general", platforms: ["tiktok"], tone: "friendly" },
      dir,
      rec,
      { autoApproveGates: true },
    );

    expect(res.state).toBe("DONE");
    expect(res.keyframes).toHaveLength((res.clips?.length ?? 0) + 1);
    const sizes = await Promise.all((res.keyframes ?? []).map(pngSize));
    for (const s of sizes) expect(s).toEqual({ width: 1080, height: 1920 });
    expect(res.durationSec).toBe(24);
  });

  it("pauses at SCRIPT_REVIEW when gate is not auto-approved", async () => {
    const pauseDir = path.join(dir, "paused-gate");
    const rec = new ConsoleRecorder(false); // autoApprove = false
    const res = await runStateMachinePipeline(
      { topic: "test aquaponics system", audience: "general", platforms: ["tiktok"], tone: "friendly" },
      pauseDir,
      rec,
      { autoApproveGates: false },
    );

    expect(res.state).toBe("SCRIPT_REVIEW");
    expect(res.waitingGate).toBe("SCRIPT_REVIEW");
  });

  it("enforces visible stageDelayMs and emits start, progress, end, and courier handoff events", async () => {
    const animDir = path.join(dir, "visible-delay");
    const rec = new ConsoleRecorder(false);
    const t0 = Date.now();
    const res = await runStateMachinePipeline(
      { topic: "rainwater harvesting barrel", audience: "general", platforms: ["tiktok"], tone: "curious" },
      animDir,
      rec,
      { autoApproveGates: false, stageDelayMs: 250 },
    );
    const elapsed = Date.now() - t0;

    expect(res.state).toBe("SCRIPT_REVIEW");
    // 2 stages (BRIEFED + SCRIPTING) * 250ms + 2 handoffs * 250ms >= 900ms
    expect(elapsed).toBeGreaterThanOrEqual(800);

    const starts = rec.events.filter((e) => e.kind === "stage:start");
    const progresses = rec.events.filter((e) => e.kind === "stage:progress");
    const ends = rec.events.filter((e) => e.kind === "stage:end");
    const handoffs = rec.events.filter((e) => e.kind === "handoff");

    expect(starts.map((e) => e.stage)).toEqual(["BRIEFED", "SCRIPTING"]);
    expect(progresses.map((e) => e.progress)).toEqual([25, 50, 75, 25, 50, 75]);
    expect(ends.map((e) => e.stage)).toEqual(["BRIEFED", "SCRIPTING"]);
    expect(handoffs.map((e) => [e.fromDesk, e.toDesk])).toEqual([
      ["producer", "scriptwriter"],
      ["scriptwriter", "SCRIPT_REVIEW"],
    ]);
  });

  it("resumes cleanly through Gate 1 (SCRIPT_REVIEW) and Gate 2 (KEYFRAME_REVIEW) to DONE", async () => {
    const gateDir = path.join(dir, "two-gates");
    const rec = new ConsoleRecorder(false);
    const brief = { topic: "backyard compost setup", audience: "general", platforms: ["tiktok" as const], tone: "friendly" };

    // Run 1: stops at Gate 1
    const r1 = await runStateMachinePipeline(brief, gateDir, rec, {
      autoApproveGates: false,
      enableCache: true,
      sameJobCacheOnly: true,
    });
    expect(r1.state).toBe("SCRIPT_REVIEW");
    expect(r1.waitingGate).toBe("SCRIPT_REVIEW");

    // Approve Gate 1 -> resumes and stops at Gate 2
    rec.setGateDecision("SCRIPT_REVIEW", "approved", "looks good");
    const r2 = await runStateMachinePipeline(brief, gateDir, rec, {
      autoApproveGates: false,
      enableCache: true,
      sameJobCacheOnly: true,
    });
    expect(r2.state).toBe("KEYFRAME_REVIEW");
    expect(r2.waitingGate).toBe("KEYFRAME_REVIEW");

    // Approve Gate 2 -> finishes to DONE
    rec.setGateDecision("KEYFRAME_REVIEW", "approved", "nice frames");
    const r3 = await runStateMachinePipeline(brief, gateDir, rec, {
      autoApproveGates: false,
      enableCache: true,
      sameJobCacheOnly: true,
    });
    expect(r3.state).toBe("DONE");
    expect(r3.reelPath).toBeTruthy();

    // Every stage ran exactly once across the 3 invocations (cached stages were not re-executed)
    const stageStarts = rec.events.filter((e) => e.kind === "stage:start").map((e) => e.stage);
    expect(stageStarts.filter((s) => s === "BRIEFED")).toHaveLength(1);
    expect(stageStarts.filter((s) => s === "SCRIPTING")).toHaveLength(1);
    expect(stageStarts.filter((s) => s === "ART_PLANNING")).toHaveLength(1);
    expect(stageStarts.filter((s) => s === "ILLUSTRATING")).toHaveLength(1);
    expect(stageStarts.filter((s) => s === "VOICING")).toHaveLength(1);
    expect(stageStarts.filter((s) => s === "ANIMATING")).toHaveLength(1);
    expect(stageStarts.filter((s) => s === "EDITING")).toHaveLength(1);
    expect(stageStarts.filter((s) => s === "SOCIAL")).toHaveLength(1);
  });
});
