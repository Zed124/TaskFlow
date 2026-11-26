import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "neutral" | "error";
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** In-memory notification queue for in-app toasts (not Windows notifications). */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    const ttl = toast.action ? 8000 : toast.tone === "error" ? 7000 : 4000;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ttl);
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Callable from anywhere (hooks, mutation callbacks). */
export const toast = {
  info: (message: string, action?: Toast["action"]) =>
    useToastStore.getState().show({ message, tone: "neutral", ...(action ? { action } : {}) }),
  error: (message: string) => useToastStore.getState().show({ message, tone: "error" }),
};
