import { useRef } from "react";
import type { TaskListItem } from "@/domain/task";
import { useTaskActions } from "../use-task-actions";
import { useTaskDrawer } from "../use-task-drawer";
import { useWindowedRange } from "../use-window";
import { TaskRow } from "./task-row";

/** Above this many rows, only the visible slice is rendered (rows have a fixed height). */
const WINDOW_THRESHOLD = 150;

/** A list of task rows sharing one drawer opener and one status mutation. */
export function TaskRows({
  tasks,
  label,
  showProject = true,
}: {
  tasks: readonly TaskListItem[];
  label: string;
  showProject?: boolean;
}) {
  const { open } = useTaskDrawer();
  const { setStatus } = useTaskActions();
  const listRef = useRef<HTMLDivElement>(null);
  const windowed = tasks.length > WINDOW_THRESHOLD;
  const { start, end, rowHeight } = useWindowedRange(listRef, tasks.length, windowed);

  return (
    <div
      ref={listRef}
      role="list"
      aria-label={label}
      style={
        windowed
          ? { paddingTop: start * rowHeight, paddingBottom: (tasks.length - end) * rowHeight }
          : undefined
      }
    >
      {tasks.slice(start, end).map((task, i) => (
        <div
          role="listitem"
          key={task.id}
          aria-setsize={tasks.length}
          aria-posinset={start + i + 1}
        >
          <TaskRow
            task={task}
            onOpen={open}
            onStatusChange={(id, status) => setStatus.mutate({ id, status })}
            showProject={showProject}
          />
        </div>
      ))}
    </div>
  );
}
