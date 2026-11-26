import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { useServiceQuery } from "@/app/data";
import { ColorDot } from "@/components/ui/color-dot";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bucketLabel,
  defaultGranularity,
  GRANULARITIES,
  presetRange,
  RANGE_PRESETS,
  type Granularity,
  type RangePreset,
} from "@/domain/analytics";
import { formatDuration } from "@/lib/format";
import { useSetting } from "@/features/settings/use-settings";
import { useTodayKey } from "@/features/views/use-now";
import type { AnalyticsReport } from "./analytics-service";
import { ChartCard, ChartTooltip, DataTable } from "./components/chart-kit";
import { AXIS, BAR_ANIMATION, GRID, SERIES } from "./components/chart-theme";

/** Hours for real workloads; minutes when every period is under two hours (so small values stay visible). */
function trackedUnit(maxMs: number): { div: number; suffix: "h" | "m" } {
  return maxMs >= 2 * 3_600_000 ? { div: 3_600_000, suffix: "h" } : { div: 60_000, suffix: "m" };
}

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [weekStartsOn] = useSetting("ui.weekStartsOn");
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const dayKey = useTodayKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the day changes
  const range = useMemo(() => presetRange(preset, new Date()), [preset, dayKey]);
  const { data } = useServiceQuery(["analytics", range, granularity, weekStartsOn], (s) =>
    s.analytics.report(range, granularity, weekStartsOn),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-(--tf-page-x) py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label={t("analytics.range.label")}
          value={preset}
          onValueChange={(p) => {
            setPreset(p);
            setGranularity(defaultGranularity(p));
          }}
          options={RANGE_PRESETS.map((p) => ({ value: p, label: t(`analytics.range.${p}`) }))}
        />
        <SegmentedControl
          aria-label={t("analytics.granularity.label")}
          value={granularity}
          onValueChange={setGranularity}
          options={GRANULARITIES.map((g) => ({ value: g, label: t(`analytics.granularity.${g}`) }))}
        />
      </div>
      {!data ? <LoadingGrid /> : <Report report={data} />}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-24" />
      <Skeleton className="h-72" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function Report({ report }: { report: AnalyticsReport }) {
  const { t } = useTranslation();
  const now = new Date();
  const { totals } = report;
  const unit = trackedUnit(Math.max(0, ...report.trend.map((p) => p.trackedMs)));
  const trend = report.trend.map((p) => ({
    ...p,
    label: bucketLabel(p.key, report.granularity, now),
    trackedValue: Math.round((p.trackedMs / unit.div) * 10) / 10,
  }));
  const dur = (ms: number | null) => (ms === null ? t("analytics.kpi.noData") : formatDuration(ms));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label={t("analytics.kpi.completed")}
          value={String(totals.completed)}
          color={SERIES.completed}
        />
        <Kpi
          label={t("analytics.kpi.created")}
          value={String(totals.created)}
          color={SERIES.created}
        />
        <Kpi
          label={t("analytics.kpi.lead")}
          value={dur(totals.lead.medianMs)}
          sub={t("analytics.kpi.sample", { count: totals.lead.sample })}
          hint={t("analytics.kpi.leadHint", { count: totals.lead.sample })}
        />
        <Kpi
          label={t("analytics.kpi.inProgress")}
          value={dur(totals.inProgress.medianMs)}
          sub={t("analytics.kpi.sample", { count: totals.inProgress.sample })}
          hint={t("analytics.kpi.inProgressHint", { count: totals.inProgress.sample })}
        />
        <Kpi
          label={t("analytics.kpi.tracked")}
          value={formatDuration(totals.trackedMs)}
          color={SERIES.tracked}
          hint={t("analytics.kpi.trackedHint")}
        />
      </div>

      <ChartCard
        title={t("analytics.charts.trend")}
        note={t("analytics.charts.trendNote")}
        legend={[
          { label: t("analytics.series.completed"), color: SERIES.completed },
          { label: t("analytics.series.created"), color: SERIES.created },
        ]}
        tableLabel={t("analytics.charts.showTable")}
        table={
          <DataTable
            head={[
              t("analytics.charts.period"),
              t("analytics.series.completed"),
              t("analytics.series.created"),
            ]}
            rows={trend.map((p) => [p.label, p.completed, p.created])}
          />
        }
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trend}
              barGap={2}
              barCategoryGap="28%"
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} minTickGap={16} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip cursor={{ fill: "var(--color-hover)" }} content={<ChartTooltip />} />
              <Bar
                {...BAR_ANIMATION}
                dataKey="completed"
                name={t("analytics.series.completed")}
                fill={SERIES.completed}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Bar
                {...BAR_ANIMATION}
                dataKey="created"
                name={t("analytics.series.created")}
                fill={SERIES.created}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title={t("analytics.charts.tracked")}
          note={t("analytics.charts.trackedNote")}
          tableLabel={t("analytics.charts.showTable")}
          table={
            <DataTable
              head={[t("analytics.charts.period"), t("analytics.series.tracked")]}
              rows={trend.map((p) => [p.label, formatDuration(p.trackedMs)])}
            />
          }
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trend}
                barCategoryGap="28%"
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} minTickGap={16} />
                <YAxis
                  {...AXIS}
                  width={48}
                  tickFormatter={(v: number) => formatDuration(v * unit.div)}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-hover)" }}
                  content={
                    <ChartTooltip
                      format={(v) =>
                        t(`analytics.${unit.suffix === "h" ? "hours" : "minutes"}`, { value: v })
                      }
                    />
                  }
                />
                <Bar
                  {...BAR_ANIMATION}
                  dataKey="trackedValue"
                  name={t("analytics.series.tracked")}
                  fill={SERIES.tracked}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={t("analytics.charts.priority")}
          note={t("analytics.charts.priorityNote")}
          legend={[
            { label: t("analytics.series.open"), color: SERIES.open },
            { label: t("analytics.series.completed"), color: SERIES.completed },
          ]}
          tableLabel={t("analytics.charts.showTable")}
          table={
            <DataTable
              head={[
                t("priority.label"),
                t("analytics.series.open"),
                t("analytics.series.completed"),
              ]}
              rows={report.byPriority.map((p) => [
                t(`priority.${p.priority}`),
                p.open,
                p.completed,
              ])}
            />
          }
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={report.byPriority.map((p) => ({ ...p, label: t(`priority.${p.priority}`) }))}
                barGap={2}
                barCategoryGap="24%"
                margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid {...GRID} vertical horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...AXIS} />
                <YAxis type="category" dataKey="label" width={64} {...AXIS} />
                <Tooltip cursor={{ fill: "var(--color-hover)" }} content={<ChartTooltip />} />
                <Bar
                  {...BAR_ANIMATION}
                  dataKey="open"
                  name={t("analytics.series.open")}
                  fill={SERIES.open}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={14}
                />
                <Bar
                  {...BAR_ANIMATION}
                  dataKey="completed"
                  name={t("analytics.series.completed")}
                  fill={SERIES.completed}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Measures />
      <ProjectsTable report={report} />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  hint,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3" title={hint}>
      <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
        {color && (
          <span className="size-2 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden />
        )}
        {label}
        {hint && <Info className="size-3" aria-hidden />}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold text-fg tabular-nums">{value}</div>
      {sub && <div className="text-2xs text-fg-subtle">{sub}</div>}
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  );
}

function Measures() {
  const { t } = useTranslation();
  return (
    <section
      className="rounded-lg border border-line bg-surface p-4 text-xs text-fg-muted"
      aria-label={t("analytics.measures.title")}
    >
      <h2 className="mb-2 text-sm font-semibold text-fg">{t("analytics.measures.title")}</h2>
      <p>{t("analytics.measures.status")}</p>
      <p className="mt-1">{t("analytics.measures.tracked")}</p>
    </section>
  );
}

function ProjectsTable({ report }: { report: AnalyticsReport }) {
  const { t } = useTranslation();
  const rows = report.projects;
  return (
    <section
      className="rounded-lg border border-line bg-surface p-4"
      aria-label={t("analytics.charts.projects")}
    >
      <h2 className="mb-3 text-sm font-semibold text-fg">{t("analytics.charts.projects")}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-fg-subtle">{t("analytics.projects.empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-fg-subtle">
              <Th start>{t("analytics.projects.name")}</Th>
              <Th>{t("analytics.projects.open")}</Th>
              <Th>{t("analytics.projects.completed")}</Th>
              <Th>{t("analytics.projects.tracked")}</Th>
              <Th>{t("analytics.projects.lead")}</Th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((p) => (
              <tr key={p.id ?? "none"} className="border-t border-line">
                <td className="py-2">
                  <span className="flex items-center gap-2 text-fg">
                    {p.id ? <ColorDot color={p.color} /> : <span className="size-2" />}
                    {p.name ?? (
                      <span className="text-fg-subtle">{t("analytics.projects.none")}</span>
                    )}
                  </span>
                </td>
                <td className="py-2 text-end text-fg-muted">{p.open}</td>
                <td className="py-2 text-end text-fg-muted">{p.completed}</td>
                <td className="py-2 text-end text-fg-muted">
                  {p.trackedMs ? formatDuration(p.trackedMs) : "–"}
                </td>
                <td className="py-2 text-end text-fg-muted">
                  {p.medianLeadMs === null ? "–" : formatDuration(p.medianLeadMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Th({ children, start }: { children: ReactNode; start?: boolean }) {
  return (
    <th scope="col" className={`pb-1 font-medium ${start ? "text-start" : "text-end"}`}>
      {children}
    </th>
  );
}
