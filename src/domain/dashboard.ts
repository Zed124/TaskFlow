import { z } from "zod";

export const DASHBOARD_WIDGETS = [
  "stats",
  "quickAdd",
  "today",
  "overdue",
  "upcoming",
  "inProgress",
  "recentlyCompleted",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];

/** Full-width widgets span both columns of the dashboard grid. */
export const WIDGET_SPAN: Record<DashboardWidgetId, "full" | "half"> = {
  stats: "full",
  quickAdd: "full",
  today: "half",
  overdue: "half",
  upcoming: "half",
  inProgress: "half",
  recentlyCompleted: "half",
};

export const dashboardLayoutSchema = z.array(
  z.object({ id: z.enum(DASHBOARD_WIDGETS), visible: z.boolean() }),
);
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = DASHBOARD_WIDGETS.map((id) => ({
  id,
  visible: true,
}));

/**
 * Repairs a stored layout: drops duplicates, and appends widgets added in newer versions
 * (visible) so users discover them.
 */
export function normalizeLayout(layout: DashboardLayout): DashboardLayout {
  const seen = new Set<DashboardWidgetId>();
  const result: DashboardLayout = [];
  for (const entry of layout) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  for (const id of DASHBOARD_WIDGETS) if (!seen.has(id)) result.push({ id, visible: true });
  return result;
}

export function moveWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  offset: -1 | 1,
): DashboardLayout {
  const index = layout.findIndex((w) => w.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= layout.length) return layout;
  const next = [...layout];
  const [item] = next.splice(index, 1);
  if (item) next.splice(target, 0, item);
  return next;
}
