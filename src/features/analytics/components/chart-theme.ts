/**
 * Series colors, tied to a measure, never to a rank, so "Completed" is the same blue in every chart.
 * Values are CSS variables that switch per theme mode (src/styles/index.css), both validated with
 * the dataviz palette checker:
 * - dark themes (#3987e5 #d95926 #199e70 #c98500) on the Dark, Midnight and Dusk surfaces: all pass
 *   lightness, chroma, CVD (worst adjacent ΔE 8.4) and 3:1 contrast;
 * - light themes (#2a78d6 #eb6834 #1baf7a #eda100) on the Light and Paper surfaces: pass, with
 *   tracked and open below 3:1, which is why every chart also has a table view.
 */
export const SERIES = {
  completed: "var(--tf-series-completed)",
  created: "var(--tf-series-created)",
  tracked: "var(--tf-series-tracked)",
  open: "var(--tf-series-open)",
} as const;

/** Recessive chart chrome. */
export const AXIS = {
  stroke: "var(--color-line-strong)",
  tick: { fill: "var(--color-fg-subtle)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
export const GRID = {
  stroke: "var(--color-line)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

/** Short, subtle entry animation; none when the OS asks for reduced motion. */
export const BAR_ANIMATION = {
  animationDuration: 400,
  isAnimationActive:
    typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
} as const;
