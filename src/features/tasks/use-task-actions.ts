import { useTranslation } from "react-i18next";
import { useServiceMutation } from "@/app/data";
import { toast } from "@/app/toast-store";
import type { CreateTaskInput, TaskStatus, UpdateTaskPatch } from "@/domain/task";

/** All task writes the UI performs, each wired to cache refresh and error toasts. */
export function useTaskActions() {
  const { t } = useTranslation();

  const create = useServiceMutation((s, input: CreateTaskInput) => s.tasks.create(input));
  const update = useServiceMutation((s, v: { id: string; patch: UpdateTaskPatch }) =>
    s.tasks.update(v.id, v.patch),
  );
  const setStatus = useServiceMutation((s, v: { id: string; status: TaskStatus }) =>
    s.tasks.setStatus(v.id, v.status),
  );
  const addSubtask = useServiceMutation((s, v: { parentId: string; title: string }) =>
    s.tasks.addSubtask(v.parentId, v.title),
  );
  const restore = useServiceMutation((s, id: string) => s.tasks.restore(id), {
    onSuccess: () => toast.info(t("tasks.actions.restored")),
  });
  const archive = useServiceMutation((s, id: string) => s.tasks.archive(id), {
    onSuccess: (_task, id) =>
      toast.info(t("tasks.actions.archived"), {
        label: t("common.unarchive"),
        run: () => unarchive.mutate(id),
      }),
  });
  const unarchive = useServiceMutation((s, id: string) => s.tasks.unarchive(id));
  const remove = useServiceMutation((s, id: string) => s.tasks.delete(id), {
    onSuccess: (_void, id) =>
      toast.info(t("tasks.actions.deleted"), {
        label: t("common.restore"),
        run: () => restore.mutate(id),
      }),
  });

  return { create, update, setStatus, addSubtask, archive, unarchive, remove, restore };
}
