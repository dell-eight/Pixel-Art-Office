"use client";

import React, { useEffect, useState } from "react";
import { MechanicalButton } from "@/components/ui/MechanicalButton";
import { REEL, ScriptSchema, type Script } from "@/shared/schemas";

export interface GateDecisionItem {
  id: string;
  gate: string;
  decision: string;
  comment?: string | null;
  createdAt: string;
}

export interface KeyframeItem {
  id: string;
  index: number;
  addObject?: string;
  revised?: boolean;
}

export interface GateReviewSubmission {
  decision: "approved" | "request_changes" | "rejected";
  comment?: string;
  frameIndex?: number;
  editedScript?: Script;
}

export interface GateReviewPanelProps {
  jobId: string;
  jobTitle: string;
  gate: "SCRIPT_REVIEW" | "KEYFRAME_REVIEW";
  script?: Script | null;
  keyframes?: KeyframeItem[];
  gateHistory?: GateDecisionItem[];
  compact?: boolean;
  onSubmit: (payload: GateReviewSubmission) => Promise<void> | void;
}

export function GateReviewPanel({
  jobId,
  jobTitle,
  gate,
  script,
  keyframes = [],
  gateHistory = [],
  compact = false,
  onSubmit,
}: GateReviewPanelProps) {
  const [comment, setComment] = useState("");
  const [selectedFrame, setSelectedFrame] = useState<number | undefined>(undefined);
  const [draftScript, setDraftScript] = useState<Script | null>(script ?? null);
  const [isDirty, setIsDirty] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraftScript(script ?? null);
    setIsDirty(false);
    setErrorMsg(null);
    setSelectedFrame(undefined);
    setComment("");
  }, [jobId, gate, script]);

  const totalSeconds = draftScript ? draftScript.beats.reduce((sum, b) => sum + b.seconds, 0) : 0;

  const updateBeat = (idx: number, patch: Partial<Script["beats"][number]>) => {
    if (!draftScript) return;
    setDraftScript({
      ...draftScript,
      beats: draftScript.beats.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
    setIsDirty(true);
    setErrorMsg(null);
  };

  const handleAction = async (decision: "approved" | "request_changes" | "rejected") => {
    setErrorMsg(null);
    const trimmed = comment.trim();

    if ((decision === "request_changes" || decision === "rejected") && !trimmed) {
      setErrorMsg(
        decision === "rejected"
          ? "Please enter a rejection reason."
          : "Please enter a note describing what changes to make.",
      );
      return;
    }

    let validatedScript: Script | undefined;
    if (decision === "approved" && gate === "SCRIPT_REVIEW" && draftScript && isDirty) {
      const parsed = ScriptSchema.safeParse(draftScript);
      if (!parsed.success) {
        setErrorMsg(parsed.error.issues.map((i) => i.message).join("; "));
        return;
      }
      validatedScript = parsed.data;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        decision,
        comment: trimmed || undefined,
        frameIndex: gate === "KEYFRAME_REVIEW" ? selectedFrame : undefined,
        editedScript: validatedScript,
      });
      setComment("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 min-w-0 font-mono text-body-sm">
      {/* Header Banner */}
      <div className="p-2.5 bg-primary-container/10 border border-primary/40 rounded">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-primary font-bold text-label-sm">
            <span className="material-symbols-outlined text-[16px]">gavel</span>
            <span>{gate === "SCRIPT_REVIEW" ? "GATE 1: SCRIPT REVIEW" : "GATE 2: KEYFRAME REVIEW"}</span>
          </div>
          <span className="text-label-xs text-on-surface-variant truncate max-w-[160px]">{jobTitle}</span>
        </div>
      </div>

      {/* Gate 1: Full Script (Editable before Approve) */}
      {gate === "SCRIPT_REVIEW" && draftScript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-label-xs">
            <span className="text-outline uppercase">Script (Editable before Approve)</span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded border ${
                totalSeconds >= REEL.minSeconds && totalSeconds <= REEL.maxSeconds
                  ? "border-secondary/40 text-secondary bg-secondary/10"
                  : "border-error text-error bg-error-container/20"
              }`}
            >
              {totalSeconds}s ({REEL.minSeconds}-{REEL.maxSeconds}s)
            </span>
          </div>

          <div className="p-2.5 bg-surface-container-lowest border border-[#272a3b] rounded space-y-2 max-h-72 overflow-y-auto">
            <div>
              <label className="text-[10px] text-outline block uppercase">Title</label>
              <input
                type="text"
                value={draftScript.title}
                onChange={(e) => {
                  setDraftScript({ ...draftScript, title: e.target.value });
                  setIsDirty(true);
                }}
                className="w-full bg-surface-container border border-[#272a3b] rounded px-2 py-1 text-label-sm text-on-surface"
              />
            </div>
            <div>
              <label className="text-[10px] text-outline block uppercase">Hook</label>
              <input
                type="text"
                value={draftScript.hook}
                onChange={(e) => {
                  setDraftScript({ ...draftScript, hook: e.target.value });
                  setIsDirty(true);
                }}
                className="w-full bg-surface-container border border-[#272a3b] rounded px-2 py-1 text-label-sm text-primary"
              />
            </div>

            <div className="space-y-2 pt-1">
              {draftScript.beats.map((b, i) => (
                <div key={b.index} className="p-2 bg-surface-container border border-[#272a3b] rounded space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-primary font-bold">
                      BEAT {i + 1}: +{b.so_you_add}
                    </span>
                    <label className="flex items-center gap-1 text-outline">
                      <span>Sec:</span>
                      <input
                        type="number"
                        min={REEL.minBeatSeconds}
                        max={REEL.maxBeatSeconds}
                        value={b.seconds}
                        onChange={(e) => updateBeat(i, { seconds: Number(e.target.value) })}
                        className="w-12 bg-surface-container-lowest border border-[#272a3b] rounded px-1 py-0.5 text-center text-on-surface"
                      />
                    </label>
                  </div>
                  <div className="text-[10px] text-on-surface-variant">
                    {b.you_do} → <em>{b.problem}</em> → <span className="text-secondary">{b.so_you_add}</span>
                  </div>
                  <textarea
                    rows={2}
                    value={b.narration}
                    onChange={(e) => updateBeat(i, { narration: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-[#272a3b] rounded p-1.5 text-label-xs text-on-surface"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Gate 2: Keyframe Image Grid with Single-Frame Selector */}
      {gate === "KEYFRAME_REVIEW" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-label-xs">
            <span className="text-outline uppercase">Keyframes (Click a frame to target edits)</span>
            <button
              type="button"
              onClick={() => setSelectedFrame(undefined)}
              className={`px-1.5 py-0.5 rounded border text-[10px] ${
                selectedFrame === undefined
                  ? "border-primary bg-primary-container/20 text-primary font-bold"
                  : "border-[#272a3b] text-on-surface-variant"
              }`}
            >
              All frames
            </button>
          </div>

          {keyframes.length > 0 ? (
            <div className={`grid min-w-0 gap-2 ${compact ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-5"}`}>
              {keyframes.map((kf) => {
                const isPicked = selectedFrame === kf.index;
                return (
                  <button
                    type="button"
                    key={kf.id}
                    onClick={() => setSelectedFrame(isPicked ? undefined : kf.index)}
                    className={`min-w-0 overflow-hidden text-left p-1.5 rounded border transition-all ${
                      isPicked
                        ? "border-primary bg-primary-container/20 ring-1 ring-primary"
                        : "border-[#272a3b] bg-surface-container-lowest hover:border-outline"
                    }`}
                  >
                    <div
                      className={`${compact ? "h-36" : "h-44"} w-full bg-black rounded overflow-hidden mb-1 flex items-center justify-center`}
                    >
                      <img
                        src={`/api/artifacts/${kf.id}`}
                        alt={`Keyframe K${kf.index}`}
                        className="max-w-full max-h-full w-auto h-full object-contain pixelated block"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={isPicked ? "text-primary font-bold" : "text-on-surface"}>
                        K{kf.index}
                      </span>
                      {kf.revised && <span className="text-secondary font-bold">REV</span>}
                    </div>
                    {kf.addObject && (
                      <div className="text-[10px] text-on-surface-variant truncate">{kf.addObject}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-2 bg-surface-container-lowest border border-[#272a3b] rounded text-label-xs text-outline">
              No keyframe images recorded yet.
            </div>
          )}
        </div>
      )}

      {/* Note / Reason + Decision Buttons */}
      <div className="space-y-2">
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setErrorMsg(null);
          }}
          placeholder={
            gate === "KEYFRAME_REVIEW" && selectedFrame !== undefined
              ? `Revision note for Frame K${selectedFrame} (required for Request changes / Reject)...`
              : "Revision note or rejection reason (required for Request changes / Reject)..."
          }
          className="w-full bg-surface-container-lowest border border-[#272a3b] rounded p-2 text-label-sm font-mono text-on-surface focus:outline-none focus:border-primary"
          rows={2}
        />

        {errorMsg && (
          <div className="p-2 bg-error-container/30 border border-error rounded text-label-xs text-error">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <MechanicalButton
            size="sm"
            variant="primary"
            disabled={submitting}
            onClick={() => handleAction("approved")}
          >
            {isDirty ? "SAVE & APPROVE" : "APPROVE"}
          </MechanicalButton>
          <MechanicalButton
            size="sm"
            variant="secondary"
            disabled={submitting}
            onClick={() => handleAction("request_changes")}
          >
            {gate === "KEYFRAME_REVIEW" && selectedFrame !== undefined
              ? `REQUEST CHANGES (K${selectedFrame})`
              : "REQUEST CHANGES"}
          </MechanicalButton>
          <MechanicalButton
            size="sm"
            variant="danger"
            disabled={submitting}
            onClick={() => handleAction("rejected")}
          >
            REJECT
          </MechanicalButton>
        </div>
      </div>

      {/* Gate Decision History */}
      {gateHistory.length > 0 && (
        <div className="pt-2 border-t border-[#272a3b] space-y-1.5">
          <div className="text-[10px] text-outline uppercase">Gate Decision History</div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {gateHistory.map((h) => (
              <div
                key={h.id}
                className="p-1.5 bg-surface-container-lowest border border-[#272a3b] rounded text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-bold ${
                      h.decision === "approved"
                        ? "text-secondary"
                        : h.decision === "rejected"
                          ? "text-error"
                          : "text-primary"
                    }`}
                  >
                    {h.gate} · {h.decision.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-outline">
                    Human · {new Date(h.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {h.comment && <div className="text-on-surface-variant mt-0.5">{h.comment}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface GateReviewModalProps extends GateReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GateReviewModal({ isOpen, onClose, ...panelProps }: GateReviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface-container-low border border-[#272a3b] rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container border-b border-[#272a3b]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">fact_check</span>
            <span className="font-headline font-bold text-headline-sm uppercase text-on-surface">
              Human Gate Review
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <GateReviewPanel
            {...panelProps}
            onSubmit={async (payload) => {
              await panelProps.onSubmit(payload);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
