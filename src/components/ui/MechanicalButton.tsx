import React from "react";

export interface MechanicalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: string;
}

export function MechanicalButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  disabled,
  ...props
}: MechanicalButtonProps) {
  const base =
    "inline-flex items-center justify-center font-mono font-bold border transition-all active:translate-y-[2px] active:shadow-none select-none disabled:opacity-50 disabled:pointer-events-none";

  const sizeClasses = {
    sm: "px-2 py-1 text-label-sm gap-1",
    md: "px-3 py-1.5 text-label-md gap-1.5",
    lg: "px-4 py-2 text-headline-sm gap-2",
  }[size];

  const variantClasses = {
    primary:
      "bg-primary-container text-surface-container-lowest border-primary shadow-[2px_2px_0px_0px_#855300] hover:bg-primary",
    secondary:
      "bg-surface-container-high text-on-surface border-[#272a3b] shadow-[2px_2px_0px_0px_#0b0d19] hover:bg-surface-bright hover:border-outline",
    danger:
      "bg-error-container text-on-error-container border-error shadow-[2px_2px_0px_0px_#690005] hover:bg-error hover:text-[#0b0d19]",
    ghost:
      "bg-transparent text-on-surface-variant border-transparent hover:bg-surface-container hover:text-on-surface",
  }[variant];

  return (
    <button className={`${base} ${sizeClasses} ${variantClasses} ${className}`} disabled={disabled} {...props}>
      {icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>}
      {children}
    </button>
  );
}
