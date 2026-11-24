import type { Role } from "@/shared/roster";

export interface GateDecisionRecord {
  id?: string;
  decision: "approved" | "request_changes" | "rejected" | "waiting";
  comment?: string;
  frameIndex?: number;
}

export interface RevisionRequest {
  id: string;
  comment: string;
  frameIndex?: number;
}

/**
 * Gate check provider interface: returns whether a gate is approved, request_changes, rejected, or waiting.
 */
export interface GateChecker {
  checkGate(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<GateDecisionRecord>;
}

export interface CachedStageRun {
  status: string;
  outputJson: string | null;
}

export interface RecordedStudioEvent {
  kind: "state" | "stage:start" | "stage:progress" | "stage:end" | "handoff" | "gate:waiting" | "log";
  stage?: string;
  employee?: Role | null;
  progress?: number;
  fromDesk?: string;
  toDesk?: string;
  gate?: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW";
  message?: string;
}

export function parseFramePrefix(comment?: string | null): { frameIndex?: number; cleanComment: string } {
  const text = (comment ?? "").trim();
  const match = text.match(/^\[Frame\s+K(\d+)\]\s*([\s\S]*)$/i);
  if (!match) return { cleanComment: text };
  return {
    frameIndex: Number(match[1]),
    cleanComment: match[2].trim(),
  };
}

/** Where the pipeline reports progress. DB-backed in the app, console-only as fallback. */
export interface Recorder {
  setState(state: string, error?: string): Promise<void>;
  stageStart(stage: string, employee: Role, inputHash: string): Promise<string>;
  stageProgress?(stage: string, employee: Role, progress: number, message?: string): Promise<void>;
  stageEnd(runId: string, status: "done" | "error", output?: unknown, error?: string): Promise<void>;
  handoff?(fromDesk: string, toDesk: string, message?: string): Promise<void>;
  gateWaiting?(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW", message?: string): Promise<void>;
  artifact(kind: string, filePath: string, mime: string, meta?: unknown): Promise<void>;
  log(level: "info" | "warn" | "error", employee: Role | null, message: string, data?: unknown): Promise<void>;
  findCachedRun?(stage: string, inputHash: string, opts?: { sameJobOnly?: boolean }): Promise<CachedStageRun | null>;
  getGateDecision?(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<GateDecisionRecord>;
  getLatestRevision?(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<RevisionRequest | null>;
}

export class ConsoleRecorder implements Recorder {
  private n = 0;
  private gSeq = 0;
  private cache = new Map<string, CachedStageRun>();
  private runMeta = new Map<string, { stage: string; employee: Role; inputHash: string }>();
  private gateHistory: Record<
    "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
    Array<{ id: string; decision: "approved" | "request_changes" | "rejected"; comment?: string; frameIndex?: number }>
  > = {
    SCRIPT_REVIEW: [],
    KEYFRAME_REVIEW: [],
  };
  public readonly events: RecordedStudioEvent[] = [];

  constructor(private autoApproveGates = true) {}

  setGateDecision(
    gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
    decision: "approved" | "request_changes" | "rejected",
    comment?: string,
    frameIndex?: number,
  ) {
    this.gateHistory[gate].push({
      id: `gate-${++this.gSeq}`,
      decision,
      comment,
      frameIndex,
    });
  }

  async setState(state: string, error?: string) {
    this.events.push({ kind: "state", stage: state, message: error });
    console.log(`  [state] ${state}${error ? ` - ${error}` : ""}`);
  }

  async stageStart(stage: string, employee: Role, inputHash: string) {
    const id = `run-${++this.n}`;
    this.runMeta.set(id, { stage, employee, inputHash });
    this.events.push({ kind: "stage:start", stage, employee, progress: 0 });
    console.log(`  [${employee}] ${stage} ...`);
    return id;
  }

  async stageProgress(stage: string, employee: Role, progress: number, message?: string) {
    this.events.push({ kind: "stage:progress", stage, employee, progress, message });
  }

  async stageEnd(id: string, status: "done" | "error", output?: unknown, error?: string) {
    const meta = this.runMeta.get(id);
    if (status === "done" && meta && output !== undefined) {
      this.cache.set(`${meta.stage}:${meta.inputHash}`, {
        status: "done",
        outputJson: JSON.stringify(output),
      });
    }
    this.events.push({
      kind: "stage:end",
      stage: meta?.stage,
      employee: meta?.employee,
      progress: status === "done" ? 100 : undefined,
      message: error,
    });
    if (status === "error") console.log(`    x ${error}`);
  }

  async handoff(fromDesk: string, toDesk: string, message?: string) {
    this.events.push({ kind: "handoff", fromDesk, toDesk, message });
  }

  async gateWaiting(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW", message?: string) {
    this.events.push({ kind: "gate:waiting", gate, message: message ?? `Waiting at ${gate}` });
  }

  async artifact(kind: string, filePath: string) {
    console.log(`    + ${kind}: ${filePath}`);
  }

  async log(level: string, employee: Role | null, message: string) {
    this.events.push({ kind: "log", employee, message });
    if (level !== "info") console.log(`  [${level}] ${employee ?? "system"}: ${message}`);
  }

  async findCachedRun(stage: string, inputHash: string): Promise<CachedStageRun | null> {
    return this.cache.get(`${stage}:${inputHash}`) ?? null;
  }

  async getGateDecision(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<GateDecisionRecord> {
    const history = this.gateHistory[gate];
    const latest = history.at(-1);
    if (latest) return latest;
    if (this.autoApproveGates) {
      return { decision: "approved", comment: "auto-approved in console mode" };
    }
    return { decision: "waiting" };
  }

  async getLatestRevision(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<RevisionRequest | null> {
    const history = this.gateHistory[gate];
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.decision === "request_changes") {
        return {
          id: h.id,
          comment: h.comment ?? "",
          frameIndex: h.frameIndex,
        };
      }
    }
    return null;
  }
}
