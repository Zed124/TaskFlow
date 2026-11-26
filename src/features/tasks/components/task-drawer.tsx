import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ArchiveRestore,
  CornerLeftUp,
  FileQuestion,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { keys, useServiceQuery } from "@/app/data";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import type { TaskPriority, TaskStatus } from "@/domain/task";
import { formatInstant } from "@/lib/format";
import { ActivityTimeline } from "@/features/activity/components/activity-timeline";
import type { TaskDetails } from "../task-service";
import { useTaskActions } from "../use-task-actions";
import { useTaskDrawer } from "../use-task-drawer";
import { CommitTextarea } from "./commit-textarea";
import { Section } from "./drawer-section";
import { DueField } from "./due-field";
import { SubtasksSection } from "./subtasks-section";
import { CompletionHistory, TimeSection } from "./task-history-sections";
import {
  fromOptional,
  toOptional,
  useCategoryOptions,
  usePriorityOptions,
  useProjectOptions,
  useStatusOptions,
} from "./task-options";

/** Side panel with everything about one task. Mounted once in the app shell. */
export function TaskDrawer() {
  const { t } = useTranslation();
  const { taskId, close } = useTaskDrawer();
  const { data, isPending } = useServiceQuery(
    keys.task(taskId ?? ""),
    (s) => s.tasks.getDetails(taskId ?? ""),
    {
      enabled: taskId !== null,
    },
  );
  // keepPreviousData would briefly show the previous task when switching; only trust matching data.
  const details = data && data.task.id === taskId ? data : null;

  return (
    <Drawer
      open={taskId !== null}
      onOpenChange={(open) => !open && close()}
      title={details?.task.projectName ?? t("tasks.drawer.heading")}
      headerActions={details ? <TaskMenu details={details} onDeleted={close} /> : null}
    >
      {details ? (
        <TaskDrawerBody key={details.task.id} details={details} />
      ) : isPending && taskId ? (
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <EmptyState
          icon={FileQuestion}
          title={t("tasks.drawer.notFoundTitle")}
          description={t("tasks.drawer.notFoundBody")}
        />
      )}
    </Drawer>
  );
}

function TaskDrawerBody({ details }: { details: TaskDetails }) {
  const { t } = useTranslation();
  const { task, parent } = details;
  const { open } = useTaskDrawer();
  const { update, setStatus } = useTaskActions();
  const statusOptions = useStatusOptions();
  const priorityOptions = usePriorityOptions();
  const projectOptions = useProjectOptions(task.projectId);
  const categoryOptions = useCategoryOptions();
  const patch = (p: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id: task.id, patch: p });

  return (
    <div className="flex flex-col gap-6 px-6 pt-5 pb-10">
      <div>
        {parent && (
          <button
            type="button"
            onClick={() => open(parent.id)}
            className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-sm text-xs text-fg-subtle hover:text-fg"
            title={t("tasks.drawer.openParent")}
          >
            <CornerLeftUp className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {t("tasks.drawer.parent")} {parent.title}
            </span>
          </button>
        )}
        <CommitTextarea
          value={task.title}
          onCommit={(title) => patch({ title })}
          singleLine
          required
          aria-label={t("tasks.title")}
          className="font-display text-xl font-semibold text-fg"
        />
        <p className="mt-1 text-xs text-fg-subtle">
          {t("tasks.drawer.created", { date: formatInstant(task.createdAt) })}
          {task.archivedAt && <> · {t("common.archived")}</>}
        </p>
      </div>

      <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-1">
        <Property label={t("status.label")}>
          <Select
            variant="ghost"
            aria-label={t("status.label")}
            value={task.status}
            options={statusOptions}
            onValueChange={(v) => setStatus.mutate({ id: task.id, status: v as TaskStatus })}
          />
        </Property>
        <Property label={t("priority.label")}>
          <Select
            variant="ghost"
            aria-label={t("priority.label")}
            value={task.priority}
            options={priorityOptions}
            onValueChange={(v) => patch({ priority: v as TaskPriority })}
          />
        </Property>
        <Property label={t("due.label")}>
          <DueField
            dueDate={task.dueDate}
            dueTime={task.dueTime}
            onChange={(dueDate, dueTime) => patch({ dueDate, dueTime })}
          />
        </Property>
        <Property label={t("tasks.project")}>
          <Select
            variant="ghost"
            aria-label={t("tasks.project")}
            value={fromOptional(task.projectId)}
            options={projectOptions}
            disabled={task.parentId !== null}
            onValueChange={(v) => patch({ projectId: toOptional(v) })}
          />
          {task.parentId && (
            <span className="ms-2 text-2xs text-fg-subtle">{t("tasks.subtaskProjectHint")}</span>
          )}
        </Property>
        <Property label={t("tasks.category")}>
          <Select
            variant="ghost"
            aria-label={t("tasks.category")}
            value={fromOptional(task.categoryName ? task.categoryId : null)}
            options={categoryOptions}
            onValueChange={(v) => patch({ categoryId: toOptional(v) })}
          />
        </Property>
      </dl>

      <Section title={t("tasks.description")}>
        <CommitTextarea
          value={task.description}
          onCommit={(description) => patch({ description })}
          minRows={2}
          placeholder={t("tasks.descriptionPlaceholder")}
          aria-label={t("tasks.description")}
          className="selectable -mx-2 rounded-sm px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle hover:bg-hover focus:bg-canvas focus:shadow-[0_0_0_1px_var(--color-line-strong)]"
        />
      </Section>

      {!task.parentId && <SubtasksSection parentId={task.id} subtasks={details.subtasks} />}

      <Section title={t("tasks.notes")}>
        <CommitTextarea
          value={task.notes}
          onCommit={(notes) => patch({ notes })}
          minRows={2}
          placeholder={t("tasks.notesPlaceholder")}
          aria-label={t("tasks.notes")}
          className="selectable -mx-2 rounded-sm px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle hover:bg-hover focus:bg-canvas focus:shadow-[0_0_0_1px_var(--color-line-strong)]"
        />
      </Section>

      <TimeSection details={details} />
      {details.completions.length > 0 && <CompletionHistory completions={details.completions} />}

      <Section title={t("activity.title")}>
        <ActivityTimeline taskId={task.id} />
      </Section>
    </div>
  );
}

function TaskMenu({ details, onDeleted }: { details: TaskDetails; onDeleted: () => void }) {
  const { t } = useTranslation();
  const { archive, unarchive, remove } = useTaskActions();
  const [confirming, setConfirming] = useState(false);
  const { task } = details;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton icon={MoreHorizontal} label={t("common.more")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {task.archivedAt ? (
            <DropdownMenuItem icon={ArchiveRestore} onSelect={() => unarchive.mutate(task.id)}>
              {t("common.unarchive")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem icon={Archive} onSelect={() => archive.mutate(task.id)}>
              {t("common.archive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={Trash2} destructive onSelect={() => setConfirming(true)}>
            {t("tasks.actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("tasks.actions.deleteConfirmTitle", { title: task.title })}
        description={t("tasks.actions.deleteConfirmBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => remove.mutate(task.id, { onSuccess: onDeleted })}
      />
    </>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </>
  );
}
