/**
 * In release builds the webview should feel like an app, not a browser:
 * - no browser reload (F5 / Ctrl+R / Ctrl+Shift+R), which would drop in-memory state such as the
 *   undo stack and any text being edited;
 * - no browser context menu (Back, Reload, …) — except in text fields, where cut/copy/paste
 *   stays available.
 * Development builds keep both for debugging.
 */
export function installReleaseGuards(): void {
  if (!import.meta.env.PROD) return;

  window.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toLowerCase();
      const reload = e.key === "F5" || (e.ctrlKey && key === "r");
      const print = e.ctrlKey && key === "p";
      if (reload || print) e.preventDefault();
    },
    { capture: true },
  );

  window.addEventListener("contextmenu", (e) => {
    const target = e.target;
    const editable =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest("input, textarea, [contenteditable='true']") !== null);
    if (!editable) e.preventDefault();
  });
}
