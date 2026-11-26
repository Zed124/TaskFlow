import { useEffect, useState } from "react";

/**
 * The current time, refreshed every minute and when the window regains focus, so day-based
 * views roll over at midnight without a reload.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs]);
  return now;
}

/** Local date key (YYYY-MM-DD) that only changes when the day changes. */
export function useTodayKey(): string {
  const now = useNow();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}
