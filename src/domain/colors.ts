/**
 * Color tokens for projects and categories. Stored by name in the DB, so the palette can be
 * retuned without a migration. These hex values are the one sanctioned place for raw colors.
 */
export const ENTITY_COLORS = {
  slate: "#8f9bb3",
  violet: "#a78bfa",
  blue: "#60a5fa",
  teal: "#2dd4bf",
  green: "#4ade80",
  amber: "#fbbf24",
  orange: "#fb923c",
  rose: "#fb7185",
  pink: "#f472b6",
} as const;

export type EntityColor = keyof typeof ENTITY_COLORS;
export const ENTITY_COLOR_NAMES = Object.keys(ENTITY_COLORS) as EntityColor[];

export function isEntityColor(value: string | null | undefined): value is EntityColor {
  return value != null && Object.hasOwn(ENTITY_COLORS, value);
}

export function entityColorHex(value: string | null | undefined): string {
  return isEntityColor(value) ? ENTITY_COLORS[value] : ENTITY_COLORS.slate;
}
