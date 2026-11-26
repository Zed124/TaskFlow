import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useUiStore } from "@/app/ui-store";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { TaskListItem } from "@/domain/task";
import type { TaskFilter } from "@/domain/task-filter";
import { cn } from "@/lib/cn";
import { toLocalDate } from "@/lib/time";
import { useSetting } from "@/features/settings/use-settings";
import { StatusIcon } from "@/features/tasks/components/status-icon";
import { useTaskDrawer } from "@/features/tasks/use-task-drawer";
import { useTaskList } from "@/features/tasks/use-task-list";
import { groupBy } from "@/lib/group-by";
import { useNow } from "./use-now";

type View = "month" | "week";
const MONTH_CELL_LIMIT = 3;

/** Month/week grid of tasks by due date, with the undated open tasks alongside. */
export function CalendarPage() {
  const { t } = useTranslation();
  const now = useNow();
  const [weekStartsOn] = useSetting("ui.weekStartsOn");
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [showUnscheduled, setShowUnscheduled] = useState(true);
  const openCreate = useUiStore((s) => s.openCreateTask);
  const { open } = useTaskDrawer();

  const opts = { weekStartsOn };
  const rangeStart =
    view === "month" ? startOfWeek(startOfMonth(anchor), opts) : startOfWeek(anchor, opts);
  const rangeEnd = view === "month" ? endOfWeek(endOfMonth(anchor), opts) : endOfWeek(anchor, opts);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const from = toLocalDate(rangeStart);
  const to = toLocalDate(rangeEnd);

  const filter: TaskFilter = { due: { from, to }, sort: { field: "due", direction: "asc" } };
  const { data } = useTaskList(filter);
  const byDay = useMemo(() => new Map(groupBy(data ?? [], (task) => task.dueDate ?? "")), [data]);
  const today = toLocalDate(now);

  const step = (dir: -1 | 1) =>
    setAnchor((a) => (view === "month" ? addMonths(a, dir) : addWeeks(a, dir)));
  const title =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : `${format(rangeStart, "MMM d")} – ${format(rangeEnd, isSameMonth(rangeStart, rangeEnd) ? "d, yyyy" : "MMM d, yyyy")}`;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-(--tf-page-x) py-2">
          <h2 className="me-2 min-w-40 font-display text-base font-semibold text-fg">{title}</h2>
          <IconButton icon={ChevronLeft} label={t("calendar.previous")} onClick={() => step(-1)} />
          <IconButton icon={ChevronRight} label={t("calendar.next")} onClick={() => step(1)} />
          <Button size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
            {t("calendar.today")}
          </Button>
          <span className="flex-1" />
          <SegmentedControl
            aria-label={t("nav.calendar")}
            value={view}
            onValueChange={setView}
            options={[
              { value: "month", label: t("calendar.month") },
              { value: "week", label: t("calendar.week") },
            ]}
          />
          <IconButton
            icon={showUnscheduled ? PanelRightClose : PanelRightOpen}
            label={t("calendar.unscheduled")}
            onClick={() => setShowUnscheduled((v) => !v)}
          />
        </div>

        <div className="grid grid-cols-7 border-b border-line">
          {days.slice(0, 7).map((d) => (
            <div key={d.toISOString()} className="px-2 py-1.5 text-2xs font-medium text-fg-subtle">
              {format(d, "EEE")}
            </div>
          ))}
        </div>
        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-7",
            view === "month" ? "auto-rows-fr" : "grid-rows-1",
          )}
        >
          {days.map((day) => {
            const key = toLocalDate(day);
            const tasks = byDay.get(key) ?? [];
            const limit = view === "month" ? MONTH_CELL_LIMIT : Infinity;
            const outside = view === "month" && !isSameMonth(day, anchor);
            return (
              <div
                key={key}
                className={cn(
                  "group flex min-h-0 flex-col gap-0.5 overflow-hidden border-e border-b border-line p-1.5 [&:nth-child(7n)]:border-e-0",
                  outside && "bg-sidebar/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      key === today
                        ? "bg-accent-solid font-semibold text-accent-fg"
                        : outside
                          ? "text-fg-subtle"
                          : "text-fg-muted",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <IconButton
                    icon={Plus}
                    size="sm"
                    label={t("calendar.addOn", { date: format(day, "MMM d") })}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => openCreate({ dueDate: key })}
                  />
                </div>
                <div
                  className={cn(
                    "flex min-h-0 flex-col gap-0.5",
                    view === "week" && "overflow-y-auto",
                  )}
                >
                  {tasks.slice(0, limit).map((task) => (
                    <TaskChip key={task.id} task={task} onOpen={open} />
                  ))}
                  {tasks.length > limit && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnchor(day);
                        setView("week");
                      }}
                      className="rounded-xs px-1 text-start text-2xs text-fg-subtle hover:bg-hover hover:text-fg"
                    >
                      {t("calendar.more", { count: tasks.length - limit })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showUnscheduled && <UnscheduledPanel onOpen={open} />}
    </div>
  );
}

function TaskChip({ task, onOpen }: { task: TaskListItem; onOpen: (id: string) => void }) {
  const closed = task.status === "completed" || task.status === "cancelled";
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      title={task.title}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-xs px-1 py-0.5 text-start text-xs hover:bg-hover",
        closed ? "text-fg-subtle line-through" : "text-fg",
        task.priority === "urgent" && !closed && "bg-danger/10",
      )}
    >
      <StatusIcon status={task.status} className="size-3" />
      {task.dueTime && <span className="shrink-0 text-fg-subtle tabular-nums">{task.dueTime}</span>}
      <span className="truncate">{task.title}</span>
    </button>
  );
}

const UNSCHEDULED: TaskFilter = {
  statuses: ["todo", "in_progress"],
  due: { none: true },
  sort: { field: "priority", direction: "desc" },
};

function UnscheduledPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const { data = [] } = useTaskList(UNSCHEDULED);
  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-s border-line bg-sidebar"
      aria-label={t("calendar.unscheduled")}
    >
      <div className="border-b border-line px-3 py-2.5">
        <h2 className="text-xs font-semibold text-fg">
          {t("calendar.unscheduled")}{" "}
          <span className="font-normal text-fg-subtle">{data.length}</span>
        </h2>
        <p className="mt-0.5 text-2xs text-fg-subtle">{t("calendar.unscheduledHint")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {data.length === 0 ? (
          <p className="p-2 text-xs text-fg-subtle">{t("calendar.unscheduledEmpty")}</p>
        ) : (
          data.map((task) => <TaskChip key={task.id} task={task} onOpen={onOpen} />)
        )}
      </div>
    </aside>
  );
}
