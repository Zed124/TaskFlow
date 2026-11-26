import { useState } from "react";
import { useSearchParams } from "react-router";
import { useUiStore } from "@/app/ui-store";
import type { TaskFilter } from "@/domain/task-filter";
import { TaskFilters } from "./components/task-filters";
import { TaskList } from "./components/task-list";
import { useTaskList } from "./use-task-list";

/** All tasks. `?category=<id>` pre-filters (used by the Categories page). */
export function TasksPage() {
  const [params] = useSearchParams();
  const category = params.get("category");
  // Re-mount when the category link changes so the filter starts fresh.
  return <TasksView key={category ?? ""} initialCategory={category} />;
}

function TasksView({ initialCategory }: { initialCategory: string | null }) {
  const [filter, setFilter] = useState<TaskFilter>(() => ({
    sort: { field: "created", direction: "desc" },
    ...(initialCategory ? { categoryIds: [initialCategory] } : {}),
  }));
  const openCreate = useUiStore((s) => s.openCreateTask);
  const { data } = useTaskList(filter);

  return (
    <div className="flex min-h-full flex-col">
      <TaskFilters filter={filter} onChange={setFilter} count={data?.length} />
      <TaskList filter={filter} onCreate={() => openCreate()} />
    </div>
  );
}
