"use client";

import React, { useEffect, useState } from "react";
import { CommandConsole, type PipelineEvent } from "@/components/layout/CommandConsole";
import { Header } from "@/components/layout/Header";
import { NewReelModal } from "@/components/layout/NewReelModal";
import { Sidebar, type TabId } from "@/components/layout/Sidebar";
import { CrtOverlay } from "@/components/ui/CrtOverlay";
import { BudgetCostsView } from "@/components/views/BudgetCostsView";
import { OfficeFloorView, type EmployeeInfo, type GateInfo } from "@/components/views/OfficeFloorView";
import { PipelineKanbanView, type KanbanJob } from "@/components/views/PipelineKanbanView";
import { SettingsView } from "@/components/views/SettingsView";
import { StaffRosterView, type StaffMember } from "@/components/views/StaffRosterView";
import { ROSTER, type Role } from "@/shared/roster";

export default function AppStudio() {
  const [activeTab, setActiveTab] = useState<TabId>("office-floor");
  const [isPaused, setIsPaused] = useState(false);
  const [isNewReelOpen, setIsNewReelOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Role>("producer");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Studio state
  const [jobs, setJobs] = useState<KanbanJob[]>([]);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [budgetData, setBudgetData] = useState({
    budgetCapPhp: 6000,
    fxUsdPhp: 58,
    mtdPhp: 0,
    mtdUsd: 0,
    costEvents: [] as any[],
  });
  const [settingsData, setSettingsData] = useState({
    mockMode: true,
    budgetCapPhp: 6000,
    fxUsdPhp: 58,
    keys: {
      gemini: false,
      elevenlabs: false,
      vidu: false,
      openai: false,
      kling: false,
    },
  });
  const [staffData, setStaffData] = useState<StaffMember[]>([]);

  // Fetch initial data
  const refreshJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        const mapped: KanbanJob[] = (data.jobs || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          state: j.state,
          progressPercent: calculateProgress(j.state),
          costEstPhp: 48, // est.
          error: j.error,
          createdAt: j.createdAt,
        }));
        setJobs(mapped);
      }
    } catch {
      // ignore
    }
  };

  const refreshBudget = async () => {
    try {
      const res = await fetch("/api/budget");
      if (res.ok) {
        const b = await res.json();
        setBudgetData({
          budgetCapPhp: b.budgetCapPhp || 6000,
          fxUsdPhp: b.fxUsdPhp || 58,
          mtdPhp: b.mtdPhp || 0,
          mtdUsd: b.mtdUsd || 0,
          costEvents: (b.recentLedger || []).map((l: any) => ({
            id: l.id,
            jobId: l.jobId,
            provider: l.provider,
            model: l.model,
            units: Number(l.units || 1),
            estUsd: Number(l.estUsd || 0),
            actualUsd: l.actualUsd ? Number(l.actualUsd) : undefined,
            createdAt: l.createdAt,
          })),
        });
      }
    } catch {
      // ignore
    }
  };

  const refreshSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const s = await res.json();
        setSettingsData(s);
      }
    } catch {
      // ignore
    }
  };

  const refreshStaff = async () => {
    const list: StaffMember[] = [];
    for (const r of ROSTER) {
      try {
        const res = await fetch(`/api/employees/${r.id}/skill`);
        const json = await res.json();
        const emp = json.employee;
        const skill = emp?.skills?.[0] ? JSON.parse(emp.skills[0].skillJson) : null;
        list.push({
          id: r.id,
          name: r.name,
          title: r.title,
          desk: `Desk ${r.id.slice(0, 2).toUpperCase()}`,
          status: "idle",
          activeVersion: emp?.activeVersion || 1,
          provider: skill?.provider || "gemini",
          model: skill?.model || "gemini-flash",
          runsMonth: 8,
          successRatePercent: 95,
          avgCostEstPhp: 12,
          rerollCap: 3,
          prompt: skill?.prompt || "",
        });
      } catch {
        list.push({
          id: r.id,
          name: r.name,
          title: r.title,
          desk: "Desk A1",
          status: "idle",
          activeVersion: 1,
          provider: "gemini",
          model: "gemini-flash",
          runsMonth: 0,
          successRatePercent: 100,
          avgCostEstPhp: 0,
          rerollCap: 3,
          prompt: "",
        });
      }
    }
    setStaffData(list);
  };

  useEffect(() => {
    refreshJobs();
    refreshBudget();
    refreshSettings();
    refreshStaff();

    // Setup SSE connection
    const evtSource = new EventSource("/api/events");
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.logs && data.logs.length > 0) {
          const newEvts = data.logs.map((l: any) => ({
            id: String(l.id),
            timestamp: l.createdAt,
            employee: l.employeeId,
            level: l.level || "info",
            message: l.message,
          }));
          setEvents((prev) => [...prev.slice(-30), ...newEvts]);
        }
        refreshJobs();
      } catch {
        // heartbeat or unparseable
      }
    };

    return () => {
      evtSource.close();
    };
  }, []);

  const activeJob = jobs.find((j) => !["DONE", "ERROR"].includes(j.state)) || null;

  // Derive employee status based on active job
  const employees: EmployeeInfo[] = ROSTER.map((r) => {
    let status: "idle" | "thinking" | "working" | "done" | "error" | "waiting" = "idle";
    if (activeJob) {
      if (activeJob.state === "ERROR") status = "error";
      else if (
        (activeJob.state === "BRIEFED" && r.id === "producer") ||
        (activeJob.state === "SCRIPTING" && r.id === "scriptwriter") ||
        (activeJob.state === "ART_PLANNING" && r.id === "artDirector") ||
        (activeJob.state === "ILLUSTRATING" && r.id === "illustrator") ||
        (activeJob.state === "VOICING" && r.id === "voiceActor") ||
        (activeJob.state === "ANIMATING" && r.id === "animator") ||
        (activeJob.state === "EDITING" && r.id === "editor") ||
        (activeJob.state === "SOCIAL" && r.id === "socialManager")
      ) {
        status = "working";
      } else if (
        (activeJob.state === "SCRIPT_REVIEW" && r.id === "scriptwriter") ||
        (activeJob.state === "KEYFRAME_REVIEW" && r.id === "illustrator")
      ) {
        status = "waiting";
      }
    }

    const propsMap: Record<Role, string> = {
      producer: "Whiteboard",
      scriptwriter: "CRT Typewriter",
      artDirector: "Easel & Swatches",
      illustrator: "Drawing Tablet",
      animator: "Twin Monitors",
      voiceActor: "Padded Sound Booth",
      editor: "Editing Console",
      socialManager: "Launch Window",
    };

    return {
      id: r.id,
      name: r.name,
      title: r.title,
      desk: `Desk ${r.id.slice(0, 3).toUpperCase()}`,
      status,
      prop: propsMap[r.id],
      color: r.color,
    };
  });

  const gates: GateInfo[] = [
    {
      name: "SCRIPT_REVIEW",
      label: "Gate 1: Script Review",
      isWaiting: activeJob?.state === "SCRIPT_REVIEW",
      jobId: activeJob?.id,
    },
    {
      name: "KEYFRAME_REVIEW",
      label: "Gate 2: Keyframe Review",
      isWaiting: activeJob?.state === "KEYFRAME_REVIEW",
      jobId: activeJob?.id,
    },
  ];

  const handleApproveGate = async (
    jobId: string,
    gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
    decision: "approved" | "rejected",
    comment?: string
  ) => {
    await fetch(`/api/jobs/${jobId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gate, decision, comment }),
    });
    refreshJobs();
  };

  const handleRetryStage = async (jobId: string) => {
    await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    refreshJobs();
  };

  const handleCreateReel = async (data: { topic: string; targetSeconds: number; platforms: any[] }) => {
    await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    refreshJobs();
  };

  const handleSaveSkill = async (role: Role, prompt: string, note?: string) => {
    await fetch(`/api/employees/${role}/skill`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, note }),
    });
    refreshStaff();
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <CrtOverlay />

      <Header
        budgetMtdPhp={budgetData.mtdPhp}
        budgetCapPhp={budgetData.budgetCapPhp}
        inFlightCount={jobs.filter((j) => !["DONE", "ERROR"].includes(j.state)).length}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused(!isPaused)}
        activeStage={activeJob?.state}
      />

      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        budgetMtdPhp={budgetData.mtdPhp}
        budgetCapPhp={budgetData.budgetCapPhp}
        isMockMode={settingsData.mockMode}
      />

      {/* Main Content Area */}
      <main className="pl-60 pt-16 pb-14 px-4 overflow-y-auto">
        {activeTab === "office-floor" && (
          <OfficeFloorView
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={setSelectedEmployee}
            activeJob={activeJob}
            gates={gates}
            onApproveGate={handleApproveGate}
            inspectorData={{
              skillPrompt: staffData.find((s) => s.id === selectedEmployee)?.prompt,
              provider: staffData.find((s) => s.id === selectedEmployee)?.provider,
              model: staffData.find((s) => s.id === selectedEmployee)?.model,
              activeVersion: staffData.find((s) => s.id === selectedEmployee)?.activeVersion,
              spendJobEst: 24,
              spendMonthEst: 140,
            }}
          />
        )}

        {activeTab === "pipeline-kanban" && (
          <PipelineKanbanView
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelectJob={(j) => setSelectedJobId(j.id)}
            onApproveGate={handleApproveGate}
            onRetryStage={handleRetryStage}
            onOpenNewReelModal={() => setIsNewReelOpen(true)}
          />
        )}

        {activeTab === "staff-roster" && (
          <StaffRosterView staff={staffData} onSaveSkill={handleSaveSkill} />
        )}

        {activeTab === "budget-costs" && (
          <BudgetCostsView
            budgetCapPhp={budgetData.budgetCapPhp}
            fxUsdPhp={budgetData.fxUsdPhp}
            mtdPhp={budgetData.mtdPhp}
            mtdUsd={budgetData.mtdUsd}
            costEvents={budgetData.costEvents}
            reelsFinishedMonth={jobs.filter((j) => j.state === "DONE").length}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            mockMode={settingsData.mockMode}
            budgetCapPhp={settingsData.budgetCapPhp}
            fxUsdPhp={settingsData.fxUsdPhp}
            keys={settingsData.keys}
          />
        )}
      </main>

      <CommandConsole
        events={events}
        onSubmitBrief={(topic) => handleCreateReel({ topic, targetSeconds: 24, platforms: ["tiktok"] })}
      />

      <NewReelModal
        isOpen={isNewReelOpen}
        onClose={() => setIsNewReelOpen(false)}
        onSubmit={handleCreateReel}
      />
    </div>
  );
}

function calculateProgress(state: string): number {
  const steps: Record<string, number> = {
    BRIEFED: 10,
    SCRIPTING: 20,
    SCRIPT_REVIEW: 30,
    ART_PLANNING: 40,
    ILLUSTRATING: 50,
    KEYFRAME_REVIEW: 60,
    VOICING: 70,
    ANIMATING: 80,
    EDITING: 90,
    SOCIAL: 95,
    READY_TO_POST: 98,
    DONE: 100,
    ERROR: 0,
  };
  return steps[state] || 0;
}
