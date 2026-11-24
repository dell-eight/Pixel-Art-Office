import type { PrismaClient } from "@prisma/client";
import type { Role } from "@/shared/roster";
import { emitStudioEvent } from "./events";
import {
  parseFramePrefix,
  type CachedStageRun,
  type GateDecisionRecord,
  type Recorder,
  type RevisionRequest,
} from "./recorder";

const STAGE_ESTIMATES: Record<Role, { provider: string; model: string; units: number; estUsd: number }> = {
  producer: { provider: "mock", model: "mock-v1", units: 450, estUsd: 0.0005 },
  scriptwriter: { provider: "mock", model: "mock-v1", units: 700, estUsd: 0.0008 },
  artDirector: { provider: "mock", model: "mock-v1", units: 600, estUsd: 0.0007 },
  illustrator: { provider: "mock", model: "mock-v1", units: 5, estUsd: 0.04 },
  animator: { provider: "mock", model: "mock-v1", units: 24, estUsd: 0.15 },
  voiceActor: { provider: "mock", model: "mock-v1", units: 420, estUsd: 0.02 },
  editor: { provider: "ffmpeg", model: "local", units: 1, estUsd: 0 },
  socialManager: { provider: "mock", model: "mock-v1", units: 380, estUsd: 0.0004 },
};

/** Persists job state, stage runs, artifacts, ledger cost estimates and logs to SQL Server via Prisma, and emits SSE studio events. */
export class DbRecorder implements Recorder {
  private runMeta = new Map<string, { stage: string; employee: Role }>();

  constructor(
    private db: PrismaClient,
    private jobId: string,
    private echo = true,
    private autoApproveGates = false,
    private jobTitle = "",
  ) {}

  async setState(state: string, error?: string) {
    await this.db.job.update({ where: { id: this.jobId }, data: { state, error: error ?? null } });
    const evtType =
      state === "DONE"
        ? "job:done"
        : state === "ERROR" || state === "REJECTED"
          ? "job:error"
          : "job:state";
    emitStudioEvent({
      type: evtType,
      jobId: this.jobId,
      jobTitle: this.jobTitle,
      stage: state,
      level: state === "ERROR" || state === "REJECTED" ? "error" : "info",
      message: error ? `${state}: ${error}` : `Job moved to ${state}`,
    });
    if (this.echo) console.log(`  [state] ${state}${error ? ` - ${error}` : ""}`);
  }

  async stageStart(stage: string, employee: Role, inputHash: string) {
    const run = await this.db.stageRun.create({
      data: { jobId: this.jobId, stage, employeeId: employee, status: "running", inputHash },
    });
    this.runMeta.set(run.id, { stage, employee });
    const message = `Started ${stage}`;
    await this.db.logEntry.create({
      data: { jobId: this.jobId, employeeId: employee, level: "info", message },
    });
    emitStudioEvent({
      type: "stage:start",
      jobId: this.jobId,
      jobTitle: this.jobTitle,
      stage,
      employee,
      progress: 0,
      message,
    });
    if (this.echo) console.log(`  [${employee}] ${stage} ...`);
    return run.id;
  }

  async stageProgress(stage: string, employee: Role, progress: number, message?: string) {
    emitStudioEvent({
      type: "stage:progress",
      jobId: this.jobId,
      jobTitle: this.jobTitle,
      stage,
      employee,
      progress,
      message: message ?? `${stage} (${progress}%)`,
    });
  }

  async stageEnd(runId: string, status: "done" | "error", output?: unknown, error?: string) {
    const meta = this.runMeta.get(runId);
    await this.db.stageRun.update({
      where: { id: runId },
      data: {
        status,
        outputJson: output === undefined ? null : JSON.stringify(output),
        error: error ?? null,
        finishedAt: new Date(),
      },
    });
    const stage = meta?.stage ?? "STAGE";
    const employee = meta?.employee ?? null;

    if (status === "done" && employee) {
      const est = STAGE_ESTIMATES[employee];
      try {
        await this.db.ledgerEntry.create({
          data: {
            jobId: this.jobId,
            stageRunId: runId,
            provider: est.provider,
            model: est.model,
            units: est.units,
            estUsd: est.estUsd,
            actualUsd: est.estUsd,
            status: "committed",
          },
        });
      } catch {
        // ignore ledger error if offline
      }
    }

    const message = status === "done" ? `Finished ${stage}` : `Failed ${stage}: ${error ?? "unknown error"}`;
    await this.db.logEntry.create({
      data: {
        jobId: this.jobId,
        employeeId: employee,
        level: status === "error" ? "error" : "info",
        message,
      },
    });
    emitStudioEvent({
      type: status === "error" ? "job:error" : "stage:end",
      jobId: this.jobId,
      jobTitle: this.jobTitle,
      stage,
      employee,
      progress: status === "done" ? 100 : undefined,
      level: status === "error" ? "error" : "info",
      message,
    });
    if (this.echo && status === "error") console.log(`    x ${error}`);
  }

  async handoff(fromDesk: string, toDesk: string, message?: string) {
    const msg = message ?? `Folder handoff: ${fromDesk} -> ${toDesk}`;
    await this.db.logEntry.create({
      data: { jobId: this.jobId, employeeId: null, level: "info", message: msg },
    });
    emitStudioEvent({
      type: "courier:handoff",
      jobId: this.jobId,
      jobTitle: this.jobTitle,
      fromDesk,
      toDesk,
      message: msg,
    });
  }

  async gateWaiting(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW", message?: string) {
    emitStudioEvent({
      type: "gate:waiting",
      jobId: this.jobId,
      jobTitle: this.jobTitle,
      gate,
      stage: gate,
      message: message ?? `Waiting for human approval at ${gate}`,
    });
  }

  async artifact(kind: string, filePath: string, mime: string, meta?: unknown) {
    await this.db.artifact.create({
      data: { jobId: this.jobId, kind, path: filePath, mime, metaJson: meta === undefined ? null : JSON.stringify(meta) },
    });
    if (this.echo) console.log(`    + ${kind}: ${filePath}`);
  }

  async log(level: "info" | "warn" | "error", employee: Role | null, message: string, data?: unknown) {
    await this.db.logEntry.create({
      data: {
        jobId: this.jobId,
        employeeId: employee,
        level,
        message,
        dataJson: data === undefined ? null : JSON.stringify(data),
      },
    });
    if (this.echo && level !== "info") console.log(`  [${level}] ${employee ?? "system"}: ${message}`);
  }

  async findCachedRun(stage: string, inputHash: string, opts?: { sameJobOnly?: boolean }): Promise<CachedStageRun | null> {
    const run = await this.db.stageRun.findFirst({
      where: {
        ...(opts?.sameJobOnly ? { jobId: this.jobId } : {}),
        stage,
        inputHash,
        status: "done",
      },
      orderBy: [{ finishedAt: "desc" }, { startedAt: "desc" }],
    });
    if (!run) return null;
    return { status: run.status, outputJson: run.outputJson };
  }

  async getGateDecision(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<GateDecisionRecord> {
    const dec = await this.db.gateDecision.findFirst({
      where: { jobId: this.jobId, gate },
      orderBy: { createdAt: "desc" },
    });
    if (dec) {
      const { frameIndex, cleanComment } = parseFramePrefix(dec.comment);
      return {
        id: dec.id,
        decision: dec.decision as GateDecisionRecord["decision"],
        comment: cleanComment || undefined,
        frameIndex,
      };
    }
    if (this.autoApproveGates) {
      const created = await this.db.gateDecision.create({
        data: {
          jobId: this.jobId,
          gate,
          decision: "approved",
          comment: "auto-approved in mock/demo mode",
        },
      });
      return { id: created.id, decision: "approved", comment: "auto-approved in mock/demo mode" };
    }
    return { decision: "waiting" };
  }

  async getLatestRevision(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW"): Promise<RevisionRequest | null> {
    const rev = await this.db.gateDecision.findFirst({
      where: { jobId: this.jobId, gate, decision: "request_changes" },
      orderBy: { createdAt: "desc" },
    });
    if (!rev) return null;
    const { frameIndex, cleanComment } = parseFramePrefix(rev.comment);
    return {
      id: rev.id,
      comment: cleanComment,
      frameIndex,
    };
  }
}
