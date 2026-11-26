import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServiceMutation, useServiceQuery } from "@/app/data";
import { toast } from "@/app/toast-store";
import { sessionElapsedMs, type WorkSession } from "@/db/repositories/work-repository";
import { formatDuration } from "@/lib/format";

export const timerKeys = {
  active: ["timer", "active"] as const,
  task: (id: string) => ["timer", "task", id] as const,
};

export function useActiveTimer() {
  return useServiceQuery(timerKeys.active, (s) => s.timer.active());
}

export function useTaskTime(taskId: string) {
  return useServiceQuery(timerKeys.task(taskId), (s) => s.timer.forTask(taskId));
}

/** Live elapsed time of a session, re-rendering every second while it runs. */
export function useLiveElapsed(session: WorkSession | null | undefined): number {
  const running = session?.state === "running";
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [running]);
  // Paused/stopped sessions have no open segment, so `now` only matters while running.
  return session ? sessionElapsedMs(session, now) : 0;
}

export function useTimerActions() {
  const { t } = useTranslation();
  const start = useServiceMutation((s, taskId: string) => s.timer.start(taskId));
  const pause = useServiceMutation((s) => s.timer.pause());
  const resume = useServiceMutation((s) => s.timer.resume());
  const stop = useServiceMutation(
    async (s, title: string) => ({ title, ms: await s.timer.stop() }),
    {
      onSuccess: ({ title, ms }) =>
        toast.info(t("timer.stopped", { duration: formatDuration(ms), title })),
    },
  );
  return { start, pause, resume, stop };
}

/** "05:09" or "1:05:09". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
