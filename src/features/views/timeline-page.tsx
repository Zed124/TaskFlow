import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, GanttChart } from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { keys, useServiceQuery } from "@/app/data";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import type { TaskListItem } from "@/domain/task";
import { cn } from "@/lib/cn";
import { parseLocalDate } from "@/lib/format";
import { toLocalDate } from "@/lib/time";
import { useSetting } from "@/features/settings/use-settings";
import { StatusIcon } from "@/features/tasks/components/status-icon";
import { useTaskDrawer } from "@/features/tasks/use-task-drawer";
import { useNow } from "./use-now";

const DAYS = 35;
const DAY_PX = 30;
const LABEL_PX = 260;

interface Span {
  start: number;
  end: number;
  dueAt: number | null;
  doneAt: number | null;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/**
 * Where a task sits on the timeline, as day offsets from the window start:
 * from its creation day to its completion (if done) or due date (or today while in progress).
 */
function spanOf(task: TaskListItem, windowStart: Date, today: Date): Span | null {
  const offset = (d: Date) => differenceInCalendarDays(d, windowStart);
  const created = offset(parseISO(task.createdAt));
  const due = task.dueDate ? offset(parseLocalDate(task.dueDate)) : null;
  const done = task.completedAt ? offset(parseISO(task.completedAt)) : null;
  let end = done ?? due ?? offset(today);
  if (task.status === "in_progress" && due === null) end = Math.max(end, offset(today));
  const start = Math.min(created, end);
  if (end < 0 || start > DAYS - 1) return null;
  return {
    start: Math.max(start, 0),
    end: Math.min(end, DAYS - 1),
    dueAt: due !== null && due >= 0 && due < DAYS ? due : null,
    doneAt: done !== null && done >= 0 && done < DAYS ? done : null,
    clippedStart: start < 0,
    clippedEnd: end > DAYS - 1,
  };
}

/** Gantt-style overview: what is planned, running and finished across five weeks. */
export function TimelinePage() {
  const { t } = useTranslation();
  const now = useNow();
  const [weekStartsOn] = useSetting("ui.weekStartsOn");
  const [shift, setShift] = useState(0);
  const { open } = useTaskDrawer();

  const windowStart = addDays(startOfWeek(now, { weekStartsOn }), -7 + shift * 7);
  const windowEnd = addDays(windowStart, DAYS - 1);
  const from = toLocalDate(windowStart);
  const to = toLocalDate(windowEnd);
  const { data = [] } = useServiceQuery([...keys.tasks("timeline"), from, to], (s) =>
    s.tasks.listTimeline(from, to),
  );

  const days = eachDayOfInterval({ start: windowStart, end: windowEnd });
  const todayOffset = differenceInCalendarDays(now, windowStart);
  const rows = data
    .map((task) => ({ task, span: spanOf(task, windowStart, now) }))
    .filter((r): r is { task: TaskListItem; span: Span } => r.span !== null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-(--tf-page-x) py-2">
        <h2 className="me-2 font-display text-base font-semibold text-fg">
          {t("timeline.range", {
            from: format(windowStart, "MMM d"),
            to: format(windowEnd, "MMM d, yyyy"),
          })}
        </h2>
        <IconButton
          icon={ChevronLeft}
          label={t("timeline.previous")}
          onClick={() => setShift((s) => s - 2)}
        />
        <IconButton
          icon={ChevronRight}
          label={t("timeline.next")}
          onClick={() => setShift((s) => s + 2)}
        />
        <Button size="sm" variant="secondary" onClick={() => setShift(0)}>
          {t("timeline.today")}
        </Button>
        <span className="flex-1" />
        <Legend />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={GanttChart} title={t("nav.timeline")} description={t("timeline.empty")} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="relative" style={{ width: LABEL_PX + DAYS * DAY_PX }}>
            {/* Day header */}
            <div className="sticky top-0 z-20 flex border-b border-line bg-canvas">
              <div className="sticky start-0 z-10 shrink-0 bg-canvas" style={{ width: LABEL_PX }} />
              {days.map((d, i) => (
                <div
                  key={i}
                  style={{ width: DAY_PX }}
                  className={cn(
                    "shrink-0 py-1 text-center text-2xs tabular-nums",
                    i === todayOffset ? "font-semibold text-accent-text" : "text-fg-subtle",
                    d.getDay() === weekStartsOn && "border-s border-line",
                  )}
                >
                  <div>{format(d, "EEEEE")}</div>
                  <div>{format(d, "d")}</div>
                </div>
              ))}
            </div>

            {/* Today line */}
            {todayOffset >= 0 && todayOffset < DAYS && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-accent/60"
                style={{ insetInlineStart: LABEL_PX + todayOffset * DAY_PX + DAY_PX / 2 }}
              />
            )}

            {rows.map(({ task, span }) => (
              <div
                key={task.id}
                className="group flex h-9 items-center border-b border-line/50 hover:bg-hover"
              >
                <button
                  type="button"
                  onClick={() => open(task.id)}
                  className="sticky start-0 z-10 flex h-full shrink-0 items-center gap-2 bg-canvas px-(--tf-page-x) text-start text-sm group-hover:bg-raised"
                  style={{ width: LABEL_PX }}
                >
                  <StatusIcon status={task.status} />
                  <span className="truncate text-fg">{task.title}</span>
                </button>
                <div className="relative h-full" style={{ width: DAYS * DAY_PX }}>
                  <Bar task={task} span={span} onOpen={open} />
                </div>
              </div>
            ))}
          </div>
          <p className="px-(--tf-page-x) py-3 text-xs text-fg-subtle">{t("timeline.undated")}</p>
        </div>
      )}
    </div>
  );
}

function Bar({
  task,
  span,
  onOpen,
}: {
  task: TaskListItem;
  span: Span;
  onOpen: (id: string) => void;
}) {
  const overdue =
    (task.status === "todo" || task.status === "in_progress") &&
    task.dueDate !== null &&
    task.dueDate < toLocalDate(new Date());
  const tone =
    task.status === "completed"
      ? "bg-accent/35 border-accent/50"
      : task.status === "cancelled"
        ? "bg-fg-subtle/20 border-fg-subtle/30"
        : task.status === "in_progress"
          ? "bg-warning/25 border-warning/50"
          : "bg-fg-muted/15 border-fg-muted/30";
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onOpen(task.id)}
        title={task.title}
        className={cn(
          "absolute top-2 bottom-2 border",
          tone,
          overdue && "border-danger/70",
          span.clippedStart ? "rounded-s-none border-s-0" : "rounded-s-sm",
          span.clippedEnd ? "rounded-e-none border-e-0" : "rounded-e-sm",
        )}
        style={{
          insetInlineStart: span.start * DAY_PX + 3,
          width: Math.max((span.end - span.start + 1) * DAY_PX - 6, 8),
        }}
      />
      {span.dueAt !== null && task.status !== "completed" && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 size-2.5 -translate-y-1/2 rotate-45 rounded-[2px]",
            overdue ? "bg-danger" : "bg-fg-muted",
          )}
          style={{ insetInlineStart: span.dueAt * DAY_PX + DAY_PX / 2 - 5 }}
        />
      )}
      {span.doneAt !== null && (
        <span
          aria-hidden
          className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-accent"
          style={{ insetInlineStart: span.doneAt * DAY_PX + DAY_PX / 2 - 5 }}
        />
      )}
    </>
  );
}

function Legend() {
  const { t } = useTranslation();
  return (
    <div className="hidden items-center gap-4 text-2xs text-fg-subtle lg:flex">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-5 rounded-xs border border-fg-muted/30 bg-fg-muted/15" aria-hidden />
        {t("timeline.legendSpan")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rotate-45 rounded-[2px] bg-fg-muted" aria-hidden />
        {t("timeline.legendDue")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-accent" aria-hidden />
        {t("timeline.legendDone")}
      </span>
    </div>
  );
}
