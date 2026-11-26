import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, HardDriveDownload, Upload } from "lucide-react";
import { useServiceQuery } from "@/app/data";
import { useServices } from "@/app/use-services";
import { toast } from "@/app/toast-store";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { backupFileName, validateBackup, type BackupDocument } from "@/domain/backup";
import { BACKUP_INTERVALS, type BackupInterval } from "@/domain/settings";
import { migrations } from "@/db/migrations";
import { errorMessage } from "@/lib/errors";
import { formatInstant } from "@/lib/format";
import { files, joinPath } from "@/platform/files";
import { Row, Section } from "@/features/settings/settings-rows";
import { useSetting } from "@/features/settings/use-settings";
import { backupDirectory, runAutoBackup, runPreRestoreBackup, writeBackup } from "../backup-runner";
import { RestoreDialogs, type RestoreState } from "./restore-dialogs";

const RETENTION = [3, 7, 14, 30, 60] as const;
const SCHEMA_VERSION = migrations.at(-1)?.version ?? 0;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupSettings() {
  const { t } = useTranslation();
  const services = useServices();
  const queryClient = useQueryClient();
  const [auto, setAuto] = useSetting("backup.auto");
  const [interval, setInterval] = useSetting("backup.intervalHours");
  const [directory, setDirectory] = useSetting("backup.directory");
  const [retention, setRetention] = useSetting("backup.retention");
  const [busy, setBusy] = useState<string | null>(null);
  const [restore, setRestore] = useState<RestoreState>({ step: "idle" });

  const { data: defaultDir } = useServiceQuery(["backup", "defaultDir"], () =>
    files.defaultBackupDir(),
  );
  const { data: lastAuto } = useServiceQuery(["backup", "last", "auto"], (s) =>
    s.backup.lastRun("auto"),
  );
  const refreshRuns = () => queryClient.invalidateQueries({ queryKey: ["backup"] });

  const guard = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    try {
      await work();
    } catch (error) {
      toast.error(t("backup.failed", { message: errorMessage(error) }));
    } finally {
      setBusy(null);
      await refreshRuns();
    }
  };

  const backupNow = () =>
    guard("now", async () => {
      const r = await runAutoBackup(services, { directory, retention });
      toast.info(t("backup.nowDone", { name: r.path.split("\\").at(-1) ?? r.path }));
    });

  const exportBackup = () =>
    guard("export", async () => {
      const dir = await backupDirectory(directory);
      const path = await files.pickSavePath(joinPath(dir, backupFileName(null, new Date())), {
        name: "TaskFlow backup",
        extensions: ["json"],
      });
      if (!path) return;
      const r = await writeBackup(services, "manual", path);
      toast.info(t("backup.exported", { size: formatBytes(r.sizeBytes) }));
    });

  const exportCsv = () =>
    guard("csv", async () => {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const dir = await backupDirectory(directory);
      const path = await files.pickSavePath(joinPath(dir, `taskflow-tasks-${stamp}.csv`), {
        name: "CSV",
        extensions: ["csv"],
      });
      if (!path) return;
      const { csv, rows } = await services.backup.exportTasksCsv();
      await files.write(path, csv);
      toast.info(t("backup.csvDone", { count: rows }));
    });

  const chooseFolder = () =>
    guard("folder", async () => {
      const picked = await files.pickFolder(directory ?? defaultDir);
      if (picked) setDirectory(picked);
    });

  /** Step 1: pick and validate. Nothing changes until the user confirms the preview. */
  const startRestore = () =>
    guard("restore", async () => {
      const path = await files.pickBackupFile();
      if (!path) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(await files.readBackup(path));
      } catch (error) {
        setRestore({
          step: "invalid",
          errors: [t("backup.readFailed", { message: errorMessage(error) })],
        });
        return;
      }
      const result = validateBackup(parsed, SCHEMA_VERSION);
      setRestore(
        result.ok
          ? { step: "preview", document: result.document, summary: result.summary }
          : { step: "invalid", errors: result.errors },
      );
    });

  /** Step 2: safety backup first (abort if it fails), then the all-or-nothing restore. */
  const confirmRestore = async (doc: BackupDocument) => {
    setRestore({ step: "restoring" });
    let safetyName: string;
    try {
      const safety = await runPreRestoreBackup(services, directory);
      safetyName = safety.path.split("\\").at(-1) ?? safety.path;
    } catch (error) {
      setRestore({ step: "idle" });
      toast.error(t("backup.safetyFailed", { message: errorMessage(error) }));
      return;
    }
    try {
      await services.backup.restore(doc);
      await queryClient.invalidateQueries(); // everything, settings included
      toast.info(t("backup.restored", { name: safetyName }));
    } catch (error) {
      toast.error(t("backup.failed", { message: errorMessage(error) }));
    } finally {
      setRestore({ step: "idle" });
      await refreshRuns();
    }
  };

  const lastLine = !lastAuto
    ? t("backup.never")
    : lastAuto.status === "failed"
      ? t("backup.lastFailed", {
          when: formatInstant(lastAuto.started_at),
          error: lastAuto.error ?? "",
        })
      : lastAuto.status === "running"
        ? t("common.loading")
        : t("backup.lastOk", {
            when: formatInstant(lastAuto.finished_at ?? lastAuto.started_at),
            size: formatBytes(lastAuto.size_bytes ?? 0),
          });

  return (
    <Section title={t("backup.title")}>
      <Row label={t("backup.auto")} hint={t("backup.autoHint")} htmlFor="backup-auto">
        <div className="flex items-center gap-2">
          <Select
            aria-label={t("backup.interval")}
            value={String(interval)}
            disabled={!auto}
            onValueChange={(v) => setInterval(Number(v) as BackupInterval)}
            className="h-7 w-36 text-xs"
            options={BACKUP_INTERVALS.map((h) => ({
              value: String(h),
              label: t(`backup.intervals.${String(h) as "24"}`),
            }))}
          />
          <Switch id="backup-auto" checked={auto} onCheckedChange={setAuto} />
        </div>
      </Row>
      <Row
        label={t("backup.folder")}
        hint={
          directory ?? (defaultDir ? t("backup.folderDefault", { path: defaultDir }) : undefined)
        }
      >
        <div className="flex shrink-0 gap-1.5">
          {directory && (
            <Button size="sm" variant="ghost" onClick={() => setDirectory(null)}>
              {t("backup.useDefault")}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "folder"}
            onClick={() => void chooseFolder()}
          >
            {t("backup.change")}
          </Button>
        </div>
      </Row>
      <Row label={t("backup.retention")} hint={t("backup.retentionHint")}>
        <Select
          aria-label={t("backup.retention")}
          value={String(retention)}
          onValueChange={(v) => setRetention(Number(v))}
          className="h-7 w-36 text-xs"
          options={RETENTION.map((n) => ({
            value: String(n),
            label: t("backup.retentionValue", { count: n }),
          }))}
        />
      </Row>
      <Row label={t("backup.lastRun")} hint={lastLine}>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "now"}
          onClick={() => void backupNow()}
        >
          <HardDriveDownload className="size-3.5" aria-hidden />
          {t("backup.now")}
        </Button>
      </Row>
      <Row label={t("backup.export")} hint={t("backup.exportHint")}>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "export"}
          onClick={() => void exportBackup()}
        >
          <Download className="size-3.5" aria-hidden />
          {t("backup.export")}
        </Button>
      </Row>
      <Row label={t("backup.restore")} hint={t("backup.restoreHint")}>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "restore"}
          onClick={() => void startRestore()}
        >
          <Upload className="size-3.5" aria-hidden />
          {t("backup.restore")}
        </Button>
      </Row>
      <Row label={t("backup.csv")} hint={t("backup.csvHint")}>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "csv"}
          onClick={() => void exportCsv()}
        >
          <FileSpreadsheet className="size-3.5" aria-hidden />
          {t("backup.csv")}
        </Button>
      </Row>
      <RestoreDialogs
        state={restore}
        onCancel={() => setRestore({ step: "idle" })}
        onConfirm={(doc) => void confirmRestore(doc)}
      />
    </Section>
  );
}
