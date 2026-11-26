import { useTranslation } from "react-i18next";
import { Archive, ListTree } from "lucide-react";
import type { TaskListItem, TaskStatus } from "@/domain/task";
import { cn } from "@/lib/cn";
import { ColorDot } from "@/components/ui/color-dot";
import { PriorityIcon } from "./priority-icon";
import { StatusToggle } from "./status-toggle";
import { DueLabel } from "./due-label";

interface TaskRowProps {
  task: TaskListItem;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  showProject?: boolean;
}

export function TaskRow({ task, onOpen, onStatusChange, showProject = true }: TaskRowProps) {
  const { t } = useTranslation();
  const closed = task.status === "completed" || task.status === "cancelled";

  return (
    // The row is clickable with the mouse; for keyboard and screen readers the title is the
    // button that opens the task, and the status toggle is a separate button (never nested).
    <div
      onClick={() => onOpen(task.id)}
      className={cn(
        "group flex h-row cursor-default items-center gap-2 border-b border-line/60 px-(--tf-page-x) text-sm",
        "transition-colors hover:bg-hover has-[[data-open]:focus-visible]:bg-hover",
        "has-[[data-open]:focus-visible]:shadow-[inset_2px_0_0_var(--color-accent)]",
      )}
    >
      <span title={t(`priority.${task.priority}`)} className="inline-flex">
        <PriorityIcon priority={task.priority} />
      </span>
      <StatusToggle status={task.status} onChange={(status) => onStatusChange(task.id, status)} />

      <button
        type="button"
        data-open
        onClick={(e) => {
          e.stopPropagation();
          onOpen(task.id);
        }}
        className={cn(
          "min-w-0 truncate rounded-xs text-start outline-none",
          closed ? "text-fg-subtle line-through decoration-fg-subtle/50" : "text-fg",
        )}
      >
        {task.title}
      </button>

      {task.subtaskCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-subtle tabular-nums">
          <ListTree className="size-3.5" strokeWidth={1.75} aria-hidden />
          {task.subtaskDoneCount}/{task.subtaskCount}
        </span>
      )}
      {task.archivedAt && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-subtle">
          <Archive className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t("common.archived")}
        </span>
      )}

      <span className="flex-1" />

      {task.categoryName && (
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-fg-muted md:inline-flex">
          <ColorDot color={task.categoryColor} />
          {task.categoryName}
        </span>
      )}
      {showProject && task.projectName && (
        <span className="hidden max-w-40 shrink-0 truncate text-xs text-fg-subtle lg:inline">
          {task.projectName}
        </span>
      )}
      <DueLabel
        dueDate={task.dueDate}
        dueTime={task.dueTime}
        status={task.status}
        className="w-28 shrink-0 justify-end"
      />
    </div>
  );
}
