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

## Productivity interface (Phase 4)

| #   | Step                                                                           | Expected                                                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | My Day: Quick Add `Pay bill !urgent`                                           | Added with today's date (page default) and urgent priority. It appears under "Due today".                                                 |
| V2  | Quick Add `Book flights tomorrow 10am !high @<project>`                        | Chips show the date, 10:00, High and the project before Enter. × on a chip keeps that word as text.                                       |
| V3  | Board: drag a To do card into an empty Cancelled column, then back             | The card lands where the pointer is. Each column change adds a history event. A reorder within a column adds none.                        |
| V4  | Board: focus a card with Tab, press Space, ArrowLeft/Right, Space              | The card moves columns from the keyboard alone, and the change persists.                                                                  |
| V5  | Calendar: Month ↔ Week, Previous/Next/Today, "+" on a day                      | Tasks sit on their due day. "+N more" opens that week. "+" creates a task due that day. The "No due date" panel lists undated open tasks. |
| V6  | Settings → Week starts on Sunday                                               | The Calendar, Timeline separators and "Completed this week" all follow it.                                                                |
| V7  | Timeline: Earlier/Later/Today                                                  | Bars run from creation to the due date or completion. Diamonds mark due dates, dots mark completions, and a line marks today.             |
| V8  | `Ctrl+K`, type `go bo`, Enter. Then `Ctrl+K`, type part of a task title, Enter | The first command navigates to the Board. The second opens the task's drawer.                                                             |
| V9  | Dashboard → Customize: move a widget, hide one, Done, restart the app          | The order and visibility persist. Hidden widgets disappear outside customize mode.                                                        |
| V10 | Leave the app open across midnight (or change the system date) and refocus it  | My Day, Overdue and the dashboard roll over to the new day without a reload.                                                              |

Last run: 2026-11-26 by Claude in `tauri dev`, driven through `scripts/drive-webview.mjs` (no OS input). V1, V2, V3, V4, V5 (month view), V7, V8 and V9 passed, and the board moves were confirmed in the DB history. V6 and V10 were checked only by the automated tests (stats week start, day-keyed filters). Neither was walked through by hand.

## Windows integration (Phase 6)

Covers tray, close-to-tray, single instance, autostart, and notifications. To be written with the feature.
