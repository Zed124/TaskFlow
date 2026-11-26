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

## Core task management (Phase 3)

| #   | Step                                                                                    | Expected                                                                                                         |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| T1  | `Ctrl+N`, type a title, `Ctrl+Enter`                                                    | The task is created and its drawer opens.                                                                        |
| T2  | In the drawer, change status, priority, due date (and time), project and category       | Each change saves immediately and adds one line to Activity.                                                     |
| T3  | Edit the description, then click elsewhere                                              | It saves once, on blur, as one "changed the description" event. `Esc` while editing reverts.                     |
| T4  | Add two subtasks (Enter after each), complete one                                       | The progress bar shows 1 of 2. The parent row in All tasks shows `1/2`.                                          |
| T5  | Complete the task, set it back to To do, complete it again                              | Completion history lists two entries: the older one marked "reopened", the newer one marked "current".           |
| T6  | Set the task to In progress and wait                                                    | "Time in progress" grows and says "still in progress". Tracked work says the timer arrives in Phase 5.           |
| T7  | Add a note to the timeline, then edit it                                                | The note appears as a card, distinct from system lines, and shows "edited" after the change.                     |
| T8  | `Ctrl+K`, type part of a word that appears only in a note                               | The note is found and highlighted. Choosing it opens its task.                                                   |
| T9  | All tasks: combine Status, Priority and Due filters, plus text                          | The list and count update. "Clear filters" resets everything except sort and archived.                           |
| T10 | Drawer menu → Delete, then confirm                                                      | The task disappears and a toast offers Restore. Restoring brings it back with its subtasks.                      |
| T11 | Projects: create a project, open it, add a task, then archive and delete the project    | Progress updates. After the delete, the task still exists without a project, and its history says so.            |
| T12 | Categories: create one, try a duplicate name in different case, rename, recolor, delete | The duplicate is refused with a message. After the delete, tasks lose the category and their history records it. |
| T13 | Activity history: switch between Everything, Changes and Notes, then Load more          | The feed is grouped by day and newest first. Subjects open the task or project.                                  |

Last run: 2026-11-26 by Claude in `tauri dev`. T1–T8 passed, and the DB was inspected afterwards (3 completion records with the reopen preserved, user note stored as `source='user'`). T9–T13 have only been checked by the automated service tests, not by hand. The UI walk-through stopped because the owner was using the machine.

## Windows integration (Phase 6)

Covers tray, close-to-tray, single instance, autostart, and notifications. To be written with the feature.
