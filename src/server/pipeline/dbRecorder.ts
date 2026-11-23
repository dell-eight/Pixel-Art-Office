import type { PrismaClient } from "@prisma/client";
import type { Role } from "@/shared/roster";
import type { Recorder } from "./recorder";

/** Persists job state, stage runs, artifacts and logs to SQL Server via Prisma. */
export class DbRecorder implements Recorder {
  constructor(
    private db: PrismaClient,
    private jobId: string,
    private echo = true,
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
}
