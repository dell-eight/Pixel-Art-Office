import React from "react";

export interface RecessedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
}

export function RecessedInput({ icon, className = "", ...props }: RecessedInputProps) {
  return (
    <div className="relative flex items-center w-full">
      {icon && (
        <span className="material-symbols-outlined absolute left-2.5 text-on-surface-variant text-[18px] pointer-events-none">
          {icon}
        </span>
      )}
      <input
        className={`w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 border border-[#272a3b] rounded py-1.5 px-3 font-mono text-body-sm shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all ${
          icon ? "pl-9" : ""
        } ${className}`}
        {...props}
      />
    </div>
  );
}
