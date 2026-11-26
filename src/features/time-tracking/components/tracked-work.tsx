import { useTranslation } from "react-i18next";
import { Pause, Play, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/domain/task";
import { cn } from "@/lib/cn";
import { formatDuration, formatInstant } from "@/lib/format";
import {
  formatClock,
  useActiveTimer,
  useLiveElapsed,
  useTaskTime,
  useTimerActions,
} from "../use-timer";

/**
 * Manually tracked work for one task: live timer controls plus the list of past sessions.
 * Shown next to (never merged with) the automatic status-duration measurement.
 */
export function TrackedWork({
  taskId,
  title,
  status,
}: {
  taskId: string;
  title: string;
  status: TaskStatus;
}) {
  const { t } = useTranslation();
  const { data: active } = useActiveTimer();
  const { data: summary } = useTaskTime(taskId);
  const { start, pause, resume, stop } = useTimerActions();
  const mine = active?.session.taskId === taskId ? active.session : null;
  const live = useLiveElapsed(mine);
  const closed = status === "completed" || status === "cancelled";

  // Past sessions + the live one (its stored elapsed is replaced by the ticking value).
  const pastMs = (summary?.sessions ?? [])
    .filter((s) => s.id !== mine?.id)
    .reduce((sum, s) => sum + s.elapsedMs, 0);
  const totalMs = pastMs + (mine ? live : 0);
  const busy = start.isPending || pause.isPending || resume.isPending || stop.isPending;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        mine?.state === "running" ? "border-accent/50 bg-accent-soft/40" : "border-line",
      )}
    >
      <div
        className="flex items-center gap-1.5 text-xs text-fg-subtle"
        title={t("tasks.time.trackedHint")}
      >
        <Timer className="size-3.5" strokeWidth={1.75} aria-hidden />
        {t("tasks.time.tracked")}
        {mine && (
          <span
            className={cn(
              "ms-auto text-2xs",
              mine.state === "running" ? "text-accent-text" : "text-fg-subtle",
            )}
          >
            {mine.state === "running" ? t("tasks.time.running") : t("tasks.time.paused")}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-base font-semibold text-fg tabular-nums" aria-live="off">
          {mine ? formatClock(totalMs) : formatDuration(totalMs)}
        </span>
        <span className="flex-1" />
        {!mine ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={closed || busy}
            onClick={() => start.mutate(taskId)}
          >
            <Play className="size-3.5" aria-hidden />
            {t("tasks.time.start")}
          </Button>
        ) : (
          <>
            {mine.state === "running" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => pause.mutate(undefined)}
              >
                <Pause className="size-3.5" aria-hidden />
                {t("tasks.time.pause")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => resume.mutate(undefined)}
              >
                <Play className="size-3.5" aria-hidden />
                {t("tasks.time.resume")}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => stop.mutate(title)}
            >
              <Square className="size-3" aria-hidden />
              {t("tasks.time.stop")}
            </Button>
          </>
        )}
      </div>
      {!mine && active && !closed && (
        <p className="mt-1 text-2xs text-fg-subtle">
          {t("tasks.time.otherTask", { title: active.taskTitle })}
        </p>
      )}
      {closed && !mine && (
        <p className="mt-1 text-2xs text-fg-subtle">{t("tasks.time.closedHint")}</p>
      )}

      {summary && summary.sessions.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-default text-2xs text-fg-subtle select-none hover:text-fg-muted">
            {t("tasks.time.sessions")} ({summary.sessions.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {summary.sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 text-2xs text-fg-muted tabular-nums"
              >
                <span className="flex-1">{formatInstant(s.startedAt)}</span>
                <span className="text-fg-subtle">
                  {t("tasks.time.segments", { count: s.segments.length })}
                </span>
                <span className="w-16 text-end text-fg">
                  {s.id === mine?.id ? formatClock(live) : formatDuration(s.elapsedMs)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
