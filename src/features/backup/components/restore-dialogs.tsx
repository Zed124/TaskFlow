import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { BackupDocument, BackupSummary } from "@/domain/backup";
import { formatInstant } from "@/lib/format";

export type RestoreState =
  | { step: "idle" }
  | { step: "invalid"; errors: string[] }
  | { step: "preview"; document: BackupDocument; summary: BackupSummary }
  | { step: "restoring" };

/** Error list for unusable files, or the preview + explicit confirmation for valid ones. */
export function RestoreDialogs({
  state,
  onCancel,
  onConfirm,
}: {
  state: RestoreState;
  onCancel: () => void;
  onConfirm: (doc: BackupDocument) => void;
}) {
  const { t } = useTranslation();

  if (state.step === "invalid") {
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && onCancel()}
        title={t("backup.invalidTitle")}
        footer={<Button onClick={onCancel}>{t("common.close")}</Button>}
      >
        <p className="text-sm text-fg-muted">{t("backup.invalidBody")}</p>
        <ul className="selectable mt-2 list-disc ps-5 text-xs text-danger">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Dialog>
    );
  }

  if (state.step === "preview" || state.step === "restoring") {
    const preview = state.step === "preview" ? state : null;
    const d = preview?.document.data;
    const allTasks = d?.tasks ?? [];
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && state.step === "preview" && onCancel()}
        title={t("backup.previewTitle")}
        footer={
          <>
            <Button variant="ghost" disabled={!preview} onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={!preview}
              onClick={() => preview && onConfirm(preview.document)}
            >
              {preview ? t("backup.confirm") : t("backup.restoring")}
            </Button>
          </>
        }
      >
        <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>{t("backup.previewBody")}</p>
        </div>
        {preview && d && (
          <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt className="text-fg-subtle">{t("backup.made")}</dt>
            <dd className="text-fg">{formatInstant(preview.summary.exportedAt)}</dd>
            <dt className="text-fg-subtle">{t("backup.contents")}</dt>
            <dd className="text-fg">
              {t("backup.contentsValue", {
                tasks: preview.summary.activeTasks,
                subtasks: allTasks.filter((x) => x.parent_id !== null && x.deleted_at === null)
                  .length,
                deleted: allTasks.filter((x) => x.deleted_at !== null).length,
                projects: d.projects.filter((p) => p.deleted_at === null).length,
                categories: d.categories.filter((c) => c.deleted_at === null).length,
                events: d.activity_events.length,
                sessions: d.work_sessions.length,
              })}
            </dd>
          </dl>
        )}
      </Dialog>
    );
  }

  return null;
}
