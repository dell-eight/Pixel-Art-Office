"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GateReviewModal,
  type GateDecisionItem,
  type GateReviewSubmission,
  type KeyframeItem,
} from "@/components/gates/GateReviewPanel";
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
  type EmployeeStatsData,
  type GateInfo,
  type JobArtifactsBundle,
  type SkillHistoryItem,
} from "@/components/views/OfficeFloorView";
import { PipelineKanbanView, type KanbanJob } from "@/components/views/PipelineKanbanView";
import { SettingsView } from "@/components/views/SettingsView";
import { StaffRosterView, type StaffMember } from "@/components/views/StaffRosterView";
import { REROLL_CAPS } from "@/server/pipeline/types";
import { EMPLOYEE_CHECKLISTS } from "@/shared/checklists";
import { ROSTER, type EmployeeStatus, type Role } from "@/shared/roster";
import type { Script, Social } from "@/shared/schemas";

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
    metaJson?: string | null;
  }[];
  gates?: GateDecisionItem[];
  logs?: {
    id: number;
    employeeId?: string | null;
    level: string;
    message: string;
    createdAt: string;
  }[];
  ledger?: {
    estUsd?: string | number;
    actualUsd?: string | number | null;
  }[];
}

interface EmployeeActivity {
  status: EmployeeStatus;
  progress?: number;
  stage?: string;
  message?: string;
}

function parseMeta(metaJson?: string | null): Record<string, any> {
  if (!metaJson) return {};
  try {
    return JSON.parse(metaJson);
  } catch {
    return {};
  }
}

function buildJobArtifacts(job?: RawJobRecord | null): JobArtifactsBundle {
  const kfByIndex = new Map<number, KeyframeItem>();
  const voice: { id: string; beat?: number; durationSec?: number }[] = [];
  const clips: { id: string; beat?: number; seconds?: number }[] = [];
  let reelId: string | undefined;
  let thumbnailId: string | undefined;

  for (const a of job?.artifacts ?? []) {
    const meta = parseMeta(a.metaJson);
    if (a.kind === "keyframe") {
      const idx = typeof meta.index === "number" ? meta.index : kfByIndex.size;
      kfByIndex.set(idx, {
        id: a.id,
        index: idx,
        addObject: meta.addObject,
        revised: Boolean(meta.revised),
      });
    } else if (a.kind === "voice") {
      voice.push({ id: a.id, beat: meta.beat, durationSec: meta.durationSec });
    } else if (a.kind === "clip") {
      clips.push({ id: a.id, beat: meta.beat, seconds: meta.seconds });
    } else if (a.kind === "reel") {
      reelId = a.id;
    } else if (a.kind === "thumbnail") {
      thumbnailId = a.id;
    }
  }

  const keyframes = Array.from(kfByIndex.values()).sort((a, b) => a.index - b.index);
  return { keyframes, voice, clips, reelId, thumbnailId };
}

function parseStageJson<T>(job: RawJobRecord | null | undefined, stage: string): T | null {
  const run = job?.stageRuns?.find((sr) => sr.stage === stage && sr.status === "done" && sr.outputJson);
  if (!run?.outputJson) return null;
  try {
    return JSON.parse(run.outputJson) as T;
  } catch {
    return null;
  }
}

export default function AppStudio() {
  const [activeTab, setActiveTab] = useState<TabId>("office-floor");
  const [isPaused, setIsPaused] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isNewReelOpen, setIsNewReelOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Role>("producer");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [gateModal, setGateModal] = useState<{
    jobId: string;
    gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW";
  } | null>(null);

  const [rawJobs, setRawJobs] = useState<RawJobRecord[]>([]);
  const [jobs, setJobs] = useState<KanbanJob[]>([]);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [employeeActivity, setEmployeeActivity] = useState<Partial<Record<Role, EmployeeActivity>>>({});
  const [courier, setCourier] = useState<CourierState | null>(null);
  const courierTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedStats, setSelectedStats] = useState<EmployeeStatsData | undefined>(undefined);
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
      return merged.slice(-80);
    });
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        const list: RawJobRecord[] = data.jobs || [];
        setRawJobs(list);
        const mapped: KanbanJob[] = list.map((j) => {
          const arts = buildJobArtifacts(j);
          const usd = (j.ledger ?? []).reduce(
            (s, l) => s + Number(l.actualUsd ?? l.estUsd ?? 0),
            0,
          );
          const php = Math.round(usd * (budgetData.fxUsdPhp || 58) * 100) / 100;
          const thumbId = arts.thumbnailId ?? arts.keyframes.at(-1)?.id;
          return {
            id: j.id,
            title: j.title,
            state: j.state,
            progressPercent: calculateProgress(j.state),
            costEstPhp: php,
            thumbnailUrl: thumbId ? `/api/artifacts/${thumbId}` : undefined,
            error: j.error ?? undefined,
            createdAt: j.createdAt,
            gates: j.gates,
          };
        });
        setJobs(mapped);
      }
    } catch {
      // ignore
    }
  }, [budgetData.fxUsdPhp]);

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
        const skillsArr = emp?.skills ?? [];
        const activeSkillRow =
          skillsArr.find((s: any) => s.version === emp?.activeVersion) ?? skillsArr[0];
        const parsedSkill = activeSkillRow ? JSON.parse(activeSkillRow.skillJson) : null;
        const history: SkillHistoryItem[] = skillsArr.map((s: any) => {
          let p = "";
          try {
            p = JSON.parse(s.skillJson).prompt ?? "";
          } catch {
            p = "";
          }
          return {
            version: s.version,
            note: s.note,
            createdAt: s.createdAt,
            prompt: p,
          };
        });
        const st: EmployeeStatsData | undefined = json.stats;
        list.push({
          id: r.id,
          name: r.name,
          title: r.title,
          desk: `Desk ${r.id.slice(0, 3).toUpperCase()}`,
          status: "idle",
          activeVersion: emp?.activeVersion || 1,
          provider: parsedSkill?.provider || "gemini",
          model: parsedSkill?.model || "gemini-flash",
          runsMonth: st?.runsThisMonth ?? 0,
          successRatePercent: st?.successRatePercent ?? 100,
          avgDurationSec: st?.avgDurationSec ?? 0,
          avgCostEstPhp: st?.avgCostEstPhp ?? 0,
          monthSpendEstPhp: st?.monthSpendEstPhp ?? 0,
          rerollCap: REROLL_CAPS[r.id] ?? 3,
          prompt: parsedSkill?.prompt || "",
          checklist: json.checklist ?? EMPLOYEE_CHECKLISTS[r.id] ?? [],
          skillHistory: history,
        });
      } catch {
        list.push({
          id: r.id,
          name: r.name,
          title: r.title,
          desk: `Desk ${r.id.slice(0, 3).toUpperCase()}`,
          status: "idle",
          activeVersion: 1,
          provider: "gemini",
          model: "gemini-flash",
          runsMonth: 0,
          successRatePercent: 100,
          avgDurationSec: 0,
          avgCostEstPhp: 0,
          monthSpendEstPhp: 0,
          rerollCap: REROLL_CAPS[r.id] ?? 3,
          prompt: "",
          checklist: EMPLOYEE_CHECKLISTS[r.id] ?? [],
          skillHistory: [],
        });
      }
    }
    setStaffData(list);
  }, []);

  const activeJob = jobs.find((j) => !["DONE", "ERROR", "REJECTED"].includes(j.state)) || null;
  const displayJob = activeJob ?? jobs[0] ?? null;
  const activeRawJob = rawJobs.find((j) => j.id === (activeJob?.id ?? rawJobs[0]?.id)) || null;

  // Fetch per-employee stats scoped to the current/selected job whenever selection or job changes
  const refreshSelectedStats = useCallback(async () => {
    try {
      const q = activeRawJob?.id ? `?jobId=${encodeURIComponent(activeRawJob.id)}` : "";
      const res = await fetch(`/api/employees/${selectedEmployee}/skill${q}`);
      if (res.ok) {
        const json = await res.json();
        if (json.stats) setSelectedStats(json.stats);
      }
    } catch {
      // ignore
    }
  }, [activeRawJob?.id, selectedEmployee]);

  useEffect(() => {
    refreshSelectedStats();
  }, [refreshSelectedStats, activeJob?.state]);

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
            refreshBudget();
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
            refreshStaff();
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
            refreshStaff();
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

  const employees: EmployeeInfo[] = ROSTER.map((r) => {
    const live = employeeActivity[r.id];
    let status: EmployeeStatus = live?.status ?? "idle";
    const progress = live?.progress;
    const taskMessage = live?.message;

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

  const handleGateSubmit = async (
    jobId: string,
    gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW",
    payload: GateReviewSubmission,
  ) => {
    const res = await fetch(`/api/jobs/${jobId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gate, ...payload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Gate update failed" }));
      throw new Error(err.error || "Gate update failed");
    }
    if (payload.decision === "approved") {
      const gateRole: Role = gate === "KEYFRAME_REVIEW" ? "illustrator" : "scriptwriter";
      setEmployeeActivity((prev) => ({
        ...prev,
        [gateRole]: { status: "done", progress: 100, stage: gate },
      }));
    }
    await refreshJobs();
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
      await refreshStaff();
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
    await refreshStaff();
  };

  const handleRollbackSkill = async (role: Role, version: number) => {
    await fetch(`/api/employees/${role}/skill`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollbackToVersion: version }),
    });
    await refreshStaff();
  };

  const selectedStageRun = activeRawJob?.stageRuns?.find((sr) => sr.employeeId === selectedEmployee);
  let formattedOutput: string | undefined;
  if (selectedStageRun?.outputJson) {
    try {
      formattedOutput = JSON.stringify(JSON.parse(selectedStageRun.outputJson), null, 2);
    } catch {
      formattedOutput = selectedStageRun.outputJson;
    }
  }

  const parsedScript = parseStageJson<Script>(activeRawJob, "SCRIPTING");
  const parsedSocial = parseStageJson<Social>(activeRawJob, "SOCIAL");
  const activeArtifacts = buildJobArtifacts(activeRawJob);

  const dbEmployeeLogs: PipelineEvent[] = (activeRawJob?.logs ?? [])
    .filter((l) => !l.employeeId || l.employeeId === selectedEmployee)
    .map((l) => ({
      id: `joblog-${l.id}`,
      timestamp: l.createdAt,
      employee: l.employeeId ?? undefined,
      level: (l.level as "info" | "warn" | "error") || "info",
      message: l.message,
    }));
  const sseEmployeeLogs = events.filter((ev) => !ev.employee || ev.employee === selectedEmployee);
  const mergedLogsMap = new Map<string, PipelineEvent>();
  for (const item of [...dbEmployeeLogs, ...sseEmployeeLogs]) {
    mergedLogsMap.set(item.id, item);
  }
  const employeeLogs = Array.from(mergedLogsMap.values()).slice(-25).reverse();

  const selectedStaff = staffData.find((s) => s.id === selectedEmployee);
  const modalRawJob = gateModal
    ? rawJobs.find((j) => j.id === gateModal.jobId) ?? (activeRawJob?.id === gateModal.jobId ? activeRawJob : null)
    : null;
  const modalArtifacts = buildJobArtifacts(modalRawJob);
  const modalScript = parseStageJson<Script>(modalRawJob, "SCRIPTING");

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <CrtOverlay />

      <Header
        budgetMtdPhp={budgetData.mtdPhp}
        budgetCapPhp={budgetData.budgetCapPhp}
        inFlightCount={jobs.filter((j) => !["DONE", "ERROR", "REJECTED"].includes(j.state)).length}
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

      <main className="pl-60 pt-16 pb-14 px-4 overflow-y-auto">
        {activeTab === "office-floor" && (
          <OfficeFloorView
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={setSelectedEmployee}
            activeJob={displayJob}
            courier={courier}
            gates={gates}
            onOpenGateModal={(jobId, gate) => setGateModal({ jobId, gate })}
            onGateSubmit={handleGateSubmit}
            onSaveSkill={handleSaveSkill}
            onRollbackSkill={handleRollbackSkill}
            inspectorData={{
              skillPrompt: selectedStaff?.prompt,
              provider: selectedStaff?.provider,
              model: selectedStaff?.model,
              activeVersion: selectedStaff?.activeVersion,
              checklist: selectedStaff?.checklist,
              skillHistory: selectedStaff?.skillHistory,
              latestOutput: formattedOutput,
              parsedScript,
              parsedSocial,
              artifacts: activeArtifacts,
              gateHistory: activeRawJob?.gates,
              logs: employeeLogs,
              stats: selectedStats,
            }}
          />
        )}

        {activeTab === "pipeline-kanban" && (
          <PipelineKanbanView
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelectJob={(j) => setSelectedJobId(j.id)}
            onApproveGate={(jobId, gate, decision, comment) =>
              handleGateSubmit(jobId, gate, { decision, comment })
            }
            onOpenGateModal={(jobId, gate) => setGateModal({ jobId, gate })}
            onRetryStage={handleRetryStage}
            onOpenNewReelModal={() => setIsNewReelOpen(true)}
          />
        )}

        {activeTab === "staff-roster" && (
          <StaffRosterView
            staff={staffData}
            onSaveSkill={handleSaveSkill}
            onRollbackSkill={handleRollbackSkill}
          />
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

      {gateModal && (
        <GateReviewModal
          isOpen
          onClose={() => setGateModal(null)}
          jobId={gateModal.jobId}
          jobTitle={modalRawJob?.title ?? "Reel Review"}
          gate={gateModal.gate}
          script={modalScript}
          keyframes={modalArtifacts.keyframes}
          gateHistory={modalRawJob?.gates}
          onSubmit={(payload) => handleGateSubmit(gateModal.jobId, gateModal.gate, payload)}
        />
      )}
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
    REJECTED: 0,
    ERROR: 0,
  };
  return steps[state] || 0;
}
