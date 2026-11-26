/**
 * Typed wrappers around native desktop features. Everything here is a no-op outside Tauri
 * (e.g. in unit tests), so feature code can call it unconditionally.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const inDesktop = () => isTauri();

// Event names mirror src-tauri/src/desktop.rs.
const EVENT_QUIT_REQUESTED = "app://quit-requested";
const EVENT_TRAY_NEW_TASK = "tray://new-task";
const EVENT_TRAY_TIMER = "tray://timer";

export const lifecycle = {
  setCloseToTray: async (enabled: boolean) => {
    if (inDesktop()) await invoke("set_close_to_tray", { enabled });
  },
  /** Tray timer line + tooltip. `status` null = no active timer. */
  setTrayTimer: async (status: string | null, running: boolean) => {
    if (inDesktop()) await invoke("set_tray_timer", { status, running });
  },
  /** Exit now (call only after flushing). */
  exit: async () => {
    if (inDesktop()) await invoke("app_exit");
  },
  /** Start the quit flow (Rust emits quit-requested, we flush, then exit). */
  requestQuit: async () => {
    if (inDesktop()) await invoke("app_request_quit");
  },
  onQuitRequested: (handler: () => void): Promise<UnlistenFn> =>
    inDesktop() ? listen(EVENT_QUIT_REQUESTED, handler) : Promise.resolve(() => undefined),
  onTrayNewTask: (handler: () => void): Promise<UnlistenFn> =>
    inDesktop() ? listen(EVENT_TRAY_NEW_TASK, handler) : Promise.resolve(() => undefined),
  onTrayTimer: (handler: (action: "toggle" | "stop") => void): Promise<UnlistenFn> =>
    inDesktop()
      ? listen<string>(EVENT_TRAY_TIMER, (e) => {
          if (e.payload === "toggle" || e.payload === "stop") handler(e.payload);
        })
      : Promise.resolve(() => undefined),
};

/** "Start with Windows" — the registry Run key is the source of truth, not a setting. */
export const autostart = {
  isEnabled: async (): Promise<boolean> => (inDesktop() ? isEnabled() : false),
  set: async (on: boolean): Promise<void> => {
    if (!inDesktop()) return;
    if (on) await enable();
    else await disable();
  },
};

export const notifications = {
  async ensurePermission(): Promise<boolean> {
    if (!inDesktop()) return false;
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  },
  async send(title: string, body: string): Promise<boolean> {
    if (!(await notifications.ensurePermission())) return false;
    sendNotification({ title, body });
    return true;
  },
};
