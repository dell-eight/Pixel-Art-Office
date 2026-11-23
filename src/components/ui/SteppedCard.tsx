import React from "react";

export interface SteppedCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function SteppedCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  headerClassName = "",
}: SteppedCardProps) {
  return (
    <div
      className={`bg-surface-container-low border border-[#272a3b] rounded shadow-lg overflow-hidden flex flex-col ${className}`}
    >
      {(title || action) && (
        <div
          className={`flex items-center justify-between px-3 py-2 bg-surface-container border-b border-[#272a3b] ${headerClassName}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {typeof title === "string" ? (
              <span className="font-mono text-label-md font-bold uppercase tracking-wider text-on-surface truncate">
                {title}
              </span>
            ) : (
              title
            )}
            {subtitle && (
              <span className="font-mono text-label-sm text-on-surface-variant truncate">
                {subtitle}
              </span>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-3 flex-1">{children}</div>
    </div>
  );
}
