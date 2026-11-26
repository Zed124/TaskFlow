import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  PartyPopper,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { addDays, differenceInCalendarDays, format, isSameYear, parseISO } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { smartFilters } from "@/domain/smart-lists";
import type { CreateTaskInput, TaskListItem } from "@/domain/task";
import { formatDayHeading, parseLocalDate } from "@/lib/format";
import { toLocalDate } from "@/lib/time";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { useTaskList } from "@/features/tasks/use-task-list";
import { TaskSection } from "./components/task-section";
import { ArchiveCompletedDialog } from "./components/archive-completed-dialog";
import { Button } from "@/components/ui/button";
import { groupBy } from "@/lib/group-by";
import { useNow, useTodayKey } from "./use-now";

/** Smart-list filters, recomputed only when the calendar day changes. */
function useSmartFilters() {
  const dayKey = useTodayKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute exactly when the day changes
  return useMemo(() => smartFilters(new Date()), [dayKey]);
}

function PageFrame({
  quickAdd,
  children,
}: {
  quickAdd?: Partial<CreateTaskInput>;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      {quickAdd && (
        <div className="px-(--tf-page-x) pt-4 pb-3">
          <QuickAdd defaults={quickAdd} />
        </div>
      )}
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-2 px-(--tf-page-x) py-4" aria-busy>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-5" />
      ))}
    </div>
  );
}

function Empty({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return <EmptyState icon={icon} title={title} description={body} />;
}

/** Due-date heading for Upcoming: "Tomorrow", "Friday", "Mon, Dec 14". */
function dueHeading(date: string, now: Date, t: (k: "due.tomorrow") => string): string {
  const d = parseLocalDate(date);
  const diff = differenceInCalendarDays(d, now);
  if (diff === 1) return t("due.tomorrow");
  if (diff < 7) return format(d, "EEEE, MMM d");
  return format(d, isSameYear(d, now) ? "EEE, MMM d" : "EEE, MMM d, yyyy");
}

export function TodayPage() {
  const { t } = useTranslation();
  const f = useSmartFilters();
  const overdue = useTaskList(f.overdue);
  const dueToday = useTaskList(f.dueToday);
  const done = useTaskList(f.completedToday);
  const today = toLocalDate(new Date());

  const loading = overdue.isPending || dueToday.isPending || done.isPending;
  const total =
    (overdue.data?.length ?? 0) + (dueToday.data?.length ?? 0) + (done.data?.length ?? 0);

  return (
    <PageFrame quickAdd={{ dueDate: today }}>
      {loading ? (
        <Loading />
      ) : total === 0 ? (
        <Empty icon={Sun} title={t("views.today.emptyTitle")} body={t("views.today.emptyBody")} />
      ) : (
        <>
          <TaskSection title={t("views.today.overdue")} tasks={overdue.data ?? []} tone="danger" />
          <TaskSection title={t("views.today.dueToday")} tasks={dueToday.data ?? []} />
          <TaskSection
            title={t("views.today.completedToday")}
            tasks={done.data ?? []}
            tone="muted"
          />
        </>
      )}
    </PageFrame>
  );
}

export function UpcomingPage() {
  const { t } = useTranslation();
  const now = useNow();
  const f = useSmartFilters();
  const { data, isPending } = useTaskList(f.upcoming);
  const later = toLocalDate(addDays(now, 14));
  const groups = groupBy(data ?? [], (task) =>
    task.dueDate && task.dueDate <= later ? task.dueDate : "later",
  );

  return (
    <PageFrame quickAdd={{ dueDate: toLocalDate(addDays(now, 1)) }}>
      {isPending ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Empty
          icon={CalendarClock}
          title={t("views.upcoming.emptyTitle")}
          body={t("views.upcoming.emptyBody")}
        />
      ) : (
        groups.map(([key, tasks]) => (
          <TaskSection
            key={key}
            title={key === "later" ? t("views.upcoming.later") : dueHeading(key, now, t)}
            tasks={tasks}
          />
        ))
      )}
    </PageFrame>
  );
}

export function OverduePage() {
  const { t } = useTranslation();
  const f = useSmartFilters();
  const { data, isPending } = useTaskList(f.overdue);
  return (
    <PageFrame>
      {isPending ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          icon={PartyPopper}
          title={t("views.overdue.emptyTitle")}
          body={t("views.overdue.emptyBody")}
        />
      ) : (
        <TaskSection title={t("views.today.overdue")} tasks={data} tone="danger" />
      )}
    </PageFrame>
  );
}

export function InProgressPage() {
  const { t } = useTranslation();
  const f = useSmartFilters();
  const { data, isPending } = useTaskList(f.inProgress);
  return (
    <PageFrame quickAdd={{ status: "in_progress" }}>
      {isPending ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          icon={CircleDot}
          title={t("views.inProgress.emptyTitle")}
          body={t("views.inProgress.emptyBody")}
        />
      ) : (
        <TaskSection title={t("status.in_progress")} tasks={data} />
      )}
    </PageFrame>
  );
}

export function CompletedPage() {
  const { t } = useTranslation();
  const f = useSmartFilters();
  const [archiving, setArchiving] = useState(false);
  const { data, isPending } = useTaskList(f.completed);
  const groups = groupBy<TaskListItem>(data ?? [], (task) =>
    task.completedAt ? toLocalDate(parseISO(task.completedAt)) : "",
  );
  return (
    <PageFrame>
      {groups.length > 0 && (
        <div className="flex justify-end px-(--tf-page-x) pt-3 pb-1">
          <Button size="sm" variant="secondary" onClick={() => setArchiving(true)}>
            <Archive className="size-3.5" aria-hidden />
            {t("archive.completedButton")}
          </Button>
        </div>
      )}
      {isPending ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Empty
          icon={CheckCircle2}
          title={t("views.completed.emptyTitle")}
          body={t("views.completed.emptyBody")}
        />
      ) : (
        groups.map(([day, tasks]) => (
          <TaskSection
            key={day}
            title={formatDayHeading(parseLocalDate(day).toISOString())}
            tasks={tasks}
          />
        ))
      )}
      {archiving && <ArchiveCompletedDialog onClose={() => setArchiving(false)} />}
    </PageFrame>
  );
}
