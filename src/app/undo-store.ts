import { create } from "zustand";

export interface UndoEntry {
  id: number;
  /** Shown as "Undone: <label>". */
  label: string;
  /** A compensating action: it writes new history rather than erasing the original change. */
  undo: () => Promise<unknown>;
}

interface UndoState {
  stack: UndoEntry[];
  push: (entry: Omit<UndoEntry, "id">) => UndoEntry;
  /** Removes and returns the entry (latest when no id is given). */
  take: (id?: number) => UndoEntry | undefined;
}

const LIMIT = 30;
let nextId = 1;

/** Session-only undo history (not persisted: undo is for "oops", not for time travel). */
export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],
  push: (entry) => {
    const full = { ...entry, id: nextId++ };
    set((s) => ({ stack: [...s.stack.slice(-(LIMIT - 1)), full] }));
    return full;
  },
  take: (id) => {
    const { stack } = get();
    const entry = id === undefined ? stack.at(-1) : stack.find((e) => e.id === id);
    if (entry) set({ stack: stack.filter((e) => e.id !== entry.id) });
    return entry;
  },
}));
