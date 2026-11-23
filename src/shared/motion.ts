/**
 * Motion tokens (per §5 design system specification)
 * Reusable everywhere across components.
 */

export const MOTION = {
  timing: {
    instant: "80ms",
    micro: "200ms",
    macro: "420ms",
    ambient: "1600ms",
  },
  easing: {
    /** steps(4, jump-end) for sprite walks, meters, blinking diodes (150-300ms) */
    step_pixel: "steps(4, jump-end)",
    /** cubic-bezier(0.34, 1.56, 0.64, 1) for buttons, badges, drawers (150-240ms) */
    tactile_overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    /** cubic-bezier(0.16, 1, 0.3, 1) for modal dismiss and column reflow (350-500ms) */
    phosphor_decay: "cubic-bezier(0.16, 1, 0.3, 1)",
    /** linear for ambient loops (1200-3000ms) */
    linear_cron: "linear",
  },
} as const;
