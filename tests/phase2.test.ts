import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { ConsoleRecorder } from "@/server/pipeline/recorder";
import { getEmployeeSkill, type LoadedSkill } from "@/server/pipeline/skills";
import { runStateMachinePipeline } from "@/server/pipeline/stateMachine";
import { MockImageProvider, MockTextProvider } from "@/server/providers/mock";
import { providers } from "@/server/providers/registry";
import type { TextRequest } from "@/server/providers/types";
import { EMPLOYEE_CHECKLISTS } from "@/shared/checklists";
import type { Role } from "@/shared/roster";

describe("Phase 2 gate reviews & versioned skills", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "pao-p2-"));
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("Gate 1 request_changes reruns SCRIPTING with the note and returns to SCRIPT_REVIEW", async () => {
    const jobDir = path.join(dir, "gate1-rev");
    const rec = new ConsoleRecorder(false);
    const brief = { topic: "rainwater barrel", audience: "general", platforms: ["tiktok" as const], tone: "curious" };

    const captured: TextRequest[] = [];
    const baseText = new MockTextProvider();
    const spyText = vi.spyOn(providers, "text").mockReturnValue({
      name: "mock-spy",
      generate: async (req) => {
        captured.push(req);
        return baseText.generate(req);
      },
    });

    try {
      const r1 = await runStateMachinePipeline(brief, jobDir, rec, {
        autoApproveGates: false,
        enableCache: true,
        sameJobCacheOnly: true,
      });
      expect(r1.state).toBe("SCRIPT_REVIEW");

      const note = "Make the hook punchier and mention rain barrel overflow";
      rec.setGateDecision("SCRIPT_REVIEW", "request_changes", note);

      const r2 = await runStateMachinePipeline(brief, jobDir, rec, {
        autoApproveGates: false,
        enableCache: true,
        sameJobCacheOnly: true,
      });
      expect(r2.state).toBe("SCRIPT_REVIEW");
      expect(r2.waitingGate).toBe("SCRIPT_REVIEW");

      const scriptCalls = captured.filter((c) => c.role === "scriptwriter");
      expect(scriptCalls).toHaveLength(2);
      expect(scriptCalls[1].user).toContain(note);

      // Producer remained cached across the revision; Art never ran yet
      expect(captured.filter((c) => c.role === "producer")).toHaveLength(1);
      expect(captured.filter((c) => c.role === "artDirector")).toHaveLength(0);
    } finally {
      spyText.mockRestore();
    }
  });

  it("Gate 2 single-frame request_changes reruns only that frame without rerunning VOICING and returns to KEYFRAME_REVIEW", async () => {
    const jobDir = path.join(dir, "gate2-single-frame");
    const rec = new ConsoleRecorder(false);
    const brief = { topic: "smart home panel", audience: "general", platforms: ["tiktok" as const], tone: "friendly" };

    const editInstructions: string[] = [];
    let t2iCount = 0;
    const baseImg = new MockImageProvider();
    const spyImg = vi.spyOn(providers, "image").mockReturnValue({
      name: "mock-img-spy",
      textToImage: async (req) => {
        t2iCount++;
        return baseImg.textToImage(req);
      },
      editImage: async (req) => {
        editInstructions.push(req.instruction);
        return baseImg.editImage(req);
      },
    });

    try {
      // Run 1 -> Gate 1
      const r1 = await runStateMachinePipeline(brief, jobDir, rec, { autoApproveGates: false });
      expect(r1.state).toBe("SCRIPT_REVIEW");

      // Approve Gate 1 -> Gate 2
      rec.setGateDecision("SCRIPT_REVIEW", "approved");
      const r2 = await runStateMachinePipeline(brief, jobDir, rec, { autoApproveGates: false });
      expect(r2.state).toBe("KEYFRAME_REVIEW");
      expect(t2iCount).toBe(1);
      expect(editInstructions).toHaveLength(4);

      const k0Before = (await stat(path.join(jobDir, "keyframes", "k00.png"))).mtimeMs;
      const k2Before = (await stat(path.join(jobDir, "keyframes", "k02.png"))).mtimeMs;

      // Wait briefly so mtime difference is observable on Windows
      await new Promise((r) => setTimeout(r, 40));

      // Request changes on single frame K2
      const note = "Make the desk lamp bright amber";
      rec.setGateDecision("KEYFRAME_REVIEW", "request_changes", note, 2);

      const r3 = await runStateMachinePipeline(brief, jobDir, rec, { autoApproveGates: false });
      expect(r3.state).toBe("KEYFRAME_REVIEW");
      expect(r3.waitingGate).toBe("KEYFRAME_REVIEW");

      // K0 was NOT regenerated; only 1 editImage call happened for K2 with the note
      expect(t2iCount).toBe(1);
      expect(editInstructions).toHaveLength(5);
      expect(editInstructions[4]).toContain(note);

      const k0After = (await stat(path.join(jobDir, "keyframes", "k00.png"))).mtimeMs;
      const k2After = (await stat(path.join(jobDir, "keyframes", "k02.png"))).mtimeMs;
      expect(k0After).toBe(k0Before);
      expect(k2After).toBeGreaterThan(k2Before);

      // VOICING ran only once (cached on Gate 2 revision)
      const voiceStarts = rec.events.filter((e) => e.kind === "stage:start" && e.stage === "VOICING");
      expect(voiceStarts).toHaveLength(1);
    } finally {
      spyImg.mockRestore();
    }
  });

  it("rejecting at Gate 1 stops the job in REJECTED state without running downstream stages", async () => {
    const jobDir = path.join(dir, "gate1-reject");
    const rec = new ConsoleRecorder(false);
    const brief = { topic: "off-grid solar", audience: "general", platforms: ["tiktok" as const], tone: "curious" };

    const r1 = await runStateMachinePipeline(brief, jobDir, rec, { autoApproveGates: false });
    expect(r1.state).toBe("SCRIPT_REVIEW");

    rec.setGateDecision("SCRIPT_REVIEW", "rejected", "Topic does not match channel fit");
    const r2 = await runStateMachinePipeline(brief, jobDir, rec, { autoApproveGates: false });

    expect(r2.state).toBe("REJECTED");
    expect(r2.error).toContain("Topic does not match channel fit");
    expect(rec.events.some((e) => e.stage === "ART_PLANNING")).toBe(false);
    expect(rec.events.some((e) => e.stage === "ANIMATING")).toBe(false);
  });

  it("skill edits create a new version used by the next run, and rollback restores the older version", async () => {
    const versions: Record<number, string> = {
      1: "PROMPT_V1: Original scriptwriter instructions",
      2: "PROMPT_V2: Revised high-retention hook instructions",
    };
    let activeVersion = 1;

    const loadSkill = async (role: Role): Promise<LoadedSkill> => ({
      prompt: role === "scriptwriter" ? versions[activeVersion] : `Default ${role}`,
      provider: "mock",
      model: "mock-v1",
      params: { temperature: 0.7 },
      checklist: EMPLOYEE_CHECKLISTS[role],
      version: role === "scriptwriter" ? activeVersion : 1,
    });

    const captured: TextRequest[] = [];
    const baseText = new MockTextProvider();
    const spyText = vi.spyOn(providers, "text").mockReturnValue({
      name: "mock-spy",
      generate: async (req) => {
        captured.push(req);
        return baseText.generate(req);
      },
    });

    try {
      const brief = { topic: "tiny house wiring", audience: "general", platforms: ["tiktok" as const], tone: "curious" };
      const rec1 = new ConsoleRecorder(false);
      await runStateMachinePipeline(brief, path.join(dir, "skill-v1"), rec1, {
        autoApproveGates: false,
        loadSkill,
      });
      expect(captured.find((c) => c.role === "scriptwriter")?.system).toBe(versions[1]);

      // Edit skill -> v2
      activeVersion = 2;
      const rec2 = new ConsoleRecorder(false);
      await runStateMachinePipeline(brief, path.join(dir, "skill-v2"), rec2, {
        autoApproveGates: false,
        loadSkill,
      });
      const v2Calls = captured.filter((c) => c.role === "scriptwriter");
      expect(v2Calls).toHaveLength(2);
      expect(v2Calls[1].system).toBe(versions[2]);

      // Rollback to v1
      activeVersion = 1;
      const rec3 = new ConsoleRecorder(false);
      await runStateMachinePipeline(brief, path.join(dir, "skill-v1-rollback"), rec3, {
        autoApproveGates: false,
        loadSkill,
      });
      const v3Calls = captured.filter((c) => c.role === "scriptwriter");
      expect(v3Calls).toHaveLength(3);
      expect(v3Calls[2].system).toBe(versions[1]);
    } finally {
      spyText.mockRestore();
    }
  });

  it("getEmployeeSkill respects employee.activeVersion on rollback", async () => {
    const spy = vi.spyOn(prisma.employee, "findUnique").mockResolvedValue({
      id: "scriptwriter",
      name: "Sam",
      title: "Scriptwriter",
      sortOrder: 1,
      activeVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      skills: [
        {
          id: "s2",
          employeeId: "scriptwriter",
          version: 2,
          skillJson: JSON.stringify({ prompt: "V2_PROMPT", provider: "gemini", model: "env:GEMINI_TEXT_MODEL", params: {} }),
          note: "v2",
          createdAt: new Date(),
        },
        {
          id: "s1",
          employeeId: "scriptwriter",
          version: 1,
          skillJson: JSON.stringify({ prompt: "V1_PROMPT", provider: "gemini", model: "env:GEMINI_TEXT_MODEL", params: {} }),
          note: "v1",
          createdAt: new Date(),
        },
      ],
    } as any);

    try {
      const loaded = await getEmployeeSkill("scriptwriter");
      expect(loaded.version).toBe(1);
      expect(loaded.prompt).toBe("V1_PROMPT");
    } finally {
      spy.mockRestore();
    }
  });
});
