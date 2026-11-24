"use client";

import React, { useState } from "react";
import { DiodeChip } from "@/components/ui/DiodeChip";
import { MechanicalButton } from "@/components/ui/MechanicalButton";
import type { Role } from "@/shared/roster";
import type { SkillHistoryItem } from "./OfficeFloorView";

export interface StaffMember {
  id: Role;
  name: string;
  title: string;
  desk: string;
  status: string;
  activeVersion: number;
  provider: string;
  model: string;
  runsMonth: number;
  successRatePercent: number;
  avgDurationSec: number;
  avgCostEstPhp: number;
  monthSpendEstPhp: number;
  rerollCap: number;
  prompt: string;
  checklist: readonly string[];
  skillHistory: SkillHistoryItem[];
}

export interface StaffRosterViewProps {
  staff: StaffMember[];
  onSaveSkill: (role: Role, prompt: string, note?: string) => Promise<void>;
  onRollbackSkill: (role: Role, version: number) => Promise<void>;
}

export function StaffRosterView({ staff, onSaveSkill, onRollbackSkill }: StaffRosterViewProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(staff[0]?.id || "producer");
  const [filter, setFilter] = useState<"all" | "text" | "visual" | "audio">("all");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedStaff = staff.find((s) => s.id === selectedRole) || staff[0];

  React.useEffect(() => {
    if (selectedStaff) {
      setEditedPrompt(selectedStaff.prompt);
    }
  }, [selectedRole, selectedStaff?.prompt, selectedStaff?.activeVersion]);

  const filteredStaff = staff.filter((s) => {
    if (filter === "text") return ["producer", "scriptwriter", "artDirector", "socialManager"].includes(s.id);
    if (filter === "visual") return ["illustrator", "animator"].includes(s.id);
    if (filter === "audio") return ["voiceActor", "editor"].includes(s.id);
    return true;
  });

  const handleSave = async () => {
    if (!selectedStaff || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveSkill(selectedStaff.id, editedPrompt, versionNote.trim() || undefined);
      setVersionNote("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-4 overflow-hidden">
      {/* Staff Grid */}
      <div className="flex-1 flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-surface-container border-b border-[#272a3b]">
          <div className="flex items-center gap-3">
            <span className="font-headline font-bold text-headline-sm uppercase text-on-surface">
              STAFF ROSTER (8 AI EMPLOYEES)
            </span>
            <div className="flex items-center gap-1.5 font-mono text-label-xs">
              {(["all", "text", "visual", "audio"] as const).map((f) => (
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
        </div>

        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto">
          {filteredStaff.map((emp) => {
            const isSelected = selectedRole === emp.id;

            return (
              <div
                key={emp.id}
                onClick={() => setSelectedRole(emp.id)}
                className={`p-3.5 rounded border cursor-pointer select-none transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-surface-container border-primary shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-primary"
                    : "bg-surface-container-high border-[#272a3b] hover:border-outline"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-label-xs text-outline">{emp.desk}</span>
                    <DiodeChip status={emp.status} />
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded border border-[#272a3b] bg-surface-container-lowest flex items-center justify-center font-headline font-bold text-primary">
                      {emp.name[0]}
                    </div>
                    <div>
                      <div className="font-headline font-bold text-headline-sm text-on-surface">
                        {emp.name}
                      </div>
                      <div className="font-mono text-label-sm text-on-surface-variant">
                        {emp.title} (v{emp.activeVersion})
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 my-2">
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest border border-[#272a3b] font-mono text-label-xs text-tertiary">
                      {emp.provider}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest border border-[#272a3b] font-mono text-label-xs text-outline">
                      Cap: {emp.rerollCap} rolls
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest border border-[#272a3b] font-mono text-label-xs text-secondary">
                      Avg {emp.avgDurationSec}s
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#272a3b] grid grid-cols-3 gap-2 text-center font-mono text-label-xs">
                  <div>
                    <span className="text-outline block">RUNS (MO)</span>
                    <span className="text-on-surface font-bold">{emp.runsMonth}</span>
                  </div>
                  <div>
                    <span className="text-outline block">SUCCESS</span>
                    <span className="text-secondary font-bold">{emp.successRatePercent}%</span>
                  </div>
                  <div>
                    <span className="text-outline block">AVG COST</span>
                    <span className="text-primary font-bold">₱{emp.avgCostEstPhp} est.</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Employee Skill Editor Inspector */}
      {selectedStaff && (
        <div className="w-84 xl:w-[26rem] flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-xl overflow-hidden shrink-0">
          <div className="p-3 bg-surface-container border-b border-[#272a3b]">
            <div className="font-mono text-label-xs text-outline uppercase">SKILL EDITOR</div>
            <div className="font-headline font-bold text-headline-sm text-on-surface">
              {selectedStaff.name} ({selectedStaff.title})
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-2 font-mono text-[10px] text-center">
              <div className="p-1 bg-surface-container-lowest rounded border border-[#272a3b]">
                <span className="text-outline block">SUCCESS</span>
                <span className="text-secondary font-bold">{selectedStaff.successRatePercent}%</span>
              </div>
              <div className="p-1 bg-surface-container-lowest rounded border border-[#272a3b]">
                <span className="text-outline block">AVG DUR</span>
                <span className="text-primary font-bold">{selectedStaff.avgDurationSec}s</span>
              </div>
              <div className="p-1 bg-surface-container-lowest rounded border border-[#272a3b]">
                <span className="text-outline block">MO SPEND</span>
                <span className="text-on-surface font-bold">₱{selectedStaff.monthSpendEstPhp} est.</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono">
            <div className="space-y-1">
              <label className="text-label-xs text-outline uppercase block">
                SYSTEM PROMPT (ACTIVE v{selectedStaff.activeVersion})
              </label>
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={9}
                className="w-full p-2.5 bg-surface-container-lowest border border-[#272a3b] rounded text-body-xs text-on-surface font-mono leading-relaxed focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-label-xs text-outline uppercase block">VERSION NOTE</label>
              <input
                type="text"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="e.g. Tightened problem-fix instructions"
                className="w-full p-2 bg-surface-container-lowest border border-[#272a3b] rounded text-label-sm text-on-surface"
              />
            </div>

            <MechanicalButton
              size="md"
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? "SAVING..." : "SAVE AS NEW VERSION"}
            </MechanicalButton>

            {selectedStaff.checklist.length > 0 && (
              <div className="pt-2 border-t border-[#272a3b] space-y-1">
                <div className="text-label-xs text-outline uppercase">Quality Checklist</div>
                <ul className="space-y-1 text-[11px] text-on-surface-variant">
                  {selectedStaff.checklist.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-secondary">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedStaff.skillHistory.length > 0 && (
              <div className="pt-2 border-t border-[#272a3b] space-y-1.5">
                <div className="text-label-xs text-outline uppercase">Version History</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedStaff.skillHistory.map((h) => {
                    const isActive = h.version === selectedStaff.activeVersion;
                    return (
                      <div
                        key={h.version}
                        className="p-2 bg-surface-container-lowest border border-[#272a3b] rounded flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-on-surface">
                            v{h.version} {isActive && <span className="text-secondary">(ACTIVE)</span>}
                          </div>
                          <div className="text-[10px] text-outline truncate">
                            {h.note || new Date(h.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => onRollbackSkill(selectedStaff.id, h.version)}
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
        </div>
      )}
    </div>
  );
}
