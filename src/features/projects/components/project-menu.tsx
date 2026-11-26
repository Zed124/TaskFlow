import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useServiceMutation } from "@/app/data";
import { toast } from "@/app/toast-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import type { ProjectWithProgress } from "@/domain/project";
import { ProjectFormDialog } from "./project-form-dialog";

export function ProjectMenu({
  project,
  onDeleted,
}: {
  project: ProjectWithProgress;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const archive = useServiceMutation((s, id: string) => s.projects.archive(id));
  const unarchive = useServiceMutation((s, id: string) => s.projects.unarchive(id));
  const remove = useServiceMutation((s, id: string) => s.projects.delete(id), {
    onSuccess: () => {
      toast.info(t("projects.deleted"));
      onDeleted?.();
    },
  });
  const taskCount = project.progress.total + project.progress.cancelled;

  // React portals bubble events to their React parent; keep menu/dialog interaction from
  // reaching a clickable row this menu sits in.
  return (
    <span
      className="contents"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton icon={MoreHorizontal} label={t("common.more")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem icon={Pencil} onSelect={() => setEditing(true)}>
            {t("projects.edit")}
          </DropdownMenuItem>
          {project.archivedAt ? (
            <DropdownMenuItem icon={ArchiveRestore} onSelect={() => unarchive.mutate(project.id)}>
              {t("common.unarchive")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem icon={Archive} onSelect={() => archive.mutate(project.id)}>
              {t("common.archive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={Trash2} destructive onSelect={() => setConfirming(true)}>
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <ProjectFormDialog project={project} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("projects.deleteConfirmTitle", { name: project.name })}
        description={t("projects.deleteConfirmBody", { count: taskCount })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => remove.mutate(project.id)}
      />
    </span>
  );
}
