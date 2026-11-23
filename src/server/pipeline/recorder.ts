import type { Role } from "@/shared/roster";

/** Where the pipeline reports progress. DB-backed in the app, console-only as fallback. */
export interface Recorder {
  setState(state: string, error?: string): Promise<void>;
  stageStart(stage: string, employee: Role, inputHash: string): Promise<string>;
  stageEnd(runId: string, status: "done" | "error", output?: unknown, error?: string): Promise<void>;
  artifact(kind: string, filePath: string, mime: string, meta?: unknown): Promise<void>;
  log(level: "info" | "warn" | "error", employee: Role | null, message: string, data?: unknown): Promise<void>;
}

export class ConsoleRecorder implements Recorder {
  private n = 0;
  async setState(state: string, error?: string) {
    console.log(`  [state] ${state}${error ? ` - ${error}` : ""}`);
  }
  async stageStart(stage: string, employee: Role) {
    console.log(`  [${employee}] ${stage} ...`);
    return `run-${++this.n}`;
  }
  async stageEnd(_id: string, status: "done" | "error", _o?: unknown, error?: string) {
    if (status === "error") console.log(`    x ${error}`);
  }
  async artifact(kind: string, filePath: string) {
    console.log(`    + ${kind}: ${filePath}`);
  }
  async log(level: string, employee: Role | null, message: string) {
    if (level !== "info") console.log(`  [${level}] ${employee ?? "system"}: ${message}`);
  }
}
