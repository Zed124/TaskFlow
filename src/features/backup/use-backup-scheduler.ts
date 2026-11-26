import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { useServices } from "@/app/use-services";
import { errorMessage } from "@/lib/errors";
import { useSettings } from "@/features/settings/use-settings";
import { runAutoBackupIfDue } from "./backup-runner";

const CHECK_MS = 10 * 60_000;
const FIRST_CHECK_MS = 30_000;

/** Runs automatic backups on schedule while the app is open (including in the tray). */
export function useBackupScheduler(): void {
  const services = useServices();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const opts = {
    enabled: settings["backup.auto"],
    intervalHours: settings["backup.intervalHours"],
    directory: settings["backup.directory"],
    retention: settings["backup.retention"],
  };
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    if (!isTauri()) return;
    let busy = false;
    const check = async () => {
      const o = optsRef.current;
      if (busy || !o.enabled) return;
      busy = true;
      try {
        const done = await runAutoBackupIfDue(services, o);
        if (done) await queryClient.invalidateQueries({ queryKey: ["backup"] });
      } catch (error) {
        // Recorded in backup_runs and shown on the Settings page; never interrupts the user.
        console.warn("[backup] automatic backup failed:", errorMessage(error));
        await queryClient.invalidateQueries({ queryKey: ["backup"] });
      } finally {
        busy = false;
      }
    };
    const first = setTimeout(() => void check(), FIRST_CHECK_MS);
    const id = setInterval(() => void check(), CHECK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [services, queryClient]);
}
