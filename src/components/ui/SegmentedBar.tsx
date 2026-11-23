import React from "react";

export interface SegmentedBarProps {
  value: number; // 0 to max
  max?: number;
  segments?: number;
  variant?: "amber" | "green" | "dynamic";
  className?: string;
  showPercent?: boolean;
}

export function SegmentedBar({
  value,
  max = 100,
  segments = 10,
  variant = "dynamic",
  className = "",
  showPercent = false,
}: SegmentedBarProps) {
  const ratio = Math.min(Math.max(value / (max || 1), 0), 1);
  const activeCount = Math.round(ratio * segments);

  function getSegmentColor(idx: number): string {
    if (variant === "amber") return "bg-primary-container shadow-[0_0_4px_#f59e0b]";
    if (variant === "green") return "bg-secondary shadow-[0_0_4px_#4edea3]";

    // Dynamic warning (e.g. for budget: green < 80%, amber >= 80%, red >= 100%)
    if (ratio >= 1.0) return "bg-error shadow-[0_0_4px_#ffb4ab]";
    if (ratio >= 0.8) return "bg-primary-container shadow-[0_0_4px_#f59e0b]";
    return "bg-secondary shadow-[0_0_4px_#4edea3]";
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-1 p-0.5 bg-surface-container-lowest border border-[#272a3b] rounded">
        {Array.from({ length: segments }).map((_, i) => {
          const filled = i < activeCount;
          return (
            <div
              key={i}
              className={`w-2 h-3 rounded-[1px] transition-colors ${
                filled ? getSegmentColor(i) : "bg-surface-container-high"
              }`}
            />
          );
        })}
      </div>
      {showPercent && (
        <span className="font-mono text-label-sm text-on-surface-variant font-bold">
          {Math.round(ratio * 100)}%
        </span>
      )}
    </div>
  );
}
