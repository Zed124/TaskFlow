import type { TaskListItem } from "@/domain/task";
import { useTaskActions } from "../use-task-actions";
import { useTaskDrawer } from "../use-task-drawer";
import { TaskRow } from "./task-row";

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
  return (
    <div role="list" aria-label={label}>
      {tasks.map((task) => (
        <div role="listitem" key={task.id}>
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
