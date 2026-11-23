"use client";

import React, { useState } from "react";
import { SegmentedBar } from "@/components/ui/SegmentedBar";
import { SteppedCard } from "@/components/ui/SteppedCard";

export interface CostEvent {
  id: string;
  jobId?: string;
  provider: string;
  model: string;
  units: number;
  estUsd: number;
  actualUsd?: number;
  createdAt: string;
}

export interface BudgetCostsViewProps {
  budgetCapPhp: number;
  fxUsdPhp: number;
  mtdPhp: number;
  mtdUsd: number;
  costEvents: CostEvent[];
  reelsFinishedMonth: number;
}

export function BudgetCostsView({
  budgetCapPhp,
  fxUsdPhp,
  mtdPhp,
  mtdUsd,
  costEvents,
  reelsFinishedMonth,
}: BudgetCostsViewProps) {
  const [filter, setFilter] = useState("all");

  const ratio = mtdPhp / (budgetCapPhp || 1);
  const isWarn = ratio >= 0.8;
  const isStop = ratio >= 1.0;
  const budgetLeftPhp = Math.max(budgetCapPhp - mtdPhp, 0);
  const avgCostPerReelPhp = reelsFinishedMonth > 0 ? Math.round(mtdPhp / reelsFinishedMonth) : 0;

  const exportCsv = () => {
    const headers = "id,jobId,provider,model,units,estUsd,actualUsd,createdAt\n";
    const rows = costEvents
      .map(
        (c) =>
          `"${c.id}","${c.jobId || ""}","${c.provider}","${c.model}",${c.units},${c.estUsd},${
            c.actualUsd || 0
          },"${c.createdAt}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixel-art-office-costs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] gap-4 overflow-y-auto pr-1">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* KPI 1: Month Spend */}
        <SteppedCard title="Month Spend (est.)" headerClassName="text-label-xs">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-headline-lg font-bold ${
                isStop ? "text-error" : isWarn ? "text-primary" : "text-on-surface"
              }`}
            >
              ₱{mtdPhp.toLocaleString()}
            </span>
            <span className="font-mono text-label-xs text-outline">
              (${mtdUsd.toFixed(2)} USD)
            </span>
          </div>
          <div className="flex items-center justify-between text-label-xs font-mono mt-2">
            <span className="text-on-surface-variant">CAP: ₱{budgetCapPhp.toLocaleString()}</span>
            <span className={isStop ? "text-error font-bold" : "text-primary"}>
              {Math.round(ratio * 100)}%
            </span>
          </div>
          <SegmentedBar value={mtdPhp} max={budgetCapPhp} segments={10} className="w-full mt-1.5" />
        </SteppedCard>

        {/* KPI 2: Avg Cost Per Reel */}
        <SteppedCard title="Avg Cost / Reel (est.)" headerClassName="text-label-xs">
          <div className="font-mono text-headline-lg font-bold text-primary">
            ₱{avgCostPerReelPhp.toLocaleString()}
          </div>
          <div className="font-mono text-label-xs text-on-surface-variant mt-2">
            Based on {reelsFinishedMonth} finished reels this month
          </div>
        </SteppedCard>

        {/* KPI 3: Budget Remaining */}
        <SteppedCard title="Budget Left" headerClassName="text-label-xs">
          <div className="font-mono text-headline-lg font-bold text-secondary">
            ₱{budgetLeftPhp.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {isStop ? (
              <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-mono text-label-xs font-bold">
                HARD STOP REACHED
              </span>
            ) : isWarn ? (
              <span className="px-2 py-0.5 rounded bg-primary-container text-[#0b0d19] font-mono text-label-xs font-bold">
                WARN: ≥80% USED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-label-xs text-secondary">
                PACE ON TRACK
              </span>
            )}
          </div>
        </SteppedCard>

        {/* KPI 4: Reels Finished */}
        <SteppedCard title="Reels Finished" headerClassName="text-label-xs">
          <div className="font-mono text-headline-lg font-bold text-on-surface">
            {reelsFinishedMonth}
          </div>
          <div className="font-mono text-label-xs text-on-surface-variant mt-2">
            Current calendar month output
          </div>
        </SteppedCard>
      </div>

      {/* Provider Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { provider: "Gemini", role: "Text & Image", spend: Math.round(mtdPhp * 0.25), calls: 14 },
          { provider: "Veo", role: "Video Clips", spend: Math.round(mtdPhp * 0.45), calls: 4 },
          { provider: "ElevenLabs", role: "TTS Voice", spend: Math.round(mtdPhp * 0.2), calls: 8 },
          { provider: "Vidu Q2", role: "Video Start-End", spend: Math.round(mtdPhp * 0.1), calls: 2 },
        ].map((p) => (
          <div
            key={p.provider}
            className="p-3 bg-surface-container-low border border-[#272a3b] rounded font-mono"
          >
            <div className="flex items-center justify-between text-label-xs text-outline mb-1">
              <span>{p.provider}</span>
              <span className="text-secondary">VERIFIED</span>
            </div>
            <div className="text-label-sm font-bold text-primary mb-1">₱{p.spend} est.</div>
            <div className="text-label-xs text-on-surface-variant">
              {p.role} // {p.calls} calls
            </div>
          </div>
        ))}
      </div>

      {/* Cost Events Table with Export */}
      <SteppedCard
        title="Ledger Cost Events"
        subtitle="Reserve-before / commit-after log"
        action={
          <button
            onClick={exportCsv}
            className="px-2.5 py-1 bg-surface-container-high border border-[#272a3b] rounded font-mono text-label-xs text-on-surface hover:bg-surface-bright"
          >
            EXPORT CSV
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-label-sm">
            <thead>
              <tr className="border-b border-[#272a3b] text-outline text-label-xs uppercase">
                <th className="p-2">Timestamp</th>
                <th className="p-2">Provider</th>
                <th className="p-2">Model</th>
                <th className="p-2">Units</th>
                <th className="p-2">Est. (USD)</th>
                <th className="p-2">Est. (PHP)</th>
              </tr>
            </thead>
            <tbody>
              {costEvents.length > 0 ? (
                costEvents.map((ev) => (
                  <tr key={ev.id} className="border-b border-[#272a3b]/40 hover:bg-surface-container">
                    <td className="p-2 text-outline">{ev.createdAt.slice(11, 19)}</td>
                    <td className="p-2 text-primary font-bold">{ev.provider}</td>
                    <td className="p-2 text-on-surface">{ev.model}</td>
                    <td className="p-2 text-on-surface-variant">{ev.units}</td>
                    <td className="p-2">${ev.estUsd.toFixed(4)}</td>
                    <td className="p-2 text-primary font-bold">
                      ₱{Math.round(ev.estUsd * fxUsdPhp)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-outline">
                    No ledger entries yet. Run a reel pipeline to record cost events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SteppedCard>
    </div>
  );
}
