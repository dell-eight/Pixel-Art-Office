"use client";

import React, { useState } from "react";
import { MechanicalButton } from "@/components/ui/MechanicalButton";

export interface PipelineEvent {
  id: string;
  timestamp: string;
  employee?: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface CommandConsoleProps {
  events: PipelineEvent[];
  onSubmitBrief: (topic: string) => void;
  isSubmitting?: boolean;
}

export function CommandConsole({
  events,
  onSubmitBrief,
  isSubmitting = false,
}: CommandConsoleProps) {
  const [inputVal, setInputVal] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim();
    if (!clean || isSubmitting) return;
    onSubmitBrief(clean);
    setInputVal("");
  };

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  return (
    <footer className="fixed bottom-0 left-60 right-0 h-12 bg-[#0b0d19] border-t border-[#272a3b] z-40 px-3 flex items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.4)]">
      {/* Latest live event ticker */}
      <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xl">
        <span className="material-symbols-outlined text-outline text-[16px] shrink-0">
          terminal
        </span>
        <div className="font-mono text-label-sm truncate">
          {latestEvent ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="text-outline">[{latestEvent.timestamp.slice(11, 19)}]</span>
              {latestEvent.employee && (
                <span className="text-primary font-bold">[{latestEvent.employee}]</span>
              )}
              <span
                className={
                  latestEvent.level === "error"
                    ? "text-error"
                    : latestEvent.level === "warn"
                    ? "text-primary"
                    : "text-on-surface"
                }
              >
                {latestEvent.message}
              </span>
            </span>
          ) : (
            <span className="text-on-surface-variant">Pipeline idle. Ready for new reel brief.</span>
          )}
        </div>
      </div>

      {/* Brief Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0">
        <div className="relative flex items-center w-80 lg:w-96">
          <span className="material-symbols-outlined absolute left-2 text-primary-container text-[16px] pointer-events-none">
            bolt
          </span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="New reel brief: e.g. Tiny off-grid cabin plumbing"
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/50 border border-[#272a3b] rounded py-1 pl-7 pr-3 font-mono text-label-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] focus:outline-none focus:border-primary transition-all"
            disabled={isSubmitting}
          />
        </div>
        <MechanicalButton
          type="submit"
          variant="primary"
          size="sm"
          disabled={!inputVal.trim() || isSubmitting}
          icon="send"
        >
          {isSubmitting ? "STARTING..." : "CREATE REEL"}
        </MechanicalButton>
      </form>
    </footer>
  );
}
