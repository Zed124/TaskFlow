import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/ui-store";
import { toast } from "@/app/toast-store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { CreateTaskInput, TaskPriority, TaskStatus } from "@/domain/task";
import { ValidationError, errorMessage } from "@/lib/errors";
import { useTaskActions } from "../use-task-actions";
import { useTaskDrawer } from "../use-task-drawer";
import { DueField } from "./due-field";
import {
  fromOptional,
  toOptional,
  useCategoryOptions,
  usePriorityOptions,
  useProjectOptions,
  useStatusOptions,
} from "./task-options";

type Form = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  projectId: string | null;
  categoryId: string | null;
};

function initialForm(defaults: Partial<CreateTaskInput>): Form {
  return {
    title: defaults.title ?? "",
    description: defaults.description ?? "",
    status: defaults.status ?? "todo",
    priority: defaults.priority ?? "medium",
    dueDate: defaults.dueDate ?? null,
    dueTime: defaults.dueTime ?? null,
    projectId: defaults.projectId ?? null,
    categoryId: defaults.categoryId ?? null,
  };
}

/** Full task creation form. Mounted once in the shell; opened via the UI store. */
export function CreateTaskDialog() {
  const { open, defaults } = useUiStore((s) => s.createTask);
  const close = useUiStore((s) => s.closeCreateTask);
  return open ? <CreateTaskForm defaults={defaults} onClose={close} /> : null;
}

function CreateTaskForm({
  defaults,
  onClose,
}: {
  defaults: Partial<CreateTaskInput>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { create } = useTaskActions();
  const drawer = useTaskDrawer();
  const [form, setForm] = useState<Form>(() => initialForm(defaults));
  const [another, setAnother] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusOptions = useStatusOptions();
  const priorityOptions = usePriorityOptions();
  const projectOptions = useProjectOptions(form.projectId);
  const categoryOptions = useCategoryOptions();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    setError(null);
    create.mutate(form, {
      onSuccess: (task) => {
        if (another) {
          // Keep context (project, category, due) for quick batch entry.
          setForm((f) => ({ ...f, title: "", description: "" }));
          toast.info(t("tasks.create.created"));
        } else {
          onClose();
          drawer.open(task.id);
        }
      },
      onError: (e) => setError(e instanceof ValidationError ? e.message : errorMessage(e)),
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("tasks.create.title")}
      className="w-[min(600px,calc(100vw-32px))]"
      footer={
        <>
          <label className="me-auto flex items-center gap-2 text-xs text-fg-muted">
            <Switch
              checked={another}
              onCheckedChange={setAnother}
              aria-label={t("tasks.create.more")}
            />
            {t("tasks.create.more")}
          </label>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={create.isPending}
            disabled={!form.title.trim()}
          >
            {t("tasks.create.submit")}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
        }}
        className="flex flex-col gap-3"
      >
        <input
          autoFocus
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t("tasks.titlePlaceholder")}
          aria-label={t("tasks.title")}
          aria-invalid={error ? true : undefined}
          className="w-full bg-transparent font-display text-lg font-semibold text-fg outline-none placeholder:text-fg-subtle"
        />
        <AutoTextarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          minRows={3}
          placeholder={t("tasks.descriptionPlaceholder")}
          aria-label={t("tasks.description")}
          className="text-sm text-fg placeholder:text-fg-subtle"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Select
            aria-label={t("status.label")}
            value={form.status}
            options={statusOptions}
            onValueChange={(v) => set({ status: v as TaskStatus })}
            className="w-36"
          />
          <Select
            aria-label={t("priority.label")}
            value={form.priority}
            options={priorityOptions}
            onValueChange={(v) => set({ priority: v as TaskPriority })}
            className="w-32"
          />
          <Select
            aria-label={t("tasks.project")}
            value={fromOptional(form.projectId)}
            options={projectOptions}
            onValueChange={(v) => set({ projectId: toOptional(v) })}
            className="w-40"
          />
          <Select
            aria-label={t("tasks.category")}
            value={fromOptional(form.categoryId)}
            options={categoryOptions}
            onValueChange={(v) => set({ categoryId: toOptional(v) })}
            className="w-36"
          />
          <DueField
            dueDate={form.dueDate}
            dueTime={form.dueTime}
            onChange={(dueDate, dueTime) => set({ dueDate, dueTime })}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
