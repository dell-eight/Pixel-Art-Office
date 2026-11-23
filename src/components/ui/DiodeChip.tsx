import React from "react";

export interface DiodeChipProps {
  status: "idle" | "thinking" | "working" | "done" | "error" | "waiting" | string;
  label?: string;
  className?: string;
}

export function DiodeChip({ status, label, className = "" }: DiodeChipProps) {
  const norm = status.toLowerCase();
  
  const diodeConfig: Record<string, { bg: string; dot: string; text: string; label: string }> = {
    idle: {
      bg: "bg-surface-container",
      dot: "bg-outline",
      text: "text-on-surface-variant",
      label: "IDLE",
    },
    thinking: {
      bg: "bg-surface-container-high border-tertiary/40",
      dot: "bg-tertiary animate-diode",
      text: "text-tertiary",
      label: "THINKING",
    },
    working: {
      bg: "bg-surface-container-high border-primary/40",
      dot: "bg-primary animate-diode",
      text: "text-primary",
      label: "WORKING",
    },
    done: {
      bg: "bg-surface-container-high border-secondary/40",
      dot: "bg-secondary",
      text: "text-secondary",
      label: "DONE",
    },
    error: {
      bg: "bg-error-container/30 border-error/50",
      dot: "bg-error animate-diode",
      text: "text-error",
      label: "ERROR",
    },
    waiting: {
      bg: "bg-primary-container/20 border-primary/50",
      dot: "bg-primary-container animate-diode",
      text: "text-primary-container",
      label: "WAITING",
    },
  };

  const current = diodeConfig[norm] ?? {
    bg: "bg-surface-container",
    dot: "bg-outline",
    text: "text-on-surface-variant",
    label: status.toUpperCase(),
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#272a3b] text-label-sm font-mono font-bold select-none ${current.bg} ${current.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />
      <span>{label ?? current.label}</span>
    </div>
  );
}
