import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { addDays } from "date-fns";
import { useServiceQuery } from "@/app/data";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardWidgetId } from "@/domain/dashboard";
import { smartFilters } from "@/domain/smart-lists";
import type { TaskFilter } from "@/domain/task-filter";
import type { TaskListItem } from "@/domain/task";
import { cn } from "@/lib/cn";
import { toLocalDate } from "@/lib/time";
import { useSetting } from "@/features/settings/use-settings";
import { DueLabel } from "@/features/tasks/components/due-label";
import { PriorityIcon } from "@/features/tasks/components/priority-icon";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { StatusToggle } from "@/features/tasks/components/status-toggle";
import { useTaskActions } from "@/features/tasks/use-task-actions";
import { useTaskDrawer } from "@/features/tasks/use-task-drawer";
import { useTaskList } from "@/features/tasks/use-task-list";
import { useTodayKey } from "@/features/views/use-now";
import { CompletionChart } from "./completion-chart";

const LIMIT = 6;

export function WidgetBody({ id }: { id: DashboardWidgetId }) {
  switch (id) {
    case "stats":
      return <StatsWidget />;
    case "quickAdd":
      return <QuickAdd />;
    case "today":
      return <ListWidget filterKey="dueToday" emptyKey="today" link="/today" />;
    case "overdue":
      return <ListWidget filterKey="overdue" emptyKey="overdue" link="/overdue" />;
    case "upcoming":
      return <UpcomingWidget />;
    case "inProgress":
      return <ListWidget filterKey="inProgress" emptyKey="inProgress" link="/in-progress" />;
    case "recentlyCompleted":
      return <ListWidget filterKey="completed" emptyKey="recentlyCompleted" link="/completed" />;
  }
}

function useDayFilters() {
  const dayKey = useTodayKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute exactly when the day changes
  return useMemo(() => smartFilters(new Date()), [dayKey]);
}

function StatsWidget() {
  const { t } = useTranslation();
  const [weekStartsOn] = useSetting("ui.weekStartsOn");
  const dayKey = useTodayKey();
  const { data } = useServiceQuery(["stats", weekStartsOn, dayKey], (s) =>
    s.stats.dashboard(weekStartsOn, 14),
  );
  if (!data) return <Skeleton className="h-40" />;

  const tiles: { label: string; value: number; tone?: string; to: string }[] = [
    { label: t("dashboard.stats.open"), value: data.open, to: "/tasks" },
    {
      label: t("dashboard.stats.dueToday"),
      value: data.dueToday,
      to: "/today",
      tone: data.dueToday ? "text-warning" : undefined,
    },
    {
      label: t("dashboard.stats.overdue"),
      value: data.overdue,
      to: "/overdue",
      tone: data.overdue ? "text-danger" : undefined,
    },
    { label: t("dashboard.stats.completedToday"), value: data.completedToday, to: "/completed" },
    { label: t("dashboard.stats.completedWeek"), value: data.completedThisWeek, to: "/completed" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={tile.to}
            className="rounded-md border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-hover"
          >
            <div
              className={cn("font-display text-2xl font-semibold text-fg tabular-nums", tile.tone)}
            >
              {tile.value}
            </div>
            <div className="mt-0.5 text-xs text-fg-subtle">{tile.label}</div>
          </Link>
        ))}
      </div>
      <CompletionChart days={data.lastDays} />
    </div>
  );
}

function UpcomingWidget() {
  const dayKey = useTodayKey();
  const filter: TaskFilter = useMemo(() => {
    const now = new Date();
    return {
      statuses: ["todo", "in_progress"],
      due: { from: toLocalDate(addDays(now, 1)), to: toLocalDate(addDays(now, 7)) },
      sort: { field: "due", direction: "asc" },
      limit: LIMIT + 1,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute exactly when the day changes
  }, [dayKey]);
  return <TaskMiniList filter={filter} emptyKey="upcoming" link="/upcoming" />;
}

function ListWidget({
  filterKey,
  emptyKey,
  link,
}: {
  filterKey: "dueToday" | "overdue" | "inProgress" | "completed";
  emptyKey: "today" | "overdue" | "inProgress" | "recentlyCompleted";
  link: string;
}) {
  const filters = useDayFilters();
  const filter = useMemo(() => ({ ...filters[filterKey], limit: LIMIT + 1 }), [filters, filterKey]);
  return <TaskMiniList filter={filter} emptyKey={emptyKey} link={link} />;
}

function TaskMiniList({
  filter,
  emptyKey,
  link,
}: {
  filter: TaskFilter;
  emptyKey: "today" | "overdue" | "upcoming" | "inProgress" | "recentlyCompleted";
  link: string;
}) {
  const { t } = useTranslation();
  const { data, isPending } = useTaskList(filter);
  const { open } = useTaskDrawer();
  const { setStatus } = useTaskActions();

  if (isPending) return <Skeleton className="h-24" />;
  if (!data?.length)
    return <p className="py-3 text-sm text-fg-subtle">{t(`dashboard.empty.${emptyKey}`)}</p>;

  return (
    <>
      <ul className="-mx-2">
        {data.slice(0, LIMIT).map((task) => (
          <MiniRow
            key={task.id}
            task={task}
            onOpen={open}
            onStatus={(status) => setStatus.mutate({ id: task.id, status })}
          />
        ))}
      </ul>
      {data.length > LIMIT && (
        <Link to={link} className="mt-1 inline-block text-xs text-accent-text hover:underline">
          {t("dashboard.viewAll")}
        </Link>
      )}
    </>
  );
}

function MiniRow({
  task,
  onOpen,
  onStatus,
}: {
  task: TaskListItem;
  onOpen: (id: string) => void;
  onStatus: Parameters<typeof StatusToggle>[0]["onChange"];
}) {
  const closed = task.status === "completed" || task.status === "cancelled";
  return (
    <li className="flex h-8 items-center gap-1.5 rounded-sm px-2 hover:bg-hover">
      <StatusToggle status={task.status} onChange={onStatus} />
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className={cn(
          "min-w-0 flex-1 truncate text-start text-sm",
          closed ? "text-fg-subtle line-through" : "text-fg",
        )}
      >
        {task.title}
      </button>
      <PriorityIcon priority={task.priority} className="size-3.5" />
      <DueLabel dueDate={task.dueDate} dueTime={task.dueTime} status={task.status} />
    </li>
  );
}

export function WidgetFrame({
  title,
  children,
  className,
  actions,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-line bg-surface p-4",
        className,
      )}
      aria-label={title}
    >
      <header className="mb-3 flex items-center gap-2">
        <h2 className="text-xs font-semibold text-fg-muted">{title}</h2>
        <span className="flex-1" />
        {actions}
      </header>
      {children}
    </section>
  );
}
