"use client";

import React, { useEffect, useState } from "react";
import { SegmentedBar } from "@/components/ui/SegmentedBar";

export interface HeaderProps {
  budgetMtdPhp: number;
  budgetCapPhp: number;
  inFlightCount: number;
  isPaused: boolean;
  onTogglePause: () => void;
  activeStage?: string;
}

export function Header({
  budgetMtdPhp,
  budgetCapPhp,
  inFlightCount,
  isPaused,
  onTogglePause,
  activeStage,
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    function update() {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString("en-US", { weekday: "short" }) +
          " " +
          now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const ratio = budgetMtdPhp / (budgetCapPhp || 1);
  const isWarn = ratio >= 0.8;
  const isStop = ratio >= 1.0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b0d19] text-on-surface border-b border-[#272a3b] shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
      <div className="h-14 w-full px-4 flex items-center justify-between gap-4">
        {/* Logo and App Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-primary-container text-[22px]">
              videogame_asset
            </span>
            <span className="font-headline font-bold text-headline-sm tracking-wider uppercase text-primary-container truncate">
              Pixel-Art Office
            </span>
            <span className="hidden xl:inline font-mono text-label-sm text-outline">
              // AI FACELESS REEL STUDIO
            </span>
          </div>

          {/* Local Day & Time */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low border border-[#272a3b] rounded">
            <span className="material-symbols-outlined text-secondary text-[14px]">schedule</span>
            <span className="font-mono text-label-sm text-secondary font-bold">
              {timeStr || "LOCAL TIME"}
            </span>
          </div>

          {/* Queue Count */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low border border-[#272a3b] rounded">
            <span className="font-mono text-label-sm text-tertiary">
              Queue: {inFlightCount} in flight
            </span>
          </div>

          {/* Active Stage Indicator */}
          {activeStage && (
            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-high border border-primary/30 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-diode" />
              <span className="font-mono text-label-sm text-primary font-bold uppercase">
                Active: {activeStage}
              </span>
            </div>
          )}
        </div>

        {/* Right HUD: Budget Meter and Controls */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Budget Meter */}
          <div
            className={`flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded border transition-colors ${
              isStop
                ? "border-error shadow-[0_0_8px_rgba(255,180,171,0.2)]"
                : isWarn
                ? "border-primary shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                : "border-[#272a3b]"
            }`}
          >
            <div className="flex flex-col text-right">
              <div className="flex items-center gap-1 justify-end">
                <span className="font-mono text-label-xs text-on-surface-variant">est.</span>
                <span
                  className={`font-mono text-headline-sm font-bold ${
                    isStop ? "text-error" : isWarn ? "text-primary" : "text-on-surface"
                  }`}
                >
                  ₱{budgetMtdPhp.toLocaleString()}
                </span>
                <span className="font-mono text-label-sm text-on-surface-variant">
                  / ₱{budgetCapPhp.toLocaleString()}
                </span>
              </div>
              <SegmentedBar
                value={budgetMtdPhp}
                max={budgetCapPhp}
                segments={8}
                className="justify-end scale-90 -mr-1"
              />
            </div>
          </div>

          {/* Pause / Resume Pipeline Toggle */}
          <button
            onClick={onTogglePause}
            className={`px-3 py-1 font-mono text-label-sm rounded border flex items-center gap-1.5 select-none transition-all active:translate-y-[1px] ${
              isPaused
                ? "bg-error-container text-on-error-container border-error shadow-[0_0_8px_rgba(255,180,171,0.3)]"
                : "bg-surface-container-high text-on-surface border-[#272a3b] hover:bg-surface-bright"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isPaused ? "play_arrow" : "pause"}
            </span>
            <span className="font-bold">{isPaused ? "RESUME" : "PAUSE"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
