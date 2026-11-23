import type { Role } from "@/shared/roster";

/**
 * Gate check provider interface: returns whether a gate is approved, rejected, or waiting.
 */
export interface GateChecker {
  checkGate(
    gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
  ): Promise<{ decision: "approved" | "rejected" | "waiting"; comment?: string }>;
}

export interface CachedStageRun {
  status: string;
  outputJson: string | null;
}

/** Where the pipeline reports progress. DB-backed in the app, console-only as fallback. */
export interface Recorder {
  setState(state: string, error?: string): Promise<void>;
  stageStart(stage: string, employee: Role, inputHash: string): Promise<string>;
  stageEnd(runId: string, status: "done" | "error", output?: unknown, error?: string): Promise<void>;
  artifact(kind: string, filePath: string, mime: string, meta?: unknown): Promise<void>;
  log(level: "info" | "warn" | "error", employee: Role | null, message: string, data?: unknown): Promise<void>;
  findCachedRun?(stage: string, inputHash: string): Promise<CachedStageRun | null>;
  getGateDecision?(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<{ decision: "approved" | "rejected" | "waiting"; comment?: string }>;
}

export class ConsoleRecorder implements Recorder {
  private n = 0;
  private cache = new Map<string, CachedStageRun>();

  constructor(private autoApproveGates = true) {}

  async setState(state: string, error?: string) {
    console.log(`  [state] ${state}${error ? ` - ${error}` : ""}`);
  }
  async stageStart(stage: string, employee: Role, inputHash: string) {
    console.log(`  [${employee}] ${stage} ...`);
    return `run-${++this.n}`;
  }
  async stageEnd(_id: string, status: "done" | "error", output?: unknown, error?: string) {
    if (status === "error") console.log(`    x ${error}`);
  }
  async artifact(kind: string, filePath: string) {
    console.log(`    + ${kind}: ${filePath}`);
  }
  async log(level: string, employee: Role | null, message: string) {
    if (level !== "info") console.log(`  [${level}] ${employee ?? "system"}: ${message}`);
  }
  async findCachedRun(stage: string, inputHash: string): Promise<CachedStageRun | null> {
    return this.cache.get(`${stage}:${inputHash}`) ?? null;
  }
  async getGateDecision(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW") {
    if (this.autoApproveGates) {
      return { decision: "approved" as const, comment: "auto-approved in console mode" };
    }
    return { decision: "waiting" as const };
  }
}
