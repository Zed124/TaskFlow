import { useDeferredValue } from "react";
import { keys, useServiceQuery } from "@/app/data";
import type { TaskFilter } from "@/domain/task-filter";

/** Tasks matching a filter. Deferred so typing in the filter box never blocks input. */
export function useTaskList(filter: TaskFilter) {
  const deferred = useDeferredValue(filter);
  return useServiceQuery(keys.tasks(deferred), (s) => s.tasks.list(deferred));
}
