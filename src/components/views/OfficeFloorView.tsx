"use client";

import React, { useState } from "react";
import { DiodeChip } from "@/components/ui/DiodeChip";
import { MechanicalButton } from "@/components/ui/MechanicalButton";
import type { Role } from "@/shared/roster";

export interface EmployeeInfo {
  id: Role;
  name: string;
  title: string;
  desk: string;
  status: "idle" | "thinking" | "working" | "done" | "error" | "waiting";
  progress?: number;
  taskMessage?: string;
  prop: string;
  color: string;
}

export interface GateInfo {
  name: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW";
  label: string;
  isWaiting: boolean;
  jobId?: string;
}

export interface CourierState {
  pos: string;
  fromDesk: string;
  toDesk: string;
  label: string;
  jobTitle: string;
  active: boolean;
}

export interface OfficeFloorViewProps {
  employees: EmployeeInfo[];
  selectedEmployee: Role | null;
  onSelectEmployee: (role: Role) => void;
  activeJob?: {
    id: string;
    title: string;
    state: string;
    progressPercent?: number;
  } | null;
  courier?: CourierState | null;
  gates: GateInfo[];
  onApproveGate: (
    jobId: string,
    gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
    decision: "approved" | "rejected",
    comment?: string,
  ) => void;
  inspectorData?: {
    skillPrompt?: string;
    provider?: string;
    model?: string;
    activeVersion?: number;
    latestOutput?: string;
    reelArtifactId?: string;
    logs?: { id: string; level: string; message: string; timestamp: string }[];
    spendJobEst?: number;
    spendMonthEst?: number;
  } | null;
}

/** Percentage coordinates inside the floor canvas so the courier walks directly between desks and gates. */
const COURIER_WAYPOINTS: Record<string, { x: number; y: number; label: string }> = {
  producer: { x: 12.5, y: 20, label: "Producer" },
  scriptwriter: { x: 37.5, y: 20, label: "Scriptwriter" },
  artDirector: { x: 62.5, y: 20, label: "Art Director" },
  illustrator: { x: 87.5, y: 20, label: "Illustrator" },
  SCRIPT_REVIEW: { x: 32, y: 50, label: "Gate 1" },
  KEYFRAME_REVIEW: { x: 68, y: 50, label: "Gate 2" },
  animator: { x: 12.5, y: 80, label: "Animator" },
  voiceActor: { x: 37.5, y: 80, label: "Voice Actor" },
  editor: { x: 62.5, y: 80, label: "Editor" },
  socialManager: { x: 87.5, y: 80, label: "Social Manager" },
  POSTED: { x: 94, y: 88, label: "Outbox" },
};

const PIPELINE_STEPS = [
  { key: "BRIEFED", label: "Brief" },
  { key: "SCRIPTING", label: "Script" },
  { key: "SCRIPT_REVIEW", label: "Gate 1" },
  { key: "ART_PLANNING", label: "Art" },
  { key: "ILLUSTRATING", label: "Frames" },
  { key: "KEYFRAME_REVIEW", label: "Gate 2" },
  { key: "ANIMATING", label: "Animate" },
  { key: "DONE", label: "Post" },
];

function stepIndexForState(state?: string): number {
  if (!state) return -1;
  const map: Record<string, number> = {
    BRIEFED: 0,
    SCRIPTING: 1,
    SCRIPT_REVIEW: 2,
    ART_PLANNING: 3,
    VOICING: 4,
    ILLUSTRATING: 4,
    KEYFRAME_REVIEW: 5,
    ANIMATING: 6,
    EDITING: 6,
    SOCIAL: 7,
    READY_TO_POST: 7,
    DONE: 8,
  };
  return map[state] ?? -1;
}

export function OfficeFloorView({
  employees,
  selectedEmployee,
  onSelectEmployee,
  activeJob,
  courier,
  gates,
  onApproveGate,
  inspectorData,
}: OfficeFloorViewProps) {
  const [inspectorTab, setInspectorTab] = useState<"skill" | "output" | "logs" | "cost">("skill");
  const [comment, setComment] = useState("");

  const activeEmp = employees.find((e) => e.id === selectedEmployee) ?? employees[0];
  const waitingGate = gates.find((g) => g.isWaiting);
  const topRow = employees.slice(0, 4);
  const bottomRow = employees.slice(4, 8);
  const currentStep = stepIndexForState(activeJob?.state);

  const courierCoord = courier ? COURIER_WAYPOINTS[courier.pos] ?? COURIER_WAYPOINTS.producer : null;

  const renderDeskCard = (emp: EmployeeInfo) => {
    const isSelected = selectedEmployee === emp.id;
    const isWorking = emp.status === "working" || emp.status === "thinking";
    const isWaiting = emp.status === "waiting";
    const isDone = emp.status === "done";

    return (
      <div
        key={emp.id}
        onClick={() => onSelectEmployee(emp.id)}
        className={`relative p-3 rounded border cursor-pointer select-none transition-all ${
          isWorking
            ? "bg-surface-container border-primary shadow-[0_0_16px_rgba(245,158,11,0.35)] ring-1 ring-primary"
            : isWaiting
              ? "bg-primary-container/10 border-primary/80 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
              : isSelected
                ? "bg-surface-container border-secondary/70 shadow-[0_0_10px_rgba(78,222,163,0.18)] ring-1 ring-secondary/60"
                : isDone
                  ? "bg-[#191b27]/95 border-secondary/40 hover:border-secondary"
                  : "bg-[#191b27]/90 border-[#272a3b] hover:border-outline hover:bg-[#191b27]"
        }`}
      >
        {/* Working / Waiting Speech Bubble */}
        {(isWorking || isWaiting) && (
          <div className="absolute -top-2.5 right-2 px-2 py-0.5 rounded bg-primary-container text-[#0b0d19] font-mono text-[10px] font-bold shadow border border-primary z-20 animate-bounce">
            {isWorking
              ? `WORKING${typeof emp.progress === "number" ? ` ${emp.progress}%` : "..."}`
              : "AT GATE!"}
          </div>
        )}

        {/* Station Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-label-xs text-outline uppercase">{emp.desk}</span>
          <DiodeChip status={emp.status} />
        </div>

        {/* Character Avatar & Desk Prop */}
        <div className="flex items-center gap-2.5 my-2">
          <div
            className={`w-9 h-9 rounded border border-[#272a3b] flex items-center justify-center shrink-0 ${
              isWorking ? "animate-pixel-bob" : ""
            }`}
            style={{ backgroundColor: `${emp.color}25` }}
          >
            <svg
              className="w-6 h-6 pixelated"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="4" y="2" width="8" height="6" fill={emp.color} />
              <rect x="6" y="4" width="1" height="1" fill="#fff" />
              <rect x="9" y="4" width="1" height="1" fill="#fff" />
              <rect x="3" y="8" width="10" height="6" fill="#323441" />
              <rect x="5" y="14" width="2" height="2" fill="#11131e" />
              <rect x="9" y="14" width="2" height="2" fill="#11131e" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-headline font-bold text-headline-sm text-on-surface leading-tight">
              {emp.name}
            </div>
            <div className="font-mono text-[11px] leading-tight text-primary">{emp.title}</div>
          </div>
        </div>

        {/* Live Stage Progress Bar */}
        {isWorking && (
          <div className="mt-1 mb-2">
            <div className="w-full h-1.5 bg-surface-container-lowest border border-[#272a3b] rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(10, emp.progress ?? 15)}%` }}
              />
            </div>
            {emp.taskMessage && (
              <div className="font-mono text-[10px] text-primary/90 truncate mt-1">
                {emp.taskMessage}
              </div>
            )}
          </div>
        )}

        {/* Desk Prop Indicator */}
        <div className="flex items-center justify-between pt-2 border-t border-[#272a3b]/60 text-label-xs font-mono text-on-surface-variant">
          <span>PROP: {emp.prop}</span>
          <span className="material-symbols-outlined text-[14px]">desktop_windows</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full h-[calc(100vh-6.5rem)] gap-4 overflow-hidden">
      {/* Floor Area */}
      <div className="flex-1 flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-xl relative overflow-hidden">
        {/* Floor HUD strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-surface-container border-b border-[#272a3b] text-on-surface">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">domain</span>
            <span className="font-headline font-bold text-headline-sm uppercase">
              STUDIO FLOOR PLAN
            </span>
          </div>

          {/* 8-Segment Pipeline Progress Gauge */}
          <div className="hidden xl:flex items-center gap-1 bg-surface-container-lowest px-2 py-1 rounded border border-[#272a3b]">
            {PIPELINE_STEPS.map((st, idx) => {
              const done = currentStep > idx || activeJob?.state === "DONE";
              const active = currentStep === idx && activeJob?.state !== "DONE";
              return (
                <div
                  key={st.key}
                  title={st.label}
                  className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] font-bold transition-colors ${
                    done
                      ? "bg-secondary/25 text-secondary border border-secondary/40"
                      : active
                        ? "bg-primary-container text-[#0b0d19] animate-pulse"
                        : "bg-surface-container text-outline"
                  }`}
                >
                  {st.label}
                </div>
              );
            })}
          </div>

          {activeJob && (
            <div
              className={`flex items-center gap-2 px-2.5 py-0.5 bg-surface-container-lowest rounded border ${
                activeJob.state === "DONE" ? "border-secondary/40" : "border-primary/40"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  activeJob.state === "DONE" ? "text-secondary" : "text-primary animate-bounce"
                }`}
              >
                {activeJob.state === "DONE" ? "task_alt" : "folder"}
              </span>
              <span
                className={`font-mono text-label-sm font-bold truncate max-w-[200px] ${
                  activeJob.state === "DONE" ? "text-secondary" : "text-primary"
                }`}
              >
                {activeJob.title}
              </span>
              <span className="font-mono text-label-xs text-on-surface-variant">
                ({activeJob.state})
              </span>
            </div>
          )}
        </div>

        {/* Isometric Parquet Floor Canvas */}
        <div className="flex-1 bg-parquet relative p-5 flex flex-col justify-between gap-4 overflow-y-auto">
          {/* Row 1: Producer, Scriptwriter, Art Director, Illustrator */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            {topRow.map(renderDeskCard)}
          </div>

          {/* Interactive Gate Doors Corridor */}
          <div className="py-3 px-4 bg-surface-container-lowest/85 border border-[#272a3b] rounded flex flex-wrap items-center justify-around gap-3 z-10">
            {gates.map((g) => (
              <div
                key={g.name}
                className={`relative flex items-center gap-3 px-3.5 py-2 rounded border transition-all ${
                  g.isWaiting
                    ? "bg-primary-container/20 border-primary shadow-[0_0_14px_rgba(245,158,11,0.35)]"
                    : "bg-surface-container border-[#272a3b]"
                }`}
              >
                {g.isWaiting && (
                  <span
                    aria-label="Waiting for human approval"
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-error text-[#0b0d19] font-mono text-xs font-bold flex items-center justify-center shadow animate-bounce"
                  >
                    !
                  </span>
                )}
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    g.isWaiting ? "text-primary" : "text-outline"
                  }`}
                >
                  {g.isWaiting ? "lock_open" : "door_front"}
                </span>
                <div>
                  <div className="font-mono text-label-sm font-bold text-on-surface">
                    {g.label}
                  </div>
                  <div className="font-mono text-label-xs text-on-surface-variant">
                    {g.isWaiting ? "PAUSED FOR HUMAN APPROVAL" : "GATE CLEAR"}
                  </div>
                </div>
                {g.isWaiting && g.jobId && (
                  <MechanicalButton
                    size="sm"
                    variant="primary"
                    onClick={() => onApproveGate(g.jobId!, g.name, "approved")}
                  >
                    APPROVE
                  </MechanicalButton>
                )}
              </div>
            ))}
          </div>

          {/* Row 2: Animator, Voice Actor, Editor, Social Manager */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            {bottomRow.map(renderDeskCard)}
          </div>

          {/* Animated Walking Courier carrying the glowing Reel Folder */}
          {courier && courierCoord && (
            <div
              style={{
                left: `${courierCoord.x}%`,
                top: `${courierCoord.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              className="pointer-events-none absolute z-30 transition-all duration-700 ease-in-out"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0b0d19]/95 border-2 border-primary rounded shadow-[0_0_16px_rgba(245,158,11,0.55)] animate-courier">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  directions_walk
                </span>
                <span className="material-symbols-outlined text-secondary text-[18px]">
                  folder_special
                </span>
                <div className="font-mono text-label-xs leading-tight whitespace-nowrap">
                  <div className="text-primary font-bold">{courier.label}</div>
                  <div className="text-on-surface-variant truncate max-w-[180px]">
                    {courier.jobTitle}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docked Right Inspector (Employee Panel) */}
      <div className="w-84 xl:w-96 flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-xl overflow-hidden shrink-0">
        {/* Inspector Header */}
        <div className="p-3 bg-surface-container border-b border-[#272a3b]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-label-xs text-outline uppercase">
              EMPLOYEE INSPECTOR
            </span>
            <DiodeChip status={activeEmp.status} />
          </div>

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded border border-[#272a3b] flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${activeEmp.color}30` }}
            >
              <span className="font-headline font-bold text-headline-sm text-primary">
                {activeEmp.name[0]}
              </span>
            </div>
            <div className="min-w-0">
              <div className="font-headline font-bold text-headline-sm text-on-surface truncate">
                {activeEmp.name}
              </div>
              <div className="font-mono text-label-sm text-on-surface-variant">
                {activeEmp.title} ({activeEmp.desk})
              </div>
            </div>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-[#272a3b] bg-surface-container-lowest">
          {(["skill", "output", "logs", "cost"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setInspectorTab(t)}
              className={`flex-1 py-2 font-mono text-label-sm uppercase transition-all border-b-2 ${
                inspectorTab === t
                  ? "border-primary text-primary font-bold bg-surface-container-high"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Inspector Body */}
        <div className="flex-1 p-3 overflow-y-auto font-mono text-body-sm space-y-3">
          {/* Gate Review Actions if waiting */}
          {waitingGate && waitingGate.jobId && (
            <div className="p-3 bg-primary-container/10 border border-primary/40 rounded space-y-2">
              <div className="flex items-center gap-1.5 text-primary font-bold text-label-sm">
                <span className="material-symbols-outlined text-[16px]">gavel</span>
                ACTION REQUIRED: {waitingGate.label}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional feedback or rejection comment..."
                className="w-full bg-surface-container-lowest border border-[#272a3b] rounded p-2 text-label-sm font-mono text-on-surface"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <MechanicalButton
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    onApproveGate(waitingGate.jobId!, waitingGate.name, "approved", comment);
                    setComment("");
                  }}
                >
                  APPROVE
                </MechanicalButton>
                <MechanicalButton
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    onApproveGate(waitingGate.jobId!, waitingGate.name, "rejected", comment);
                    setComment("");
                  }}
                >
                  REJECT
                </MechanicalButton>
              </div>
            </div>
          )}

          {inspectorTab === "skill" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-label-xs text-outline uppercase">
                  Active Prompt (v{inspectorData?.activeVersion ?? 1})
                </div>
                <div className="p-2.5 bg-surface-container-lowest border border-[#272a3b] rounded text-body-xs text-on-surface max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {inspectorData?.skillPrompt || "Loading active skill prompt..."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-label-sm">
                <div className="p-2 bg-surface-container border border-[#272a3b] rounded">
                  <span className="text-outline text-label-xs block">PROVIDER</span>
                  <span className="text-primary font-bold">{inspectorData?.provider || "gemini"}</span>
                </div>
                <div className="p-2 bg-surface-container border border-[#272a3b] rounded">
                  <span className="text-outline text-label-xs block">MODEL</span>
                  <span className="text-on-surface">{inspectorData?.model || "gemini-flash"}</span>
                </div>
              </div>
            </div>
          )}

          {inspectorTab === "output" && (
            <div className="space-y-2">
              <div className="text-label-xs text-outline uppercase">Latest Output Artifact</div>
              {inspectorData?.reelArtifactId && (
                <video
                  controls
                  preload="metadata"
                  src={`/api/artifacts/${inspectorData.reelArtifactId}`}
                  className="w-full max-h-64 rounded border border-[#272a3b] bg-black"
                />
              )}
              <div className="p-2.5 bg-surface-container-lowest border border-[#272a3b] rounded text-body-xs text-on-surface max-h-72 overflow-y-auto whitespace-pre-wrap">
                {inspectorData?.latestOutput || "No recent output generated for this employee yet."}
              </div>
            </div>
          )}

          {inspectorTab === "logs" && (
            <div className="space-y-2">
              <div className="text-label-xs text-outline uppercase">Activity & Stage Logs</div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {inspectorData?.logs && inspectorData.logs.length > 0 ? (
                  inspectorData.logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 bg-surface-container-lowest border border-[#272a3b] rounded text-label-sm"
                    >
                      <div className="flex items-center justify-between text-outline text-label-xs mb-1">
                        <span>[{log.timestamp.slice(11, 19)}]</span>
                        <span className={log.level === "error" ? "text-error" : "text-secondary"}>
                          {log.level.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-on-surface">{log.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-on-surface-variant text-label-sm">No logs recorded yet.</div>
                )}
              </div>
            </div>
          )}

          {inspectorTab === "cost" && (
            <div className="space-y-3">
              <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-2">
                <div className="text-label-xs text-outline uppercase">Job Spend (est.)</div>
                <div className="font-mono text-headline-sm font-bold text-primary">
                  ₱{(inspectorData?.spendJobEst ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-2">
                <div className="text-label-xs text-outline uppercase">Month Spend (est.)</div>
                <div className="font-mono text-headline-sm font-bold text-secondary">
                  ₱{(inspectorData?.spendMonthEst ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
