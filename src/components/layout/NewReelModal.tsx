"use client";

import React, { useState } from "react";
import { MechanicalButton } from "@/components/ui/MechanicalButton";
import { RecessedInput } from "@/components/ui/RecessedInput";

export interface NewReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { topic: string; targetSeconds: number; platforms: ("tiktok" | "instagram" | "youtube")[] }) => void;
}

export function NewReelModal({ isOpen, onClose, onSubmit }: NewReelModalProps) {
  const [topic, setTopic] = useState("");
  const [seconds, setSeconds] = useState(24);
  const [platforms, setPlatforms] = useState<("tiktok" | "instagram" | "youtube")[]>(["tiktok"]);

  if (!isOpen) return null;

  const togglePlatform = (p: "tiktok" | "instagram" | "youtube") => {
    if (platforms.includes(p)) {
      if (platforms.length > 1) setPlatforms(platforms.filter((x) => x !== p));
    } else {
      setPlatforms([...platforms, p]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      topic: topic.trim() || "Building the perfect off-grid cabin",
      targetSeconds: Number(seconds),
      platforms,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface-container-low border border-[#272a3b] rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container border-b border-[#272a3b]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">add_circle</span>
            <span className="font-headline font-bold text-headline-sm uppercase text-on-surface">
              New Reel Job
            </span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="font-mono text-label-sm text-on-surface-variant">
              TOPIC OR SEED IDEA (Leave blank for Producer research)
            </label>
            <RecessedInput
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Tiny aquaponics greenhouse system"
              icon="lightbulb"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-label-sm text-on-surface-variant">
              TARGET LENGTH: <span className="text-primary font-bold">{seconds}s</span> (20-35s spec)
            </label>
            <input
              type="range"
              min={20}
              max={35}
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
              className="w-full accent-primary bg-surface-container-highest h-2 rounded cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-label-sm text-on-surface-variant">TARGET PLATFORMS</label>
            <div className="flex items-center gap-2">
              {(["tiktok", "instagram", "youtube"] as const).map((p) => {
                const checked = platforms.includes(p);
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`flex-1 py-1.5 px-2 rounded border font-mono text-label-sm capitalize transition-all ${
                      checked
                        ? "bg-primary-container/20 border-primary text-primary font-bold"
                        : "bg-surface-container-high border-[#272a3b] text-on-surface-variant"
                    }`}
                  >
                    {p === "youtube" ? "Shorts" : p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#272a3b]">
            <MechanicalButton type="button" variant="ghost" size="md" onClick={onClose}>
              CANCEL
            </MechanicalButton>
            <MechanicalButton type="submit" variant="primary" size="md" icon="play_arrow">
              CREATE REEL
            </MechanicalButton>
          </div>
        </form>
      </div>
    </div>
  );
}
