import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * The task drawer is driven by `?task=<id>` so it opens over whatever page is showing,
 * survives navigation within the page, and works with the browser-style back action.
 */
export function useTaskDrawer() {
  const [params, setParams] = useSearchParams();
  const taskId = params.get("task");

  const open = useCallback(
    (id: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("task", id);
        return next;
      });
    },
    [setParams],
  );

  const close = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("task");
      return next;
    });
  }, [setParams]);

  return { taskId, open, close };
}
