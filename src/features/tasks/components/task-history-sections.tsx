import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Hourglass, Timer } from "lucide-react";
import type { CompletionEvent } from "@/db/repositories/history-repository";
import { summarizeStatusDurations } from "@/domain/durations";
import { formatDuration, formatInstant } from "@/lib/format";
import type { TaskDetails } from "../task-service";
import { Section } from "./drawer-section";

/**
 * Two clearly separate measurements: how long the task sat in In Progress (status duration,
 * live while ongoing) and manually tracked work, which arrives with the timer in Phase 5.
 */
export function TimeSection({ details }: { details: TaskDetails }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  const summary = summarizeStatusDurations(details.intervals, now);

  useEffect(() => {
    if (!summary.inProgressOngoing) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [summary.inProgressOngoing]);

  return (
    <Section title={t("tasks.time.title")}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div
          className="rounded-md border border-line px-3 py-2"
          title={t("tasks.time.inProgressHint", { count: summary.inProgressStretches })}
        >
          <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Hourglass className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t("tasks.time.inProgress")}
          </div>
          <div className="mt-1 text-base font-semibold text-fg tabular-nums">
            {summary.inProgressStretches === 0 ? (
              <span className="text-sm font-normal text-fg-subtle">{t("tasks.time.never")}</span>
            ) : (
              formatDuration(summary.inProgressMs)
            )}
            {summary.inProgressOngoing && (
              <span className="ms-2 text-xs font-normal text-warning">
                {t("tasks.time.ongoing")}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-md border border-dashed border-line px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Timer className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t("tasks.time.tracked")}
          </div>
          <p className="mt-1 text-xs text-fg-subtle">{t("tasks.time.trackedLater")}</p>
        </div>
      </div>
    </Section>
  );
}

export function CompletionHistory({ completions }: { completions: CompletionEvent[] }) {
  const { t } = useTranslation();
  return (
    <Section title={t("tasks.completions.title")}>
      <ol className="flex flex-col gap-1">
        {[...completions].reverse().map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-xs text-fg-muted">
            <CheckCircle2
              className="size-3.5 shrink-0 text-accent-text"
              strokeWidth={1.75}
              aria-hidden
            />
            <span>{t("tasks.completions.completed", { date: formatInstant(c.completedAt) })}</span>
            {c.reopenedAt ? (
              <span className="text-fg-subtle">
                · {t("tasks.completions.reopened", { date: formatInstant(c.reopenedAt) })}
              </span>
            ) : (
              <span className="rounded-xs bg-accent-soft px-1.5 text-2xs text-accent-text">
                {t("tasks.completions.current")}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}
