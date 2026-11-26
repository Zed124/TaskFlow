# Manual test checklist

These are behaviours that automated tests cannot cover (the real WebView2 window and Windows integration). Run the relevant section on a **release build** (`npm run tauri build`, then start `src-tauri\target\release\taskflow.exe`) before closing a milestone, and record the date and result.

## Foundation (Phase 2)

| #   | Step                                                                                          | Expected                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| F1  | Delete `%APPDATA%\com.taskflow.app\` (or use a fresh profile) and start the app               | "Opening your workspace" shows briefly, then the Dashboard placeholder. `taskflow.db` exists with `schema_migrations` v1. |
| F2  | Press `Ctrl+B`                                                                                | The sidebar collapses to icons. Hovering an icon shows its label in a tooltip.                                            |
| F3  | Close and restart the app                                                                     | The sidebar is still collapsed.                                                                                           |
| F4  | Settings → pick an accent, switch density to Compact                                          | The accent changes immediately (app mark, active rail, focus ring). The page padding tightens.                            |
| F5  | Restart the app                                                                               | The accent and density persist, with no flash of violet on startup.                                                       |
| F6  | Settings → Theme: try Light, Midnight, Dusk and Paper                                         | The whole app and the window title bar switch at once. Date and time pickers, scrollbars and dialogs match the theme.     |
| F7  | Pick Paper (or Light), quit from the tray and start again                                     | The window opens in that theme straight away, with no dark flash before the app appears.                                  |
| F8  | Pick System, then switch Windows between light and dark (Settings → Personalization → Colors) | TaskFlow follows within a second, title bar included, without a restart.                                                  |
| F6  | Click through every sidebar item                                                              | Each unbuilt page shows "_X_ isn't built yet" with its planned phase. None shows fake data.                               |
| F7  | Press `Tab` through the sidebar and Settings                                                  | A visible focus ring is on every control. Space or Enter toggles switches and selects swatches.                           |
| F8  | Run `npm run dev` alone and open http://localhost:1420 in a browser                           | The app shows the "running in a browser tab" error rather than crashing.                                                  |

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

## Time tracking & analytics (Phase 5)

| #   | Step                                                  | Expected                                                                                                                                                       |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Drawer → Start timer, wait, Pause, wait, Resume, Stop | The live clock counts only while running. A toast shows the logged time. Work sessions lists one session with 2 stretches. Activity shows "tracked … of work". |
| A2  | Start a timer on task A, then start one on task B     | A's session stops (history: "timer moved to another task"). The top-bar pill shows B.                                                                          |
| A3  | With a timer running, complete or delete the task     | The timer stops and the session is logged.                                                                                                                     |
| A4  | With a timer running, quit and restart the app        | The pill is still running, and the elapsed time includes the time the app was closed.                                                                          |
| A5  | Analytics: switch periods and grouping                | KPIs, trend and tracked-work charts update. Empty periods show as zero, and "Show as table" lists the values.                                                  |
| A6  | Compare "Median time in progress" with "Tracked work" | They are separate cards with different explanations, never summed.                                                                                             |

Last run: 2026-11-26 by Claude via `scripts/drive-webview.mjs`. A1 passed (DB: 1 session, 2 segments, 20.7 s, plus the history event). A5 passed for 30 days, daily. A2–A4 were checked only by the automated timer tests, not by hand.

## Backups, undo, archiving, onboarding (Phase 7)

| #   | Step                                                                             | Expected                                                                                                                                            |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Settings → Back up now                                                           | A file `taskflow-backup-auto-…json` appears in the backup folder, and "Last automatic backup" shows the time and size.                              |
| B2  | Settings → Export backup… → save anywhere                                        | The file is saved, and the toast shows its size.                                                                                                    |
| B3  | Settings → Restore from backup… → pick a non-backup .json                        | "This backup can't be restored", with the reason. Nothing changes.                                                                                  |
| B4  | Restore from backup… → pick a real backup → review the preview → Replace my data | A `taskflow-backup-pre-restore-…json` is saved first, then the data matches the backup. Search, history and timers all work.                        |
| B5  | Change the backup folder, then Back up now                                       | The file goes to the new folder. "Use default" switches back.                                                                                       |
| B6  | Keep = 3, then Back up now five times                                            | Only the 3 newest `auto` files remain. Manual and pre-restore files stay.                                                                           |
| B7  | Export tasks to CSV…, then open it in Excel                                      | Accented and Arabic text displays correctly. A title like `=1+1` shows as text, not a formula.                                                      |
| U1  | Complete a task from a list → Undo in the toast                                  | The task is reopened. History shows "reopened … (undo)".                                                                                            |
| U2  | Delete a task → Undo                                                             | It's back with its subtasks.                                                                                                                        |
| U3  | Drag a board card to another column → Undo                                       | The card returns to its column and position.                                                                                                        |
| U4  | Edit a title in the drawer, click away, then press Ctrl+Z outside a text field   | The old title returns. Ctrl+Z inside a text field still does normal text undo.                                                                      |
| R1  | Completed → Archive completed… → All → Undo                                      | The tasks disappear from lists, then return.                                                                                                        |
| O1  | Fresh profile (delete `%APPDATA%\com.taskflow.app`) → launch                     | The welcome dialog appears, with example tasks on by default. "Get started" creates the "Getting started" project. The dialog doesn't appear again. |

Last run: 2026-11-26 by Claude via `scripts/drive-webview.mjs`. B1 passed (file validated: all 9 tables). U1 passed, via both the toast and Ctrl+Z, with history showing `undo: true`. R1 passed. O1 was checked on the existing profile, where example tasks correctly default to off. B2–B7 involve the native file pickers and were left for hand testing. The restore logic (B4) is covered by the automated tests (round trip, replace, rollback on failure, rejected inputs).

## Release checks (Phase 8)

| #   | Step                                                                                                                                                                                         | Expected                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| R1  | Install `TaskFlow_1.1.0_x64-setup.exe` and launch it from the Start menu                                                                                                                     | Your logo appears in the Start menu, the taskbar, the tray and the sidebar. About/installer shows 1.1.0. No admin prompt.    |
| R2  | Press F5 or Ctrl+R in the installed app. Right-click empty space, then right-click inside a text field                                                                                       | Nothing reloads. There's no browser menu on empty space, and the text field offers cut/copy/paste.                           |
| R3  | Scale test: `$env:PERF_DB="$env:APPDATA\com.taskflow.perf	askflow.db"; npx vitest run src/test/perf/seed-file`, then `powershell -File scripts/dev-inspect.ps1 -Identifier com.taskflow.perf` | 10,000 tasks in a separate profile. Lists, the Board, Completed and Analytics stay responsive. Your real data isn't touched. |
| R4  | `npm run a11y` with the dev-inspect app running                                                                                                                                              | "✓ no violations" for every page.                                                                                            |

Last run: 2026-11-26 by Claude. R3 passed (measurements are in the roadmap; regression at scale covered Quick Add, the drawer, complete plus Ctrl+Z, search, board drag plus undo, and counts). R4 passed (15 pages plus the drawer, create dialog and palette). R1 and R2 need the installed build and were left for the owner.

## Windows integration (Phase 6)

Run these on the installed release build when you can: notifications are attributed to PowerShell in `tauri dev` and to TaskFlow only when installed.

| #   | Step                                                               | Expected                                                                                                                    |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| W1  | Click the window's X (close-to-tray on)                            | The window hides and the tray icon stays. Timers and reminders keep running.                                                |
| W2  | Left-click the tray icon. Then right-click → Open TaskFlow         | The window reappears at its previous size and position.                                                                     |
| W3  | Tray → New task…                                                   | The window opens with the New task dialog.                                                                                  |
| W4  | Start a timer, then open the tray menu                             | The status line reads "Tracking: … (mm:ss)". Pause/Resume and Stop control the timer. The tooltip shows the same text.      |
| W5  | Type in a task description, then Tray → Quit without clicking away | The edit is saved (it's in the task's history after restart) and the app exits.                                             |
| W6  | Settings → turn off "Keep running in the tray", then click X       | The app quits, flushing edits first, instead of hiding.                                                                     |
| W7  | Launch TaskFlow again while it is running (Start menu or exe)      | No second copy starts. The existing window comes to the front.                                                              |
| W8  | Settings → Start with Windows on, then sign out and back in        | TaskFlow starts in the tray with no window. Turning it off removes the startup entry.                                       |
| W9  | Settings → Send test notification                                  | A Windows notification appears. If it doesn't, check Focus Assist and Windows notification settings.                        |
| W10 | Create a task due in 10 minutes (reminders 15 min before)          | A reminder appears within a minute, once only, even after a restart. Once the time passes, an "Overdue" alert appears once. |
| W11 | Leave tasks due today, open the app after the summary time         | One "Today: N due today, M overdue" notification, once per day.                                                             |
| W12 | Resize and move the window, quit, relaunch                         | It reopens with the same size and position.                                                                                 |

Last run: 2026-11-26 by Claude in `tauri dev`, with no OS input simulation.

- W1 passed (WM_CLOSE to TaskFlow's own window: hidden, process alive).
- W3 and W4 passed by emitting the tray's events: dialog opened; timer running → paused → stopped.
- W6 passed (process exited after the flush).
- W7 passed (a second launch exited, and the first window became visible).
- W10 (reminder) and W11 passed: logged once in `notification_log`, and the toasts were shown.
- Not run by hand: clicking the real tray menu items, W5's edit flush, W8 (it writes the registry; left for the owner), W12.
