import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServiceMutation } from "@/app/data";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EntityColor } from "@/domain/colors";
import type { Project } from "@/domain/project";
import { errorMessage } from "@/lib/errors";
import { ColorPicker } from "@/components/ui/color-picker";

interface ProjectFormDialogProps {
  /** Edit this project, or create a new one when undefined. */
  project?: Project;
  onClose: () => void;
  onSaved?: (project: Project) => void;
}

export function ProjectFormDialog({ project, onClose, onSaved }: ProjectFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState<EntityColor>(project?.color ?? "violet");
  const [error, setError] = useState<string | null>(null);

  const save = useServiceMutation(
    (s, input: { name: string; description: string; color: EntityColor }) =>
      project ? s.projects.update(project.id, input) : s.projects.create(input),
    {
      silentErrors: true,
      onSuccess: (p) => {
        onSaved?.(p);
        onClose();
      },
    },
  );

  const submit = () =>
    save.mutate({ name, description, color }, { onError: (e) => setError(errorMessage(e)) });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={project ? t("projects.edit") : t("projects.new")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={save.isPending}
            disabled={!name.trim()}
          >
            {project ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-fg-muted">{t("projects.name")}</span>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("projects.namePlaceholder")}
            aria-invalid={error ? true : undefined}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-fg-muted">{t("projects.description")}</span>
          <AutoTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={3}
            placeholder={t("projects.descriptionPlaceholder")}
            className="rounded-sm border border-line bg-canvas px-2.5 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-accent"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-fg-muted">{t("projects.color")}</span>
          <ColorPicker value={color} onChange={setColor} label={t("projects.color")} />
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
