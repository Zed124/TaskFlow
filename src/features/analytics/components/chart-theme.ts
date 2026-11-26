/**
 * Series colors, validated with the dataviz palette checker on the dark chart surface (#19191f):
 * all pass lightness, chroma, CVD (worst adjacent ΔE 8.4) and 3:1 contrast. Each color is tied to
 * a measure — never to a rank — so "Completed" is the same blue in every chart.
 */
export const SERIES = {
  completed: "#3987e5",
  created: "#d95926",
  tracked: "#199e70",
  open: "#c98500",
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
