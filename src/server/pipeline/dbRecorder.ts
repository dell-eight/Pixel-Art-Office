import type { PrismaClient } from "@prisma/client";
import type { Role } from "@/shared/roster";
import type { CachedStageRun, Recorder } from "./recorder";

/** Persists job state, stage runs, artifacts and logs to SQL Server via Prisma. */
export class DbRecorder implements Recorder {
  constructor(
    private db: PrismaClient,
    private jobId: string,
    private echo = true,
    private autoApproveGates = true,
  ) {}

  async setState(state: string, error?: string) {
    await this.db.job.update({ where: { id: this.jobId }, data: { state, error: error ?? null } });
    if (this.echo) console.log(`  [state] ${state}${error ? ` - ${error}` : ""}`);
  }

  async stageStart(stage: string, employee: Role, inputHash: string) {
    const run = await this.db.stageRun.create({
      data: { jobId: this.jobId, stage, employeeId: employee, status: "running", inputHash },
    });
    if (this.echo) console.log(`  [${employee}] ${stage} ...`);
    return run.id;
  }

  async stageEnd(runId: string, status: "done" | "error", output?: unknown, error?: string) {
    await this.db.stageRun.update({
      where: { id: runId },
      data: {
        status,
        outputJson: output === undefined ? null : JSON.stringify(output),
        error: error ?? null,
        finishedAt: new Date(),
      },
    });
    if (this.echo && status === "error") console.log(`    x ${error}`);
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

  async findCachedRun(stage: string, inputHash: string): Promise<CachedStageRun | null> {
    const run = await this.db.stageRun.findFirst({
      where: {
        stage,
        inputHash,
        status: "done",
      },
      orderBy: { finishedAt: "desc" },
    });
    if (!run) return null;
    return { status: run.status, outputJson: run.outputJson };
  }

  async getGateDecision(gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW") {
    const dec = await this.db.gateDecision.findFirst({
      where: { jobId: this.jobId, gate },
      orderBy: { createdAt: "desc" },
    });
    if (dec) {
      return {
        decision: dec.decision as "approved" | "rejected",
        comment: dec.comment ?? undefined,
      };
    }
    if (this.autoApproveGates) {
      await this.db.gateDecision.create({
        data: {
          jobId: this.jobId,
          gate,
          decision: "approved",
          comment: "auto-approved in mock/demo mode",
        },
      });
      return { decision: "approved" as const, comment: "auto-approved in mock/demo mode" };
    }
    return { decision: "waiting" as const };
  }
}
