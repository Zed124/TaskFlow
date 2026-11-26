import { useTranslation } from "react-i18next";
import { useServiceMutation } from "@/app/data";
import { toast } from "@/app/toast-store";
import { useUndo } from "@/app/use-undo";
import { useServices } from "@/app/use-services";
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskPatch } from "@/domain/task";

/** The previous values of exactly the fields a patch touched (due date and time travel together). */
function inversePatch(before: Task, patch: UpdateTaskPatch): UpdateTaskPatch {
  const inverse: UpdateTaskPatch = {};
  for (const key of Object.keys(patch) as (keyof UpdateTaskPatch)[]) {
    if (key === "dueDate" || key === "dueTime") {
      inverse.dueDate = before.dueDate;
      inverse.dueTime = before.dueTime;
    } else {
      (inverse as Record<string, unknown>)[key] = before[key];
    }
  }
  return inverse;
}

/**
 * All task writes the UI performs, wired to cache refresh, error toasts and undo.
 * Undo is compensating: undoing a completion records a new status change marked as an undo.
 */
export function useTaskActions() {
  const { t } = useTranslation();
  const services = useServices();
  const { record, notify } = useUndo();

  const create = useServiceMutation((s, input: CreateTaskInput) => s.tasks.create(input), {
    onSuccess: (task) =>
      record(t("undo.labels.create", { title: task.title }), () => services.tasks.delete(task.id)),
  });

  const update = useServiceMutation(
    async (s, v: { id: string; patch: UpdateTaskPatch }) => {
      const before = await s.tasks.get(v.id);
      const after = await s.tasks.update(v.id, v.patch);
      return { before, after, patch: v.patch };
    },
    {
      onSuccess: ({ before, after, patch }) => {
        if (before && after.updatedAt !== before.updatedAt) {
          record(t("undo.labels.edit", { title: before.title }), () =>
            services.tasks.update(before.id, inversePatch(before, patch)),
          );
        }
      },
    },
  );

  const setStatus = useServiceMutation(
    async (s, v: { id: string; status: TaskStatus }) => {
      const before = await s.tasks.get(v.id);
      const after = await s.tasks.setStatus(v.id, v.status);
      return { before, after };
    },
    {
      onSuccess: ({ before, after }) => {
        if (!before || before.status === after.status) return;
        const entry = record(t("undo.labels.status", { title: after.title }), () =>
          services.tasks.setStatus(before.id, before.status, { undo: true }),
        );
        // Toast the changes that are easy to make by accident.
        if (after.status === "completed" || after.status === "cancelled") {
          notify(t(`undo.toasts.${after.status}`, { title: after.title }), entry);
        }
      },
    },
  );

  const addSubtask = useServiceMutation(
    (s, v: { parentId: string; title: string }) => s.tasks.addSubtask(v.parentId, v.title),
    {
      onSuccess: (task) =>
        record(t("undo.labels.create", { title: task.title }), () =>
          services.tasks.delete(task.id),
        ),
    },
  );

  const restore = useServiceMutation((s, id: string) => s.tasks.restore(id), {
    onSuccess: () => toast.info(t("tasks.actions.restored")),
  });

  const archive = useServiceMutation((s, id: string) => s.tasks.archive(id), {
    onSuccess: (task) =>
      notify(
        t("tasks.actions.archived"),
        record(t("undo.labels.archive", { title: task.title }), () =>
          services.tasks.unarchive(task.id),
        ),
      ),
  });

  const unarchive = useServiceMutation((s, id: string) => s.tasks.unarchive(id), {
    onSuccess: (task) =>
      record(t("undo.labels.unarchive", { title: task.title }), () =>
        services.tasks.archive(task.id),
      ),
  });

  const remove = useServiceMutation(
    async (s, id: string) => {
      const before = await s.tasks.get(id);
      await s.tasks.delete(id);
      return before;
    },
    {
      onSuccess: (before) => {
        if (!before) return;
        notify(
          t("tasks.actions.deleted"),
          record(t("undo.labels.delete", { title: before.title }), () =>
            services.tasks.restore(before.id),
          ),
        );
      },
    },
  );

  return { create, update, setStatus, addSubtask, archive, unarchive, remove, restore };
}
