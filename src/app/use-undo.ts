import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/lib/errors";
import { useInvalidateData } from "./data";
import { toast } from "./toast-store";
import { useUndoStore, type UndoEntry } from "./undo-store";

/**
 * Records undoable actions and runs them. `record` returns the entry so callers can attach it
 * to a toast's Undo button; `undoLast` serves Ctrl+Z.
 */
export function useUndo() {
  const { t } = useTranslation();
  const invalidate = useInvalidateData();
  const push = useUndoStore((s) => s.push);
  const take = useUndoStore((s) => s.take);

  const run = useCallback(
    async (entry: UndoEntry | undefined) => {
      if (!entry) {
        toast.info(t("undo.nothing"));
        return;
      }
      try {
        await entry.undo();
        await invalidate();
        toast.info(t("undo.done", { label: entry.label }));
      } catch (error) {
        toast.error(t("undo.failed", { message: errorMessage(error) }));
      }
    },
    [invalidate, t],
  );

  const record = useCallback(
    (label: string, undo: () => Promise<unknown>) => push({ label, undo }),
    [push],
  );

  /** Toast with an Undo button bound to this specific entry. */
  const notify = useCallback(
    (message: string, entry: UndoEntry) =>
      toast.info(message, { label: t("undo.action"), run: () => void run(take(entry.id)) }),
    [run, take, t],
  );

  const undoLast = useCallback(() => run(take()), [run, take]);

  return { record, notify, undoLast };
}
