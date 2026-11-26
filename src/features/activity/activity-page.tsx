import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { History } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { keys } from "@/app/data";
import { useServices } from "@/app/use-services";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityFeedItem, ActivitySource } from "@/domain/activity";
import { formatDayHeading, formatInstant } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useTaskDrawer } from "@/features/tasks/use-task-drawer";
import { EventIcon } from "./components/event-icon";
import { FEED_PAGE_SIZE } from "./activity-service";
import { useDescribeEvent } from "./describe-event";

type Source = "all" | ActivitySource;

export function ActivityPage() {
  const { t } = useTranslation();
  const services = useServices();
  const [source, setSource] = useState<Source>("all");

  const feed = useInfiniteQuery({
    queryKey: keys.feed(source),
    initialPageParam: undefined as ActivityFeedItem | undefined,
    queryFn: ({ pageParam }) =>
      services.activity.feed({
        ...(pageParam ? { before: { occurredAt: pageParam.occurredAt, id: pageParam.id } } : {}),
        ...(source === "all" ? {} : { source }),
      }),
    getNextPageParam: (last) => (last.length === FEED_PAGE_SIZE ? last.at(-1) : undefined),
  });

  const items = feed.data?.pages.flat() ?? [];
  const groups = groupByDay(items);

  return (
    <div className="mx-auto w-full max-w-3xl px-(--tf-page-x) py-6">
      <div className="mb-5">
        <SegmentedControl
          aria-label={t("activity.title")}
          value={source}
          onValueChange={setSource}
          options={[
            { value: "all", label: t("activity.filterAll") },
            { value: "system", label: t("activity.filterSystem") },
            { value: "user", label: t("activity.filterNotes") },
          ]}
        />
      </div>

      {feed.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={History} title={t("activity.title")} description={t("activity.empty")} />
      ) : (
        <>
          {groups.map(([day, dayItems]) => (
            <section key={day} className="mb-6">
              <h2 className="sticky top-0 z-10 mb-1 bg-canvas py-1.5 text-xs font-semibold text-fg-muted">
                {day}
              </h2>
              <ol>
                {dayItems.map((item) => (
                  <FeedItem key={item.id} item={item} />
                ))}
              </ol>
            </section>
          ))}
          <div className="flex justify-center py-4">
            {feed.hasNextPage ? (
              <Button
                variant="secondary"
                size="sm"
                loading={feed.isFetchingNextPage}
                onClick={() => void feed.fetchNextPage()}
              >
                {t("common.loadMore")}
              </Button>
            ) : (
              <p className="text-xs text-fg-subtle">{t("activity.end")}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function groupByDay(items: ActivityFeedItem[]): [string, ActivityFeedItem[]][] {
  const groups = new Map<string, ActivityFeedItem[]>();
  for (const item of items) {
    const day = formatDayHeading(item.occurredAt);
    const list = groups.get(day) ?? [];
    list.push(item);
    groups.set(day, list);
  }
  return [...groups.entries()];
}

function FeedItem({ item }: { item: ActivityFeedItem }) {
  const { t } = useTranslation();
  const describe = useDescribeEvent();
  const { open } = useTaskDrawer();
  const isNote = item.eventType === "note";
  const time = formatInstant(item.occurredAt).split(", ").at(-1);

  const subject = item.taskId ? (
    <button
      type="button"
      onClick={() => item.taskId && open(item.taskId)}
      className="max-w-64 truncate font-medium text-fg hover:underline"
    >
      {item.taskTitle ?? t("activity.deletedTask")}
    </button>
  ) : item.projectId ? (
    <Link
      to={`/projects/${item.projectId}`}
      className="max-w-64 truncate font-medium text-fg hover:underline"
    >
      {item.projectName}
    </Link>
  ) : (
    <Link to="/categories" className="max-w-64 truncate font-medium text-fg hover:underline">
      {item.categoryName}
    </Link>
  );

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-sm px-2 py-1.5 text-sm",
        isNote && "my-1 bg-raised py-2",
      )}
    >
      <EventIcon
        type={item.eventType}
        className={cn("mt-0.5 size-4 shrink-0", isNote ? "text-accent-text" : "text-fg-subtle")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-2xs text-fg-subtle">
            {t(
              `activity.subjects.${item.taskId ? "task" : item.projectId ? "project" : "category"}`,
            )}
          </span>
          {subject}
          {!isNote && <span className="min-w-0 truncate text-fg-muted">{describe(item)}</span>}
        </div>
        {isNote && <p className="selectable mt-1 whitespace-pre-wrap text-fg">{item.body}</p>}
      </div>
      <time
        dateTime={item.occurredAt}
        title={formatInstant(item.occurredAt)}
        className="shrink-0 text-xs text-fg-subtle tabular-nums"
      >
        {time}
      </time>
    </li>
  );
}
