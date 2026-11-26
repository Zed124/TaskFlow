import { create } from "zustand";
import type { CreateTaskInput } from "@/domain/task";

/** Ephemeral UI state shared across pages (never persisted, never holds DB data). */
interface UiState {
  createTask: { open: boolean; defaults: Partial<CreateTaskInput> };
  openCreateTask: (defaults?: Partial<CreateTaskInput>) => void;
  closeCreateTask: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  createTask: { open: false, defaults: {} },
  openCreateTask: (defaults = {}) => set({ createTask: { open: true, defaults } }),
  closeCreateTask: () => set((s) => ({ createTask: { ...s.createTask, open: false } })),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}));
