/**
 * Stage names and State machine states.
 * States:
 * BRIEFED -> SCRIPTING -> SCRIPT_REVIEW (human gate) -> parallel [ART_PLANNING -> ILLUSTRATING -> KEYFRAME_REVIEW (human gate)] and [VOICING] -> ANIMATING -> EDITING -> SOCIAL -> READY_TO_POST -> DONE
 * Plus: ERROR, PAUSED_BUDGET
 */

export const JOB_STATES = [
  "BRIEFED",
  "SCRIPTING",
  "SCRIPT_REVIEW",
  "ART_PLANNING",
  "ILLUSTRATING",
  "KEYFRAME_REVIEW",
  "VOICING",
  "ANIMATING",
  "EDITING",
  "SOCIAL",
  "READY_TO_POST",
  "DONE",
  "REJECTED",
  "ERROR",
  "PAUSED_BUDGET",
] as const;

export type JobState = (typeof JOB_STATES)[number];

export const GATES = ["SCRIPT_REVIEW", "KEYFRAME_REVIEW"] as const;
export type GateName = (typeof GATES)[number];
export type GateDecisionKind = "approved" | "request_changes" | "rejected";

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 200,
  backoffFactor: 2,
  maxDelayMs: 2000,
};

export const REROLL_CAPS: Record<string, number> = {
  producer: 3,
  scriptwriter: 3,
  artDirector: 3,
  illustrator: 3,
  animator: 4,
  voiceActor: 3,
  editor: 2,
  socialManager: 2,
};
