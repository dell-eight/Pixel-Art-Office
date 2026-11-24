"use client";

import React, { useEffect, useState } from "react";
import {
  GateReviewPanel,
  type GateDecisionItem,
  type GateReviewSubmission,
  type KeyframeItem,
} from "@/components/gates/GateReviewPanel";
import { DiodeChip } from "@/components/ui/DiodeChip";
import { MechanicalButton } from "@/components/ui/MechanicalButton";
import type { Role } from "@/shared/roster";
import type { Script, Social } from "@/shared/schemas";

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

export interface SkillHistoryItem {
  version: number;
  note?: string | null;
  createdAt: string;
  prompt: string;
}

export interface EmployeeStatsData {
  runsThisMonth: number;
  successRatePercent: number;
  avgDurationSec: number;
  avgCostEstPhp: number;
  monthSpendEstUsd: number;
  monthSpendEstPhp: number;
  monthUnitsEst: number;
  jobSpendEstUsd: number;
  jobSpendEstPhp: number;
  jobUnitsEst: number;
}

export interface JobArtifactsBundle {
  keyframes: KeyframeItem[];
  voice: { id: string; beat?: number; durationSec?: number }[];
  clips: { id: string; beat?: number; seconds?: number }[];
  reelId?: string;
  thumbnailId?: string;
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
  onOpenGateModal: (jobId: string, gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW") => void;
  onGateSubmit: (
    jobId: string,
    gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
    payload: GateReviewSubmission,
  ) => Promise<void> | void;
  onSaveSkill: (role: Role, prompt: string, note?: string) => Promise<void>;
  onRollbackSkill: (role: Role, version: number) => Promise<void>;
  inspectorData?: {
    skillPrompt?: string;
    provider?: string;
    model?: string;
    activeVersion?: number;
    checklist?: readonly string[];
    skillHistory?: SkillHistoryItem[];
    latestOutput?: string;
    parsedScript?: Script | null;
    parsedSocial?: Social | null;
    artifacts?: JobArtifactsBundle;
    gateHistory?: GateDecisionItem[];
    logs?: { id: string; level: string; message: string; timestamp: string }[];
    stats?: EmployeeStatsData;
  } | null;
}

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
  onOpenGateModal,
  onGateSubmit,
  onSaveSkill,
  onRollbackSkill,
  inspectorData,
}: OfficeFloorViewProps) {
  const [inspectorTab, setInspectorTab] = useState<"skill" | "output" | "logs" | "cost">("skill");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const activeEmp = employees.find((e) => e.id === selectedEmployee) ?? employees[0];
  const waitingGate = gates.find((g) => g.isWaiting);
  const topRow = employees.slice(0, 4);
  const bottomRow = employees.slice(4, 8);
  const currentStep = stepIndexForState(activeJob?.state);

  const courierCoord = courier ? COURIER_WAYPOINTS[courier.pos] ?? COURIER_WAYPOINTS.producer : null;

  useEffect(() => {
    setEditedPrompt(inspectorData?.skillPrompt ?? "");
  }, [activeEmp.id, inspectorData?.skillPrompt, inspectorData?.activeVersion]);

  const handleSaveSkill = async () => {
    if (savingSkill || !editedPrompt.trim()) return;
    setSavingSkill(true);
    try {
      await onSaveSkill(activeEmp.id, editedPrompt, versionNote.trim() || undefined);
      setVersionNote("");
    } finally {
      setSavingSkill(false);
    }
  };

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
        {(isWorking || isWaiting) && (
          <div className="absolute -top-2.5 right-2 px-2 py-0.5 rounded bg-primary-container text-[#0b0d19] font-mono text-[10px] font-bold shadow border border-primary z-20 animate-bounce">
            {isWorking
              ? `WORKING${typeof emp.progress === "number" ? ` ${emp.progress}%` : "..."}`
              : "AT GATE!"}
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-label-xs text-outline uppercase">{emp.desk}</span>
          <DiodeChip status={emp.status} />
        </div>

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

        <div className="flex items-center justify-between pt-2 border-t border-[#272a3b]/60 text-label-xs font-mono text-on-surface-variant">
          <span>PROP: {emp.prop}</span>
          <span className="material-symbols-outlined text-[14px]">desktop_windows</span>
        </div>
      </div>
    );
  };

  const renderRoleOutput = () => {
    const arts = inspectorData?.artifacts;
    const role = activeEmp.id;

    if (role === "scriptwriter" && inspectorData?.parsedScript) {
      const s = inspectorData.parsedScript;
      return (
        <div className="space-y-2">
          <div className="p-2 bg-surface-container border border-[#272a3b] rounded">
            <div className="text-[10px] text-outline uppercase">Title & Hook</div>
            <div className="text-label-sm font-bold text-on-surface">{s.title}</div>
            <div className="text-label-xs text-primary mt-1">{s.hook}</div>
          </div>
          {s.beats.map((b) => (
            <div key={b.index} className="p-2 bg-surface-container-lowest border border-[#272a3b] rounded space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-primary font-bold">Beat {b.index + 1} (+{b.so_you_add})</span>
                <span className="text-secondary">{b.seconds}s</span>
              </div>
              <div className="text-[11px] text-on-surface">{b.narration}</div>
            </div>
          ))}
        </div>
      );
    }

    if (role === "illustrator" && arts && arts.keyframes.length > 0) {
      return (
        <div className="grid min-w-0 grid-cols-2 gap-2">
          {arts.keyframes.map((kf) => (
            <div key={kf.id} className="min-w-0 overflow-hidden p-1.5 bg-surface-container-lowest border border-[#272a3b] rounded">
              <div className="h-36 w-full bg-black rounded overflow-hidden mb-1 flex items-center justify-center">
                <img
                  src={`/api/artifacts/${kf.id}`}
                  alt={`Keyframe K${kf.index}`}
                  className="max-w-full max-h-full w-auto h-full object-contain pixelated block"
                />
              </div>
              <div className="text-[10px] text-primary font-bold">
                K{kf.index} {kf.revised ? "(REVISED)" : ""}
              </div>
              {kf.addObject && <div className="text-[10px] text-on-surface-variant truncate">{kf.addObject}</div>}
            </div>
          ))}
        </div>
      );
    }

    if (role === "voiceActor" && arts && arts.voice.length > 0) {
      return (
        <div className="space-y-2">
          {arts.voice.map((v, idx) => (
            <div key={v.id} className="p-2 bg-surface-container-lowest border border-[#272a3b] rounded space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-primary font-bold">Beat {(v.beat ?? idx) + 1} Voice</span>
                {v.durationSec && <span className="text-secondary">{v.durationSec}s</span>}
              </div>
              <audio controls preload="metadata" src={`/api/artifacts/${v.id}`} className="w-full h-8" />
            </div>
          ))}
        </div>
      );
    }

    if (role === "animator" && arts && arts.clips.length > 0) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {arts.clips.map((c, idx) => (
            <div key={c.id} className="p-1.5 bg-surface-container-lowest border border-[#272a3b] rounded space-y-1">
              <div className="text-[10px] text-primary font-bold">
                Clip {(c.beat ?? idx) + 1} {c.seconds ? `(${c.seconds}s)` : ""}
              </div>
              <video controls preload="metadata" src={`/api/artifacts/${c.id}`} className="w-full rounded bg-black" />
            </div>
          ))}
        </div>
      );
    }

    if (role === "socialManager" && inspectorData?.parsedSocial) {
      return (
        <div className="space-y-2">
          {inspectorData.parsedSocial.posts.map((p) => (
            <div key={p.platform} className="p-2.5 bg-surface-container-lowest border border-[#272a3b] rounded space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-label-xs font-bold uppercase text-primary">{p.platform}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${p.caption}\n\n${p.hashtags.join(" ")}\n\n${p.aiDisclosure}`);
                    setCopiedPlatform(p.platform);
                    setTimeout(() => setCopiedPlatform(null), 1500);
                  }}
                  className="px-2 py-0.5 bg-surface-container border border-[#272a3b] rounded text-[10px] text-on-surface hover:border-primary"
                >
                  {copiedPlatform === p.platform ? "COPIED!" : "COPY"}
                </button>
              </div>
              <div className="text-label-xs text-on-surface">{p.caption}</div>
              <div className="text-[11px] text-tertiary">{p.hashtags.join(" ")}</div>
              <div className="p-1.5 bg-secondary/10 border border-secondary/30 rounded text-[10px] text-secondary">
                AI Label: {p.aiLabelFlag ? "ON" : "OFF"} · {p.aiDisclosure}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {arts?.reelId && role === "editor" && (
          <video
            controls
            preload="metadata"
            src={`/api/artifacts/${arts.reelId}`}
            poster={arts.thumbnailId ? `/api/artifacts/${arts.thumbnailId}` : undefined}
            className="w-full max-h-64 rounded border border-[#272a3b] bg-black"
          />
        )}
        <div className="p-2.5 bg-surface-container-lowest border border-[#272a3b] rounded text-body-xs text-on-surface max-h-72 overflow-y-auto whitespace-pre-wrap">
          {inspectorData?.latestOutput || "No recent output generated for this employee yet."}
        </div>
      </div>
    );
  };

  const stats = inspectorData?.stats;

  return (
    <div className="flex w-full h-[calc(100vh-6.5rem)] gap-4 overflow-hidden">
      {/* Floor Area */}
      <div className="flex-1 min-w-0 flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-surface-container border-b border-[#272a3b] text-on-surface">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">domain</span>
            <span className="font-headline font-bold text-headline-sm uppercase">
              STUDIO FLOOR PLAN
            </span>
          </div>

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
                activeJob.state === "DONE"
                  ? "border-secondary/40"
                  : activeJob.state === "REJECTED"
                    ? "border-error/40"
                    : "border-primary/40"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  activeJob.state === "DONE"
                    ? "text-secondary"
                    : activeJob.state === "REJECTED"
                      ? "text-error"
                      : "text-primary animate-bounce"
                }`}
              >
                {activeJob.state === "DONE" ? "task_alt" : activeJob.state === "REJECTED" ? "block" : "folder"}
              </span>
              <span
                className={`font-mono text-label-sm font-bold truncate max-w-[200px] ${
                  activeJob.state === "DONE"
                    ? "text-secondary"
                    : activeJob.state === "REJECTED"
                      ? "text-error"
                      : "text-primary"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            {topRow.map(renderDeskCard)}
          </div>

          {/* Interactive Gate Doors Corridor */}
          <div className="py-3 px-4 bg-surface-container-lowest/85 border border-[#272a3b] rounded flex flex-wrap items-center justify-around gap-3 z-10">
            {gates.map((g) => (
              <div
                key={g.name}
                onClick={() => g.isWaiting && g.jobId && onOpenGateModal(g.jobId, g.name)}
                className={`relative flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded border transition-all ${
                  g.isWaiting
                    ? "bg-primary-container/20 border-primary shadow-[0_0_14px_rgba(245,158,11,0.35)] cursor-pointer"
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
                  <div className="font-mono text-label-sm font-bold text-on-surface">{g.label}</div>
                  <div className="font-mono text-label-xs text-on-surface-variant">
                    {g.isWaiting ? "PAUSED FOR HUMAN APPROVAL" : "GATE CLEAR"}
                  </div>
                </div>
                {g.isWaiting && g.jobId && (
                  <div className="flex items-center gap-1.5">
                    <MechanicalButton
                      size="sm"
                      variant="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGateSubmit(g.jobId!, g.name, { decision: "approved" });
                      }}
                    >
                      APPROVE
                    </MechanicalButton>
                    <MechanicalButton
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenGateModal(g.jobId!, g.name);
                      }}
                    >
                      REVIEW
                    </MechanicalButton>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            {bottomRow.map(renderDeskCard)}
          </div>

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
                <span className="material-symbols-outlined text-primary text-[20px]">directions_walk</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">folder_special</span>
                <div className="font-mono text-label-xs leading-tight whitespace-nowrap">
                  <div className="text-primary font-bold">{courier.label}</div>
                  <div className="text-on-surface-variant truncate max-w-[180px]">{courier.jobTitle}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docked Right Inspector */}
      <div className="w-80 lg:w-[22rem] xl:w-[25rem] min-w-0 flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-xl overflow-hidden shrink-0">
        <div className="p-3 bg-surface-container border-b border-[#272a3b]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-label-xs text-outline uppercase">EMPLOYEE INSPECTOR</span>
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
            <div className="min-w-0 flex-1">
              <div className="font-headline font-bold text-headline-sm text-on-surface truncate">
                {activeEmp.name}
              </div>
              <div className="font-mono text-label-sm text-on-surface-variant">
                {activeEmp.title} ({activeEmp.desk})
              </div>
            </div>
          </div>

          {/* Real Employee Stats Strip */}
          {stats && (
            <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-[#272a3b] font-mono text-[10px] text-center">
              <div className="bg-surface-container-lowest rounded py-1 border border-[#272a3b]">
                <span className="text-outline block">SUCCESS</span>
                <span className="text-secondary font-bold">{stats.successRatePercent}%</span>
              </div>
              <div className="bg-surface-container-lowest rounded py-1 border border-[#272a3b]">
                <span className="text-outline block">RUNS (MO)</span>
                <span className="text-on-surface font-bold">{stats.runsThisMonth}</span>
              </div>
              <div className="bg-surface-container-lowest rounded py-1 border border-[#272a3b]">
                <span className="text-outline block">AVG DUR</span>
                <span className="text-primary font-bold">{stats.avgDurationSec}s</span>
              </div>
            </div>
          )}
        </div>

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

        <div className="flex-1 min-w-0 p-3 overflow-y-auto overflow-x-hidden font-mono text-body-sm space-y-3">
          {/* Embedded Gate Review Panel when paused at Gate 1 or Gate 2 */}
          {waitingGate && waitingGate.jobId && (
            <div className="p-2.5 bg-surface-container border border-primary/40 rounded">
              <GateReviewPanel
                jobId={waitingGate.jobId}
                jobTitle={activeJob?.title ?? "Active Reel"}
                gate={waitingGate.name}
                script={inspectorData?.parsedScript}
                keyframes={inspectorData?.artifacts?.keyframes}
                gateHistory={inspectorData?.gateHistory}
                compact
                onSubmit={(payload) => onGateSubmit(waitingGate.jobId!, waitingGate.name, payload)}
              />
            </div>
          )}

          {inspectorTab === "skill" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-label-xs">
                  <span className="text-outline uppercase">
                    System Prompt (v{inspectorData?.activeVersion ?? 1})
                  </span>
                  <span className="text-primary font-bold">
                    {inspectorData?.provider || "gemini"} · {inspectorData?.model || "mock"}
                  </span>
                </div>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={8}
                  className="w-full p-2 bg-surface-container-lowest border border-[#272a3b] rounded text-body-xs text-on-surface font-mono focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  placeholder="Optional version note..."
                  className="w-full px-2 py-1 bg-surface-container-lowest border border-[#272a3b] rounded text-label-xs text-on-surface"
                />
                <MechanicalButton
                  size="sm"
                  variant="primary"
                  disabled={savingSkill}
                  onClick={handleSaveSkill}
                  className="w-full"
                >
                  {savingSkill ? "SAVING..." : "SAVE AS NEW VERSION"}
                </MechanicalButton>
              </div>

              {/* Quality Checklist */}
              {inspectorData?.checklist && inspectorData.checklist.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-[#272a3b]">
                  <div className="text-label-xs text-outline uppercase">Quality Checklist</div>
                  <ul className="space-y-1 text-[11px] text-on-surface-variant">
                    {inspectorData.checklist.map((c, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-secondary">✓</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Version History & Rollback */}
              {inspectorData?.skillHistory && inspectorData.skillHistory.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-[#272a3b]">
                  <div className="text-label-xs text-outline uppercase">Version History</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {inspectorData.skillHistory.map((h) => {
                      const isActive = h.version === inspectorData.activeVersion;
                      return (
                        <div
                          key={h.version}
                          className="p-2 bg-surface-container-lowest border border-[#272a3b] rounded flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-on-surface">
                              v{h.version}{" "}
                              {isActive && <span className="text-secondary">(ACTIVE)</span>}
                            </div>
                            <div className="text-[10px] text-outline truncate">
                              {h.note || new Date(h.createdAt).toLocaleString()}
                            </div>
                          </div>
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => onRollbackSkill(activeEmp.id, h.version)}
                              className="px-2 py-0.5 bg-surface-container border border-[#272a3b] rounded text-[10px] text-primary hover:border-primary shrink-0"
                            >
                              ROLLBACK
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {inspectorTab === "output" && (
            <div className="space-y-2">
              <div className="text-label-xs text-outline uppercase">
                Latest Output ({activeEmp.title})
              </div>
              {renderRoleOutput()}
            </div>
          )}

          {inspectorTab === "logs" && (
            <div className="space-y-2">
              <div className="text-label-xs text-outline uppercase">Activity & Stage Logs</div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
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
              <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-1">
                <div className="text-label-xs text-outline uppercase">Selected Job Cost (est.)</div>
                <div className="font-mono text-headline-sm font-bold text-primary">
                  ₱{(stats?.jobSpendEstPhp ?? 0).toLocaleString()} est.
                </div>
                <div className="text-label-xs text-on-surface-variant">
                  ${(stats?.jobSpendEstUsd ?? 0).toFixed(4)} USD · est. {stats?.jobUnitsEst ?? 0} units/tokens
                </div>
              </div>
              <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-1">
                <div className="text-label-xs text-outline uppercase">Month to Date (est.)</div>
                <div className="font-mono text-headline-sm font-bold text-secondary">
                  ₱{(stats?.monthSpendEstPhp ?? 0).toLocaleString()} est.
                </div>
                <div className="text-label-xs text-on-surface-variant">
                  ${(stats?.monthSpendEstUsd ?? 0).toFixed(4)} USD · est. {stats?.monthUnitsEst ?? 0} units/tokens
                </div>
              </div>
              <div className="p-3 bg-surface-container border border-[#272a3b] rounded grid grid-cols-3 gap-2 text-center text-label-xs">
                <div>
                  <span className="text-outline block">SUCCESS</span>
                  <span className="text-secondary font-bold">{stats?.successRatePercent ?? 100}%</span>
                </div>
                <div>
                  <span className="text-outline block">RUNS (MO)</span>
                  <span className="text-on-surface font-bold">{stats?.runsThisMonth ?? 0}</span>
                </div>
                <div>
                  <span className="text-outline block">AVG DUR</span>
                  <span className="text-primary font-bold">{stats?.avgDurationSec ?? 0}s</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
