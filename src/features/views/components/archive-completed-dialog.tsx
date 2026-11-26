import { useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays } from "date-fns";
import { useServiceMutation } from "@/app/data";
import { useServices } from "@/app/use-services";
import { useUndo } from "@/app/use-undo";
import { toast } from "@/app/toast-store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toIsoInstant } from "@/lib/time";

type Scope = "all" | "older7" | "older30";

/** Bulk-archives completed tasks; one Undo restores them all. */
export function ArchiveCompletedDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const services = useServices();
  const { record, notify } = useUndo();
  const [scope, setScope] = useState<Scope>("older7");

  const archive = useServiceMutation(
    (s, sc: Scope) =>
      s.tasks.archiveCompleted(
        sc === "all"
          ? {}
          : { completedBefore: toIsoInstant(addDays(new Date(), sc === "older7" ? -7 : -30)) },
      ),
    {
      onSuccess: (ids) => {
        onClose();
        if (ids.length === 0) {
          toast.info(t("archive.none"));
          return;
        }
        notify(
          t("undo.toasts.archivedMany", { count: ids.length }),
          record(t("undo.labels.archiveMany", { count: ids.length }), () =>
            services.tasks.unarchiveMany(ids),
          ),
        );
      },
    },
  );

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("archive.title")}
      description={t("archive.body")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            loading={archive.isPending}
            onClick={() => archive.mutate(scope)}
          >
            {t("archive.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs text-fg-muted">{t("archive.scope")}</span>
        <SegmentedControl
          aria-label={t("archive.scope")}
          value={scope}
          onValueChange={setScope}
          options={[
            { value: "older7", label: t("archive.older7") },
            { value: "older30", label: t("archive.older30") },
            { value: "all", label: t("archive.all") },
          ]}
        />
      </div>
    </Dialog>
  );
}
