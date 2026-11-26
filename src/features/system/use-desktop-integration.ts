import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/app/ui-store";
import { lifecycle } from "@/platform/desktop";
import { useSetting } from "@/features/settings/use-settings";
import {
  formatClock,
  useActiveTimer,
  useLiveElapsed,
  useTimerActions,
} from "@/features/time-tracking/use-timer";

/**
 * Bridges native desktop events and app state. Mounted once in the app shell:
 * - pushes the close-to-tray preference to Rust,
 * - handles tray actions (new task, pause/resume/stop timer),
 * - flushes pending edits before the process exits,
 * - keeps the tray's timer line current.
 */
export function useDesktopIntegration(): void {
  const queryClient = useQueryClient();
  const openCreate = useUiStore((s) => s.openCreateTask);
  const [closeToTray] = useSetting("system.closeToTray");
  const { data: active } = useActiveTimer();
  const { pause, resume, stop } = useTimerActions();

  useEffect(() => {
    void lifecycle.setCloseToTray(closeToTray);
  }, [closeToTray]);

  // Keep the latest values reachable from long-lived native listeners.
  const latest = useRef({ active, pause, resume, stop, openCreate });
  useEffect(() => {
    latest.current = { active, pause, resume, stop, openCreate };
  });

  useEffect(() => {
    const subscriptions = [
      lifecycle.onTrayNewTask(() => latest.current.openCreate()),
      lifecycle.onTrayTimer((action) => {
        const { active: a, pause: p, resume: r, stop: s } = latest.current;
        if (!a) return;
        if (action === "stop") s.mutate(a.taskTitle);
        else if (a.session.state === "running") p.mutate(undefined);
        else r.mutate(undefined);
      }),
      lifecycle.onQuitRequested(() => {
        void flushThenExit(queryClient);
      }),
    ];
    return () => {
      for (const s of subscriptions) void s.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  // Tray timer line: refresh when the timer changes and once a minute while it runs.
  const elapsed = useLiveElapsed(active?.session);
  const minute = Math.floor(elapsed / 60_000);
  useEffect(() => {
    if (!active) {
      void lifecycle.setTrayTimer(null, false);
      return;
    }
    const running = active.session.state === "running";
    const status = `${running ? "Tracking" : "Paused"}: ${active.taskTitle} (${formatClock(minute * 60_000)})`;
    void lifecycle.setTrayTimer(status, running);
  }, [active, minute]);
}

/**
 * Commits whatever is being edited (editors save on blur), waits for in-flight writes to
 * finish (bounded), then exits. A running work timer needs nothing: it lives in the DB.
 */
async function flushThenExit(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const deadline = Date.now() + 2500;
  // Give blur handlers a tick to start their mutations.
  await new Promise((r) => setTimeout(r, 50));
  while (queryClient.isMutating() > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await lifecycle.exit();
}
