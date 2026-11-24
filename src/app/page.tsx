"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CommandConsole, type PipelineEvent } from "@/components/layout/CommandConsole";
import { Header } from "@/components/layout/Header";
import { NewReelModal } from "@/components/layout/NewReelModal";
import { Sidebar, type TabId } from "@/components/layout/Sidebar";
import { CrtOverlay } from "@/components/ui/CrtOverlay";
import { BudgetCostsView } from "@/components/views/BudgetCostsView";
import {
  OfficeFloorView,
  type CourierState,
  type EmployeeInfo,
  type GateInfo,
} from "@/components/views/OfficeFloorView";
import { PipelineKanbanView, type KanbanJob } from "@/components/views/PipelineKanbanView";
import { SettingsView } from "@/components/views/SettingsView";
import { StaffRosterView, type StaffMember } from "@/components/views/StaffRosterView";
import { ROSTER, type EmployeeStatus, type Role } from "@/shared/roster";

interface RawJobRecord {
  id: string;
  title: string;
  state: string;
  error?: string | null;
  createdAt: string;
  stageRuns?: {
    id: string;
    stage: string;
    employeeId: string;
    status: string;
    outputJson?: string | null;
  }[];
  artifacts?: {
    id: string;
    kind: string;
    path: string;
  }[];
}

interface EmployeeActivity {
  status: EmployeeStatus;
  progress?: number;
  stage?: string;
  message?: string;
}

export default function AppStudio() {
  const [activeTab, setActiveTab] = useState<TabId>("office-floor");
  const [isPaused, setIsPaused] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isNewReelOpen, setIsNewReelOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Role>("producer");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Studio state
  const [rawJobs, setRawJobs] = useState<RawJobRecord[]>([]);
  const [jobs, setJobs] = useState<KanbanJob[]>([]);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [employeeActivity, setEmployeeActivity] = useState<Partial<Record<Role, EmployeeActivity>>>({});
  const [courier, setCourier] = useState<CourierState | null>(null);
  const courierTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const appendEvents = useCallback((incoming: PipelineEvent[]) => {
    if (incoming.length === 0) return;
    setEvents((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const item of incoming) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }
      return merged.slice(-60);
    });
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        const list: RawJobRecord[] = data.jobs || [];
        setRawJobs(list);
        const mapped: KanbanJob[] = list.map((j) => ({
          id: j.id,
          title: j.title,
          state: j.state,
          progressPercent: calculateProgress(j.state),
          costEstPhp: 48,
          error: j.error ?? undefined,
          createdAt: j.createdAt,
        }));
        setJobs(mapped);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshBudget = useCallback(async () => {
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
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const s = await res.json();
        setSettingsData(s);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshStaff = useCallback(async () => {
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
  }, []);

  const triggerCourierMove = useCallback(
    (fromDesk: string, toDesk: string, label: string, jobTitle: string) => {
      if (courierTimerRef.current) {
        clearTimeout(courierTimerRef.current);
      }
      setCourier({ pos: fromDesk, fromDesk, toDesk, label, jobTitle, active: true });
      courierTimerRef.current = setTimeout(() => {
        setCourier((prev) => (prev ? { ...prev, pos: toDesk } : null));
      }, 40);
    },
    [],
  );

  useEffect(() => {
    refreshJobs();
    refreshBudget();
    refreshSettings();
    refreshStaff();

    const evtSource = new EventSource("/api/events");
    evtSource.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);

        if (data.kind === "snapshot") {
          const snapLogs: PipelineEvent[] = (data.logs || []).map((l: any) => ({
            id: `db-${l.id}`,
            timestamp: l.createdAt,
            employee: l.employeeId ?? undefined,
            level: l.level || "info",
            message: l.message,
          }));
          const recentStudio: PipelineEvent[] = (data.recentEvents || []).map((e: any) => ({
            id: e.id,
            timestamp: e.timestamp,
            employee: e.employee ?? undefined,
            level: e.level || "info",
            message: e.message,
          }));
          appendEvents([...snapLogs, ...recentStudio]);
          refreshJobs();
          return;
        }

        if (data.kind === "studio" && data.event) {
          const ev = data.event;
          appendEvents([
            {
              id: ev.id,
              timestamp: ev.timestamp,
              employee: ev.employee ?? undefined,
              level: ev.level || "info",
              message: ev.message,
            },
          ]);

          if (ev.type === "stage:start" && ev.employee) {
            const role = ev.employee as Role;
            setEmployeeActivity((prev) => ({
              ...prev,
              [role]: { status: "working", progress: 0, stage: ev.stage, message: ev.message },
            }));
            setSelectedEmployee(role);
            setCourier(null);
          } else if (ev.type === "stage:progress" && ev.employee) {
            const role = ev.employee as Role;
            setEmployeeActivity((prev) => ({
              ...prev,
              [role]: {
                status: "working",
                progress: ev.progress ?? 50,
                stage: ev.stage,
                message: ev.message,
              },
            }));
          } else if (ev.type === "stage:end" && ev.employee) {
            const role = ev.employee as Role;
            setEmployeeActivity((prev) => ({
              ...prev,
              [role]: { status: "done", progress: 100, stage: ev.stage, message: ev.message },
            }));
            refreshJobs();
          } else if (ev.type === "courier:handoff" && ev.fromDesk && ev.toDesk) {
            triggerCourierMove(ev.fromDesk, ev.toDesk, ev.message, ev.jobTitle || "Active Reel");
          } else if (ev.type === "gate:waiting") {
            const gateRole: Role = ev.gate === "KEYFRAME_REVIEW" ? "illustrator" : "scriptwriter";
            setEmployeeActivity((prev) => ({
              ...prev,
              [gateRole]: { status: "waiting", progress: 100, stage: ev.gate, message: ev.message },
            }));
            setCourier(null);
            refreshJobs();
          } else if (ev.type === "gate:resolved") {
            if (ev.gate) {
              const gateRole: Role = ev.gate === "KEYFRAME_REVIEW" ? "illustrator" : "scriptwriter";
              setEmployeeActivity((prev) => ({
                ...prev,
                [gateRole]: { status: "done", progress: 100, stage: ev.gate, message: ev.message },
              }));
            }
            refreshJobs();
          } else if (ev.type === "job:state") {
            refreshJobs();
          } else if (ev.type === "job:done") {
            setCourier(null);
            setEmployeeActivity((prev) => {
              const next: Partial<Record<Role, EmployeeActivity>> = {};
              for (const r of ROSTER) {
                const cur = prev[r.id];
                next[r.id] =
                  cur?.status === "error"
                    ? cur
                    : { status: "done", progress: 100, stage: cur?.stage, message: cur?.message };
              }
              return next;
            });
            refreshJobs();
            refreshBudget();
          } else if (ev.type === "job:error") {
            setCourier(null);
            if (ev.employee) {
              const role = ev.employee as Role;
              setEmployeeActivity((prev) => ({
                ...prev,
                [role]: { status: "error", message: ev.message },
              }));
            }
            refreshJobs();
          } else if (ev.type === "demo:reset") {
            setJobs([]);
            setRawJobs([]);
            setEvents([]);
            setEmployeeActivity({});
            setCourier(null);
            refreshJobs();
            refreshBudget();
          }
          return;
        }
      } catch {
        // ignore ping or malformed frame
      }
    };

    return () => {
      evtSource.close();
      if (courierTimerRef.current) clearTimeout(courierTimerRef.current);
    };
  }, [appendEvents, refreshBudget, refreshJobs, refreshSettings, refreshStaff, triggerCourierMove]);

  const activeJob = jobs.find((j) => !["DONE", "ERROR"].includes(j.state)) || null;
  const displayJob = activeJob ?? jobs[0] ?? null;
  const activeRawJob = rawJobs.find((j) => j.id === (activeJob?.id ?? rawJobs[0]?.id)) || null;

  // Derive employee status combining DB job state + live SSE stage activity (supports parallel Art + Voice!)
  const employees: EmployeeInfo[] = ROSTER.map((r) => {
    const live = employeeActivity[r.id];
    let status: EmployeeStatus = live?.status ?? "idle";
    let progress = live?.progress;
    let taskMessage = live?.message;

    // Reconcile with activeJob state on initial load or gate pauses
    if (activeJob) {
      if (activeJob.state === "ERROR") {
        if (status === "working") status = "error";
      } else if (activeJob.state === "SCRIPT_REVIEW" && r.id === "scriptwriter") {
        status = "waiting";
      } else if (activeJob.state === "KEYFRAME_REVIEW" && r.id === "illustrator") {
        status = "waiting";
      } else if (!live) {
        if (
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
        } else if (activeRawJob?.stageRuns?.some((sr) => sr.employeeId === r.id && sr.status === "done")) {
          status = "done";
        }
      }
    } else if (rawJobs[0]?.state === "DONE" && !live) {
      status = "done";
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
      progress,
      taskMessage,
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
    comment?: string,
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
    setEmployeeActivity({});
    setCourier(null);
    await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    refreshJobs();
  };

  const handleResetDemo = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await fetch("/api/demo/reset", { method: "POST" });
      setJobs([]);
      setRawJobs([]);
      setEvents([]);
      setEmployeeActivity({});
      setCourier(null);
      await refreshJobs();
      await refreshBudget();
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveSkill = async (role: Role, prompt: string, note?: string) => {
    await fetch(`/api/employees/${role}/skill`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, note }),
    });
    refreshStaff();
  };

  const selectedStageRun = activeRawJob?.stageRuns?.find((sr) => sr.employeeId === selectedEmployee);
  const selectedReelArtifact =
    selectedEmployee === "editor"
      ? activeRawJob?.artifacts?.find((a) => a.kind === "reel")
      : undefined;

  let formattedOutput: string | undefined;
  if (selectedStageRun?.outputJson) {
    try {
      formattedOutput = JSON.stringify(JSON.parse(selectedStageRun.outputJson), null, 2);
    } catch {
      formattedOutput = selectedStageRun.outputJson;
    }
  }

  const employeeLogs = events
    .filter((ev) => !ev.employee || ev.employee === selectedEmployee)
    .slice(-20)
    .reverse();

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
        isMockMode={settingsData.mockMode}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
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
            activeJob={displayJob}
            courier={courier}
            gates={gates}
            onApproveGate={handleApproveGate}
            inspectorData={{
              skillPrompt: staffData.find((s) => s.id === selectedEmployee)?.prompt,
              provider: staffData.find((s) => s.id === selectedEmployee)?.provider,
              model: staffData.find((s) => s.id === selectedEmployee)?.model,
              activeVersion: staffData.find((s) => s.id === selectedEmployee)?.activeVersion,
              latestOutput: formattedOutput,
              reelArtifactId: selectedReelArtifact?.id,
              logs: employeeLogs,
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
