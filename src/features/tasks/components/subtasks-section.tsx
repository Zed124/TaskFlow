import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type { TaskListItem } from "@/domain/task";
import { cn } from "@/lib/cn";
import { useTaskActions } from "../use-task-actions";
import { useTaskDrawer } from "../use-task-drawer";
import { DueLabel } from "./due-label";
import { StatusToggle } from "./status-toggle";
import { Section } from "./drawer-section";

export function SubtasksSection({
  parentId,
  subtasks,
}: {
  parentId: string;
  subtasks: TaskListItem[];
}) {
  const { t } = useTranslation();
  const { open } = useTaskDrawer();
  const { addSubtask, setStatus, remove } = useTaskActions();
  const [title, setTitle] = useState("");
  const done = subtasks.filter((s) => s.status === "completed").length;

  const submit = () => {
    if (!title.trim()) return;
    addSubtask.mutate({ parentId, title }, { onSuccess: () => setTitle("") });
  };

  return (
    <Section
      title={t("tasks.subtasks.title")}
      aside={
        subtasks.length > 0 ? (
          <span className="text-xs text-fg-subtle tabular-nums">
            {t("tasks.subtasks.progress", { done, total: subtasks.length })}
          </span>
        ) : null
      }
    >
      {subtasks.length > 0 && (
        <div className="mb-1 h-1 overflow-hidden rounded-full bg-raised" aria-hidden>
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${(done / subtasks.length) * 100}%` }}
          />
        </div>
      )}
      <ul>
        {subtasks.map((s) => {
          const closed = s.status === "completed" || s.status === "cancelled";
          return (
            <li
              key={s.id}
              className="group -mx-2 flex h-8 items-center gap-1.5 rounded-sm px-2 hover:bg-hover"
            >
              <StatusToggle
                status={s.status}
                onChange={(status) => setStatus.mutate({ id: s.id, status })}
              />
              <button
                type="button"
                onClick={() => open(s.id)}
                className={cn(
                  "min-w-0 flex-1 truncate text-start text-sm",
                  closed ? "text-fg-subtle line-through" : "text-fg",
                )}
              >
                {s.title}
              </button>
              <DueLabel dueDate={s.dueDate} dueTime={s.dueTime} status={s.status} />
              <button
                type="button"
                aria-label={t("tasks.subtasks.remove")}
                onClick={() => remove.mutate(s.id)}
                className="inline-flex size-6 items-center justify-center rounded-sm text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="-mx-2 flex h-8 items-center gap-1.5 rounded-sm px-2 focus-within:bg-canvas">
        <Plus className="ms-1 size-3.5 text-fg-subtle" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("tasks.subtasks.add")}
          aria-label={t("tasks.subtasks.add")}
          className="h-full flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
      </div>
    </Section>
  );
}
