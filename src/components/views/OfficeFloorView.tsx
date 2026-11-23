"use client";

import React, { useState } from "react";
import { DiodeChip } from "@/components/ui/DiodeChip";
import { MechanicalButton } from "@/components/ui/MechanicalButton";
import { SteppedCard } from "@/components/ui/SteppedCard";
import type { Role } from "@/shared/roster";

export interface EmployeeInfo {
  id: Role;
  name: string;
  title: string;
  desk: string;
  status: "idle" | "thinking" | "working" | "done" | "error" | "waiting";
  prop: string;
  color: string;
}

export interface GateInfo {
  name: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW";
  label: string;
  isWaiting: boolean;
  jobId?: string;
}

export interface OfficeFloorViewProps {
  employees: EmployeeInfo[];
  selectedEmployee: Role | null;
  onSelectEmployee: (role: Role) => void;
  activeJob?: {
    id: string;
    title: string;
    state: string;
    fromDesk?: string;
    toDesk?: string;
  } | null;
  gates: GateInfo[];
  onApproveGate: (jobId: string, gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW", decision: "approved" | "rejected", comment?: string) => void;
  inspectorData?: {
    skillPrompt?: string;
    provider?: string;
    model?: string;
    activeVersion?: number;
    latestOutput?: string;
    logs?: { id: number; level: string; message: string; createdAt: string }[];
    spendJobEst?: number;
    spendMonthEst?: number;
  } | null;
}

export function OfficeFloorView({
  employees,
  selectedEmployee,
  onSelectEmployee,
  activeJob,
  gates,
  onApproveGate,
  inspectorData,
}: OfficeFloorViewProps) {
  const [inspectorTab, setInspectorTab] = useState<"skill" | "output" | "logs" | "cost">("skill");
  const [comment, setComment] = useState("");

  const activeEmp = employees.find((e) => e.id === selectedEmployee) ?? employees[0];
  const waitingGate = gates.find((g) => g.isWaiting);

  return (
    <div className="flex w-full h-[calc(100vh-6.5rem)] gap-4 overflow-hidden">
      {/* Floor Area */}
      <div className="flex-1 flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-xl relative overflow-hidden">
        {/* Floor HUD strip */}
        <div className="flex items-center justify-between px-4 py-2 bg-surface-container border-b border-[#272a3b] text-on-surface">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">domain</span>
            <span className="font-headline font-bold text-headline-sm uppercase">
              STUDIO FLOOR PLAN
            </span>
          </div>

          {activeJob && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface-container-lowest border border-primary/40 rounded">
                <span className="material-symbols-outlined text-primary text-[16px] animate-bounce">
                  folder
                </span>
                <span className="font-mono text-label-sm text-primary font-bold">
                  ACTIVE REEL: {activeJob.title}
                </span>
                <span className="font-mono text-label-xs text-on-surface-variant">
                  ({activeJob.state})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Isometric Parquet Floor Canvas */}
        <div className="flex-1 bg-parquet relative p-6 flex flex-col justify-between overflow-y-auto">
          {/* Station Grid (8 desks in pipeline sequence) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            {employees.map((emp) => {
              const isSelected = selectedEmployee === emp.id;
              const isWorking = emp.status === "working" || emp.status === "thinking";

              return (
                <div
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp.id)}
                  className={`relative p-3.5 rounded border cursor-pointer select-none transition-all ${
                    isSelected
                      ? "bg-surface-container border-primary shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-primary"
                      : "bg-[#191b27]/90 border-[#272a3b] hover:border-outline hover:bg-[#191b27]"
                  }`}
                >
                  {/* Station Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-label-xs text-outline uppercase">
                      {emp.desk}
                    </span>
                    <DiodeChip status={emp.status} />
                  </div>

                  {/* Character Avatar & Desk Prop */}
                  <div className="flex items-center gap-3 my-2">
                    <div
                      className={`w-12 h-12 rounded border border-[#272a3b] flex items-center justify-center shrink-0 ${
                        isWorking ? "animate-pixel-bob" : ""
                      }`}
                      style={{ backgroundColor: `${emp.color}25` }}
                    >
                      {/* Character Pixel SVG Avatar */}
                      <svg
                        className="w-8 h-8 pixelated"
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

                    <div className="min-w-0">
                      <div className="font-headline font-bold text-headline-sm text-on-surface truncate">
                        {emp.name}
                      </div>
                      <div className="font-mono text-label-sm text-primary truncate">
                        {emp.title}
                      </div>
                    </div>
                  </div>

                  {/* Desk Prop Indicator */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#272a3b]/60 text-label-xs font-mono text-on-surface-variant">
                    <span>PROP: {emp.prop}</span>
                    <span className="material-symbols-outlined text-[14px]">desktop_windows</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Gate Doors Between Stages */}
          <div className="my-4 py-3 px-4 bg-surface-container-lowest/80 border border-[#272a3b] rounded flex items-center justify-around z-10">
            {gates.map((g) => (
              <div
                key={g.name}
                className={`flex items-center gap-3 px-3 py-1.5 rounded border transition-all ${
                  g.isWaiting
                    ? "bg-primary-container/20 border-primary shadow-[0_0_8px_rgba(245,158,11,0.3)] animate-pulse"
                    : "bg-surface-container border-[#272a3b]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    g.isWaiting ? "text-primary" : "text-outline"
                  }`}
                >
                  {g.isWaiting ? "notification_important" : "door_front"}
                </span>
                <div>
                  <div className="font-mono text-label-sm font-bold text-on-surface">
                    {g.label}
                  </div>
                  <div className="font-mono text-label-xs text-on-surface-variant">
                    {g.isWaiting ? "PAUSED FOR HUMAN STAMP" : "GATE CLEAR"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Active Courier Moving Folder Animation */}
          {activeJob && (
            <div className="flex items-center gap-2 p-2 bg-surface-container/90 border border-primary/30 rounded z-10 w-fit animate-courier">
              <span className="material-symbols-outlined text-primary text-[20px]">
                directions_walk
              </span>
              <span className="font-mono text-label-sm text-on-surface">
                COURIER: Delivering <strong>{activeJob.title}</strong>
              </span>
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
                  onClick={() => onApproveGate(waitingGate.jobId!, waitingGate.name, "approved", comment)}
                >
                  APPROVE
                </MechanicalButton>
                <MechanicalButton
                  size="sm"
                  variant="danger"
                  onClick={() => onApproveGate(waitingGate.jobId!, waitingGate.name, "rejected", comment)}
                >
                  REJECT
                </MechanicalButton>
              </div>
            </div>
          )}

          {inspectorTab === "skill" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-label-xs text-outline uppercase">Active Prompt (v{inspectorData?.activeVersion ?? 1})</div>
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
                        <span>[{log.createdAt.slice(11, 19)}]</span>
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
