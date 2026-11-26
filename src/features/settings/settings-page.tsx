import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ACCENTS, WEEK_STARTS, type Accent, type WeekStart } from "@/domain/settings";
import { errorMessage } from "@/lib/errors";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { useSetting } from "./use-settings";

// Swatches show the actual accent value; kept in sync with src/styles/index.css.
const SWATCH: Record<Accent, string> = {
  violet: "#8b5cf6",
  indigo: "#6366f1",
  blue: "#3b82f6",
  teal: "#14b8a6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
};

export function SettingsPage() {
  const { t } = useTranslation();
  const [accent, setAccent, accentState] = useSetting("ui.accent");
  const [density, setDensity, densityState] = useSetting("ui.density");
  const [collapsed, setCollapsed, collapsedState] = useSetting("ui.sidebarCollapsed");
  const [weekStart, setWeekStart] = useSetting("ui.weekStartsOn");
  const error = accentState.error ?? densityState.error ?? collapsedState.error;

  return (
    <div className="mx-auto w-full max-w-2xl px-(--tf-page-x) py-8">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {t("settings.saveFailed", { message: errorMessage(error) })}
        </p>
      )}

      <Section title={t("settings.appearance.title")}>
        <Row label={t("settings.appearance.accent")} hint={t("settings.appearance.accentHint")}>
          <div
            role="radiogroup"
            aria-label={t("settings.appearance.accent")}
            className="flex gap-1.5"
          >
            {ACCENTS.map((value) => {
              const label = t(`settings.accents.${value}`);
              const selected = value === accent;
              return (
                <Tooltip key={value} content={label}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    onClick={() => setAccent(value)}
                    className={cn(
                      "size-6 rounded-full border-2 transition-transform duration-100 hover:scale-110",
                      selected ? "border-fg" : "border-transparent",
                    )}
                    style={{ backgroundColor: SWATCH[value] }}
                  />
                </Tooltip>
              );
            })}
          </div>
        </Row>
        <Row label={t("settings.appearance.density")} hint={t("settings.appearance.densityHint")}>
          <SegmentedControl
            aria-label={t("settings.appearance.density")}
            value={density}
            onValueChange={setDensity}
            options={[
              { value: "comfortable", label: t("settings.appearance.comfortable") },
              { value: "compact", label: t("settings.appearance.compact") },
            ]}
          />
        </Row>
      </Section>

      <Section title={t("settings.sidebar.title")}>
        <Row
          label={t("settings.sidebar.collapsed")}
          hint={t("settings.sidebar.collapsedHint")}
          htmlFor="sidebar-collapsed"
        >
          <Switch id="sidebar-collapsed" checked={collapsed} onCheckedChange={setCollapsed} />
        </Row>
      </Section>

      <Section title={t("settings.calendar.title")}>
        <Row label={t("settings.calendar.weekStart")} hint={t("settings.calendar.weekStartHint")}>
          <SegmentedControl
            aria-label={t("settings.calendar.weekStart")}
            value={String(weekStart)}
            onValueChange={(v) => setWeekStart(Number(v) as WeekStart)}
            options={WEEK_STARTS.map((d) => ({
              value: String(d),
              label: t(`settings.calendar.days.${String(d) as "0" | "1" | "6"}`),
            }))}
          />
        </Row>
      </Section>

      <Section title={t("settings.later.title")}>
        <p className="py-3 text-sm text-fg-muted">{t("settings.later.body")}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-sm font-semibold text-fg">{title}</h2>
      <div className="divide-y divide-line rounded-md border border-line bg-surface px-4">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm text-fg">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
