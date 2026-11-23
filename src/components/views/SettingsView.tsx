"use client";

import React from "react";
import { SteppedCard } from "@/components/ui/SteppedCard";

export interface SettingsViewProps {
  mockMode: boolean;
  budgetCapPhp: number;
  fxUsdPhp: number;
  keys: {
    gemini: boolean;
    elevenlabs: boolean;
    vidu: boolean;
    openai: boolean;
    kling: boolean;
  };
}

export function SettingsView({ mockMode, budgetCapPhp, fxUsdPhp, keys }: SettingsViewProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] gap-4 overflow-y-auto max-w-4xl">
      <div className="font-headline font-bold text-headline-sm uppercase text-on-surface">
        STUDIO SETTINGS & ENVIRONMENT
      </div>

      {/* Provider API Key Presence (Yes/No only, never expose secret values) */}
      <SteppedCard
        title="API Key Configuration"
        subtitle="Keys are stored securely in .env / .env.local and never exposed to the client"
      >
        <div className="space-y-3 font-mono text-label-sm">
          {[
            { id: "gemini", name: "Gemini API Key (Text, Image, Veo)", set: keys.gemini },
            { id: "elevenlabs", name: "ElevenLabs API Key (TTS Voice)", set: keys.elevenlabs },
            { id: "vidu", name: "Vidu API Key (Start-End2Video)", set: keys.vidu },
            { id: "openai", name: "OpenAI API Key (Text / DALL-E Fallback)", set: keys.openai },
            { id: "kling", name: "Kling API Key (Video Stub)", set: keys.kling },
          ].map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between p-3 bg-surface-container border border-[#272a3b] rounded"
            >
              <div>
                <span className="text-on-surface font-bold block">{k.name}</span>
                <span className="text-label-xs text-outline">Provider Authentication</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    k.set ? "bg-secondary shadow-[0_0_4px_#4edea3]" : "bg-outline"
                  }`}
                />
                <span
                  className={`font-mono text-label-xs font-bold px-2 py-0.5 rounded border ${
                    k.set
                      ? "bg-secondary-container/20 border-secondary text-secondary"
                      : "bg-surface-container-high border-[#272a3b] text-on-surface-variant"
                  }`}
                >
                  {k.set ? "CONFIGURED (YES)" : "NOT SET (NO)"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SteppedCard>

      {/* Studio Runtime & Budget Policy */}
      <SteppedCard title="Pipeline & Budget Controls">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-label-sm">
          <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-1">
            <span className="text-outline text-label-xs block">RUNTIME MODE</span>
            <div className="text-headline-sm font-bold text-primary">
              {mockMode ? "MOCK MODE (OFFLINE)" : "LIVE PRODUCTION"}
            </div>
            <p className="text-label-xs text-on-surface-variant pt-1">
              Offline fixtures with real ffmpeg rendering. Zero API credit spend.
            </p>
          </div>

          <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-1">
            <span className="text-outline text-label-xs block">MONTHLY BUDGET CAP</span>
            <div className="text-headline-sm font-bold text-secondary">
              ₱{budgetCapPhp.toLocaleString()} PHP
            </div>
            <p className="text-label-xs text-on-surface-variant pt-1">
              Warn at 80% (force draft tiers). Hard stop at 100%.
            </p>
          </div>

          <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-1">
            <span className="text-outline text-label-xs block">FOREIGN EXCHANGE RATE</span>
            <div className="text-headline-sm font-bold text-on-surface">
              ₱{fxUsdPhp} PHP / 1 USD
            </div>
            <p className="text-label-xs text-on-surface-variant pt-1">
              Conversion rate used for budget calculation.
            </p>
          </div>

          <div className="p-3 bg-surface-container border border-[#272a3b] rounded space-y-1">
            <span className="text-outline text-label-xs block">AI DISCLOSURE ENFORCEMENT</span>
            <div className="text-headline-sm font-bold text-secondary">MANDATORY</div>
            <p className="text-label-xs text-on-surface-variant pt-1">
              Reels without platform AI disclosure line cannot transition to DONE.
            </p>
          </div>
        </div>
      </SteppedCard>
    </div>
  );
}
