import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Role } from "@/shared/roster";

export type StudioEventType =
  | "stage:start"
  | "stage:progress"
  | "stage:end"
  | "gate:waiting"
  | "gate:resolved"
  | "courier:handoff"
  | "job:state"
  | "job:done"
  | "job:error"
  | "demo:reset";

export interface StudioEvent {
  id: string;
  type: StudioEventType;
  jobId: string;
  jobTitle?: string;
  stage?: string;
  employee?: Role | null;
  progress?: number;
  fromDesk?: string;
  toDesk?: string;
  gate?: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW";
  message: string;
  level: "info" | "warn" | "error";
  timestamp: string;
}

const MAX_RECENT_EVENTS = 50;

interface StudioBus {
  emitter: EventEmitter;
  recent: StudioEvent[];
}

const g = globalThis as unknown as { __studioEventBus?: StudioBus };

function bus(): StudioBus {
  if (!g.__studioEventBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    g.__studioEventBus = { emitter, recent: [] };
  }
  return g.__studioEventBus;
}

export function emitStudioEvent(
  partial: Omit<StudioEvent, "id" | "timestamp" | "level"> & {
    id?: string;
    timestamp?: string;
    level?: "info" | "warn" | "error";
  },
): StudioEvent {
  const evt: StudioEvent = {
    id: partial.id ?? randomUUID(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
    level: partial.level ?? "info",
    ...partial,
  };
  const b = bus();
  b.recent.push(evt);
  if (b.recent.length > MAX_RECENT_EVENTS) {
    b.recent.splice(0, b.recent.length - MAX_RECENT_EVENTS);
  }
  b.emitter.emit("event", evt);
  return evt;
}

export function subscribeStudioEvents(fn: (evt: StudioEvent) => void): () => void {
  const b = bus();
  b.emitter.on("event", fn);
  return () => {
    b.emitter.off("event", fn);
  };
}

export function getRecentStudioEvents(): StudioEvent[] {
  return [...bus().recent];
}

export function clearStudioEvents(): void {
  bus().recent = [];
}
