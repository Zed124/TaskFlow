import type { ReactNode } from "react";
import type { TaskListItem } from "@/domain/task";
import { cn } from "@/lib/cn";
import { TaskRows } from "@/features/tasks/components/task-rows";

/** A titled group of task rows (e.g. "Overdue", or one day in Upcoming). */
export function TaskSection({
  title,
  tasks,
  tone = "default",
  aside,
}: {
  title: string;
  tasks: readonly TaskListItem[];
  tone?: "default" | "danger" | "muted";
  aside?: ReactNode;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="mb-2">
      <h2
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-canvas px-(--tf-page-x) py-2 text-xs font-semibold",
          tone === "danger" ? "text-danger" : tone === "muted" ? "text-fg-subtle" : "text-fg-muted",
        )}
      >
        {title}
        <span className="font-normal text-fg-subtle tabular-nums">{tasks.length}</span>
        {aside}
      </h2>
      <TaskRows tasks={tasks} label={title} />
    </section>
  );
}
