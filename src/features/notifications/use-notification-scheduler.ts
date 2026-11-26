import { useEffect, useRef } from "react";
import { useServices } from "@/app/use-services";
import type { NotificationPrefs } from "@/domain/notifications";
import { errorMessage } from "@/lib/errors";
import { notifications } from "@/platform/desktop";
import { useSettings } from "@/features/settings/use-settings";

const TICK_MS = 60_000;

/**
 * Checks for due notifications every minute (and when the window regains focus). Runs while the
 * app lives in the tray too, because hiding the window keeps the webview alive.
 */
export function useNotificationScheduler(): void {
  const services = useServices();
  const settings = useSettings();
  const prefs: NotificationPrefs = {
    enabled: settings["notifications.enabled"],
    reminders: settings["notifications.reminders"],
    reminderLeadMinutes: settings["notifications.reminderLeadMinutes"],
    dailyDigest: settings["notifications.dailyDigest"],
    digestTime: settings["notifications.digestTime"],
    overdue: settings["notifications.overdue"],
  };
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  });

  useEffect(() => {
    let running = false;
    const tick = async () => {
      if (running) return; // never overlap two checks
      running = true;
      try {
        const due = await services.notifications.collectDue(prefsRef.current);
        for (const n of due) await notifications.send(n.title, n.body);
      } catch (error) {
        console.warn("[notifications] check failed:", errorMessage(error));
      } finally {
        running = false;
      }
    };
    const first = setTimeout(() => void tick(), 5_000); // let startup settle first
    const id = setInterval(() => void tick(), TICK_MS);
    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [services]);
}
