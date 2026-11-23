"use client";

import React, { useState } from "react";
import { DiodeChip } from "@/components/ui/DiodeChip";
import { MechanicalButton } from "@/components/ui/MechanicalButton";

export interface KanbanJob {
  id: string;
  title: string;
  state: string;
  progressPercent: number;
  costEstPhp: number;
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
}

export interface PipelineKanbanViewProps {
  jobs: KanbanJob[];
  onSelectJob: (job: KanbanJob) => void;
  selectedJobId?: string | null;
  onApproveGate: (jobId: string, gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW", decision: "approved" | "rejected", comment?: string) => void;
  onRetryStage: (jobId: string) => void;
  onOpenNewReelModal: () => void;
}

export function PipelineKanbanView({
  jobs,
  onSelectJob,
  selectedJobId,
  onApproveGate,
  onRetryStage,
  onOpenNewReelModal,
}: PipelineKanbanViewProps) {
  const [filter, setFilter] = useState<"all" | "approval" | "errors" | "progress" | "posted">("all");
  const [search, setSearch] = useState("");

  const columns: { state: string; label: string; role: string; gate?: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW" }[] = [
    { state: "BRIEFED", label: "Idea", role: "PRODUCER" },
    { state: "SCRIPTING", label: "Script", role: "SCRIPTWRITER" },
    { state: "SCRIPT_REVIEW", label: "Script Review", role: "HUMAN GATE", gate: "SCRIPT_REVIEW" },
    { state: "ART_PLANNING", label: "Art", role: "ART DIRECTOR" },
    { state: "ILLUSTRATING", label: "Illustrate", role: "ILLUSTRATOR" },
    { state: "KEYFRAME_REVIEW", label: "Keyframe Review", role: "HUMAN GATE", gate: "KEYFRAME_REVIEW" },
    { state: "VOICING", label: "Voice", role: "VOICE ACTOR" },
    { state: "ANIMATING", label: "Animation", role: "ANIMATOR" },
    { state: "EDITING", label: "Editing", role: "EDITOR" },
    { state: "SOCIAL", label: "Social", role: "SOCIAL MGR" },
    { state: "READY_TO_POST", label: "Ready to Post", role: "REVIEW" },
    { state: "DONE", label: "Posted", role: "COMPLETED" },
    { state: "ERROR", label: "Error", role: "FAILED" },
  ];

  const filteredJobs = jobs.filter((j) => {
    if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "approval") return j.state === "SCRIPT_REVIEW" || j.state === "KEYFRAME_REVIEW";
    if (filter === "errors") return j.state === "ERROR";
    if (filter === "progress") return !["DONE", "ERROR", "READY_TO_POST"].includes(j.state);
    if (filter === "posted") return j.state === "DONE";
    return true;
  });

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] gap-3 overflow-hidden">
      {/* Top Filter and Search Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low border border-[#272a3b] rounded">
        <div className="flex items-center gap-3">
          <span className="font-headline font-bold text-headline-sm uppercase text-on-surface">
            PIPELINE KANBAN
          </span>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 font-mono text-label-xs">
            {(["all", "approval", "progress", "errors", "posted"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded border capitalize transition-all ${
                  filter === f
                    ? "bg-primary-container text-[#0b0d19] font-bold border-primary"
                    : "bg-surface-container border-[#272a3b] text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search reel title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-container-lowest border border-[#272a3b] rounded px-2.5 py-1 text-label-sm font-mono text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
          <MechanicalButton size="sm" variant="primary" icon="add" onClick={onOpenNewReelModal}>
            NEW REEL
          </MechanicalButton>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll */}
      <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const colJobs = filteredJobs.filter((j) => j.state === col.state);
          const isGateCol = Boolean(col.gate);

          return (
            <div
              key={col.state}
              className={`w-64 shrink-0 flex flex-col bg-surface-container-low border rounded overflow-hidden ${
                isGateCol ? "border-primary/40 shadow-[0_0_8px_rgba(245,158,11,0.1)]" : "border-[#272a3b]"
              }`}
            >
              {/* Column Header */}
              <div
                className={`p-2.5 border-b flex items-center justify-between ${
                  isGateCol
                    ? "bg-primary-container/15 border-primary/40 text-primary"
                    : "bg-surface-container border-[#272a3b] text-on-surface"
                }`}
              >
                <div>
                  <div className="font-headline font-bold text-label-md uppercase">{col.label}</div>
                  <div className="font-mono text-label-xs text-on-surface-variant">{col.role}</div>
                </div>
                <span className="font-mono text-label-xs px-1.5 py-0.5 bg-surface-container-lowest border border-[#272a3b] rounded font-bold">
                  {colJobs.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {colJobs.map((job) => {
                  const isSelected = selectedJobId === job.id;
                  const isGateWaiting = col.gate && job.state === col.gate;

                  return (
                    <div
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className={`p-2.5 rounded border cursor-pointer select-none transition-all ${
                        isSelected
                          ? "bg-surface-container border-primary ring-1 ring-primary"
                          : isGateWaiting
                          ? "bg-primary-container/10 border-primary animate-pulse"
                          : "bg-surface-container-high border-[#272a3b] hover:border-outline"
                      }`}
                    >
                      <div className="flex items-center justify-between text-label-xs font-mono text-outline mb-1">
                        <span>#{job.id.slice(0, 6)}</span>
                        <span className="text-primary font-bold">₱{job.costEstPhp} est.</span>
                      </div>

                      <div className="font-headline font-bold text-label-md text-on-surface line-clamp-2 mb-2">
                        {job.title}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1 bg-surface-container-lowest rounded overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${job.progressPercent}%` }}
                        />
                      </div>

                      {/* Card Action for Gates */}
                      {isGateWaiting && col.gate && (
                        <div className="flex items-center gap-1.5 pt-1 border-t border-[#272a3b]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onApproveGate(job.id, col.gate!, "approved");
                            }}
                            className="flex-1 py-0.5 bg-primary-container text-[#0b0d19] font-mono text-label-xs font-bold rounded"
                          >
                            APPROVE
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onApproveGate(job.id, col.gate!, "rejected", "Changes requested");
                            }}
                            className="px-2 py-0.5 bg-error-container text-on-error-container font-mono text-label-xs rounded"
                          >
                            REJECT
                          </button>
                        </div>
                      )}

                      {/* Card Action for Errors */}
                      {job.state === "ERROR" && (
                        <div className="pt-1 border-t border-[#272a3b]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryStage(job.id);
                            }}
                            className="w-full py-0.5 bg-surface-container-highest text-primary font-mono text-label-xs rounded hover:bg-surface-bright"
                          >
                            RETRY STAGE
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Selected Job Inspection Tray */}
      {selectedJob && (
        <div className="p-3 bg-surface-container-low border border-[#272a3b] rounded flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="font-mono text-label-xs text-outline block">SELECTED REEL</span>
              <span className="font-headline font-bold text-label-lg text-on-surface">
                {selectedJob.title}
              </span>
            </div>
            <DiodeChip status={selectedJob.state} />
            <div className="font-mono text-label-sm text-primary font-bold">
              Cost: ₱{selectedJob.costEstPhp} est.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(selectedJob.state === "SCRIPT_REVIEW" || selectedJob.state === "KEYFRAME_REVIEW") && (
              <>
                <MechanicalButton
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    onApproveGate(
                      selectedJob.id,
                      selectedJob.state as "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
                      "approved"
                    )
                  }
                >
                  APPROVE GATE
                </MechanicalButton>
                <MechanicalButton
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    onApproveGate(
                      selectedJob.id,
                      selectedJob.state as "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
                      "rejected"
                    )
                  }
                >
                  REJECT
                </MechanicalButton>
              </>
            )}
            {selectedJob.state === "ERROR" && (
              <MechanicalButton size="sm" variant="secondary" onClick={() => onRetryStage(selectedJob.id)}>
                RETRY FAILED STAGE
              </MechanicalButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
