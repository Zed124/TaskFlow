# Manual test checklist

These are behaviours that automated tests cannot cover (the real WebView2 window and Windows integration). Run the relevant section on a **release build** (`npm run tauri build`, then start `src-tauri\target\release\taskflow.exe`) before closing a milestone, and record the date and result.

## Foundation (Phase 2)

| #   | Step                                                                            | Expected                                                                                                                  |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| F1  | Delete `%APPDATA%\com.taskflow.app\` (or use a fresh profile) and start the app | "Opening your workspace" shows briefly, then the Dashboard placeholder. `taskflow.db` exists with `schema_migrations` v1. |
| F2  | Press `Ctrl+B`                                                                  | The sidebar collapses to icons. Hovering an icon shows its label in a tooltip.                                            |
| F3  | Close and restart the app                                                       | The sidebar is still collapsed.                                                                                           |
| F4  | Settings → pick an accent, switch density to Compact                            | The accent changes immediately (app mark, active rail, focus ring). The page padding tightens.                            |
| F5  | Restart the app                                                                 | The accent and density persist, with no flash of violet on startup.                                                       |
| F6  | Click through every sidebar item                                                | Each unbuilt page shows "_X_ isn't built yet" with its planned phase. None shows fake data.                               |
| F7  | Press `Tab` through the sidebar and Settings                                    | A visible focus ring is on every control. Space or Enter toggles switches and selects swatches.                           |
| F8  | Run `npm run dev` alone and open http://localhost:1420 in a browser             | The app shows the "running in a browser tab" error rather than crashing.                                                  |

Last run: 2026-11-26 by Claude, using window screenshots, synthetic clicks and keys, and direct read-only inspection of the DB.

- F1: passed on first launch in `tauri dev` (DB created, schema v1, 18 tables, 12 triggers).
- F2–F5: passed in both `tauri dev` and the release `taskflow.exe`.
- F6: Dashboard and Settings were checked; the other pages were not clicked through.
- F8: passed.
- F7: not run yet.

## Windows integration (Phase 6)

Covers tray, close-to-tray, single instance, autostart, and notifications. To be written with the feature.
