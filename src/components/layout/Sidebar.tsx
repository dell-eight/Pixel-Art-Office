"use client";

import React from "react";
import { SegmentedBar } from "@/components/ui/SegmentedBar";

export type TabId = "office-floor" | "pipeline-kanban" | "staff-roster" | "budget-costs" | "settings";

export interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  budgetMtdPhp: number;
  budgetCapPhp: number;
  isMockMode?: boolean;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  budgetMtdPhp,
  budgetCapPhp,
  isMockMode = true,
}: SidebarProps) {
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "office-floor", label: "Office Floor", icon: "apartment" },
    { id: "pipeline-kanban", label: "Pipeline Kanban", icon: "view_kanban" },
    { id: "staff-roster", label: "Staff Roster", icon: "groups" },
    { id: "budget-costs", label: "Budget & Costs", icon: "payments" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <aside className="fixed left-0 top-14 bottom-12 w-60 bg-[#0b0d19] z-40 flex flex-col py-3 border-r border-[#272a3b]">
      {/* Channels Label */}
      <div className="px-4 mb-2">
        <span className="font-mono text-label-sm text-outline uppercase tracking-wider">
          STUDIO CHANNELS
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 space-y-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-all border ${
                isActive
                  ? "bg-surface-container text-primary font-bold border-[#272a3b] shadow-[inset_2px_0_0_0_#f59e0b]"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface border-transparent"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isActive ? "text-primary" : "text-outline"
                }`}
              >
                {tab.icon}
              </span>
              <span className="font-headline text-headline-sm">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Mini Meter and Mode Badge */}
      <div className="px-3 pt-3 border-t border-[#272a3b] space-y-2">
        <div className="flex items-center justify-between text-label-sm font-mono">
          <span className="text-on-surface-variant">CAP USAGE (est.)</span>
          <span className="text-primary font-bold">
            {Math.round((budgetMtdPhp / (budgetCapPhp || 1)) * 100)}%
          </span>
        </div>
        <SegmentedBar value={budgetMtdPhp} max={budgetCapPhp} segments={8} className="w-full" />
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-label-xs text-outline">ENVIRONMENT:</span>
          <span
            className={`font-mono text-label-xs px-1.5 py-0.5 rounded border ${
              isMockMode
                ? "bg-surface-container border-secondary/40 text-secondary"
                : "bg-primary-container/20 border-primary/50 text-primary"
            }`}
          >
            {isMockMode ? "MOCK MODE" : "LIVE PROVIDERS"}
          </span>
        </div>
      </div>
    </aside>
  );
}
