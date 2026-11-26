# TaskFlow 1.0.0

A local-first personal task manager for Windows. Everything stays on this PC and works offline.

## Install

Run `TaskFlow_1.0.0_x64-setup.exe` (per-user install, no administrator rights needed) or the
`.msi`. Data lives in `%APPDATA%\com.taskflow.app`; backups go to `Documents\TaskFlow Backups`.

## What's in it

- **Tasks:** status, priority, due date with optional time, project, category, description, notes and subtasks. Every change is kept in a per-task history, alongside your own timeline notes.
- **Completion history:** reopening a task never erases earlier completions.
- **Views:** Dashboard (customizable), My Day, Upcoming, Overdue, In progress, Completed, All tasks (filters and sorting), Board (drag and drop), Calendar (month and week), Timeline.
- **Quick Add** (`Call dentist tomorrow 9am !high #health @Home`), **Ctrl+N** to create a task, **Ctrl+K** to search and run commands, **Ctrl+Z** to undo.
- **Projects** with progress tracking and archiving, and **categories**.
- **Time:** "time in progress" is measured automatically from status changes, and a separate manual work timer (start, pause, resume, stop) records actual effort. The two are never mixed.
- **Analytics:** trends by day, week or month, lead time, priority mix, per-project statistics, and tracked work.
- **Windows:** system tray (with timer controls), close to tray, start with Windows, notifications (due-time reminders, newly overdue tasks, daily summary), single instance, remembered window position.
- **Data safety:** automatic daily backups with retention, export and checked restore (with an automatic safety copy first), and CSV export.

## Quality

- 117 automated tests, plus 12 Rust tests:
  - task history, completions and reopening;
  - subtasks, projects and categories;
  - search and filters, and the board;
  - time tracking and analytics;
  - notifications, backup and restore, CSV export;
  - database migrations and settings.
- An optional performance check runs against 10,000 tasks with history (`npm run perf`):
  - most queries finish in under 10 ms, and the slowest analytics query in about 80 ms;
  - lists render only their visible rows, so All tasks opens in about 0.5 s;
  - the Board and Completed views open in about 0.4 s and 0.2 s.
- Accessibility: every page, the task panel, the create dialog and the command palette pass axe-core WCAG 2.1 A/AA checks with no violations (`npm run a11y`). Text contrast is at least 4.5:1 throughout.

## Known limitations

- Clicking a Windows notification doesn't open the related task (the notification plugin doesn't support click actions on Windows desktop).
- Recurring tasks, sync between devices, and languages other than English aren't included in this version. The data model and text resources are ready for them.
- The Timeline lists every task that is currently in progress. With hundreds of tasks in progress at once it becomes long, though it stays responsive.
