/**
 * Color tokens for projects and categories. Stored by name in the DB, so the palette can be
 * retuned without a migration. Each name maps to a CSS variable whose value depends on the theme
 * (lighter steps on dark themes, deeper ones on light themes; see src/styles/index.css).
 */
export const ENTITY_COLORS = {
  slate: "var(--tf-entity-slate)",
  violet: "var(--tf-entity-violet)",
  blue: "var(--tf-entity-blue)",
  teal: "var(--tf-entity-teal)",
  green: "var(--tf-entity-green)",
  amber: "var(--tf-entity-amber)",
  orange: "var(--tf-entity-orange)",
  rose: "var(--tf-entity-rose)",
  pink: "var(--tf-entity-pink)",
} as const;

export type EntityColor = keyof typeof ENTITY_COLORS;
export const ENTITY_COLOR_NAMES = Object.keys(ENTITY_COLORS) as EntityColor[];

export function isEntityColor(value: string | null | undefined): value is EntityColor {
  return value != null && Object.hasOwn(ENTITY_COLORS, value);
}

/** A CSS color for an entity color name (falls back to slate). */
export function entityColor(value: string | null | undefined): string {
  return isEntityColor(value) ? ENTITY_COLORS[value] : ENTITY_COLORS.slate;
}
