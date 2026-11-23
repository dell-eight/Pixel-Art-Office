import React from "react";

export function CrtOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 crt-scanlines opacity-35"
    />
  );
}
