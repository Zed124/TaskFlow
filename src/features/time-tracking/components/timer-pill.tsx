import { useTranslation } from "react-i18next";
import { Pause, Play, Square } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { useTaskDrawer } from "@/features/tasks/use-task-drawer";
import { formatClock, useActiveTimer, useLiveElapsed, useTimerActions } from "../use-timer";

/** Top-bar indicator for the active work timer, visible from every page. */
export function TimerPill() {
  const { t } = useTranslation();
  const { data: active } = useActiveTimer();
  const elapsed = useLiveElapsed(active?.session);
  const { pause, resume, stop } = useTimerActions();
  const { open } = useTaskDrawer();
  if (!active) return null;

  const running = active.session.state === "running";
  const label = running
    ? t("timer.pillRunning", { title: active.taskTitle })
    : t("timer.pillPaused", { title: active.taskTitle });

  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1 rounded-sm border ps-2 pe-0.5 text-xs",
        running ? "border-accent/50 bg-accent-soft text-fg" : "border-line text-fg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          running ? "animate-pulse bg-accent" : "bg-fg-subtle",
        )}
      />
      <button
        type="button"
        onClick={() => open(active.session.taskId)}
        title={label}
        aria-label={`${label} — ${t("timer.open")}`}
        className="flex items-center gap-2 rounded-xs px-1 hover:text-fg"
      >
        <span className="max-w-36 truncate">{active.taskTitle}</span>
        <span className="font-medium tabular-nums">{formatClock(elapsed)}</span>
      </button>
      {running ? (
        <IconButton
          icon={Pause}
          size="sm"
          label={t("tasks.time.pause")}
          onClick={() => pause.mutate(undefined)}
        />
      ) : (
        <IconButton
          icon={Play}
          size="sm"
          label={t("tasks.time.resume")}
          onClick={() => resume.mutate(undefined)}
        />
      )}
      <IconButton
        icon={Square}
        size="sm"
        label={t("tasks.time.stop")}
        onClick={() => stop.mutate(active.taskTitle)}
      />
    </div>
  );
}
