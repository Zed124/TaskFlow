# TaskFlow — Development Roadmap

Each phase ends with: typecheck, lint, and tests green; a `tauri build` at the milestones marked 🏁; a Git commit or commits; and a short "how to verify" note for the owner.

## Phase 0 — Toolchain ✅

- [x] Node.js 26 LTS (npm 11)
- [x] Rust 1.100 stable via rustup (`x86_64-pc-windows-msvc`)
- [x] Visual Studio 2022 Build Tools: C++ workload + Windows SDK
- [x] VS Code (recommended extensions in `.vscode/extensions.json`)
- [x] WebView2 (v158, preinstalled)

## Phase 1 — Planning & architecture ✅

`AGENTS.md`, `docs/architecture.md`, `docs/database.md`, this roadmap.

## Phase 2 — Foundation 🏁 ✅

1. Scaffold Tauri 2 + React + TS + Vite. Strict `tsconfig`, ESLint (typescript-eslint, strict), Prettier, Vitest.
2. Rust DB bridge (rusqlite bundled), with Rust tests.
3. `SqlExecutor` with Tauri and `node:sqlite` adapters, the migrator, and `0001_initial.sql` with migration tests.
4. Tailwind v4 tokens (dark theme, violet accent, density) and base UI primitives: Button, Input, Dialog, Drawer, DropdownMenu, Tooltip, Badge, Kbd, EmptyState, Skeleton.
5. App shell: collapsible sidebar (full section list), router, top bar, i18n setup, and a settings store backed by the `settings` table.
6. Pages exist as routes, each with a proper "coming in Phase N" empty state so nothing pretends to work.

**Done when:** the app launches, the DB is created and migrated, the sidebar collapse persists across restarts, and a production `.msi`/`.exe` builds.

## Phase 3 — Core task management ✅

Delivered: task/project/category/activity services with transactional history; All tasks list with
filters (status, priority, project, category, due presets, text, archived) and sorting; task drawer
(inline editing, subtasks, notes, completion history, status-duration readout, activity timeline with
user notes); create-task dialog (Ctrl+N); Projects list/detail with derived progress, archive and
delete; Categories with rename/recolor/delete; Activity history feed; Ctrl+K full-text search over
tasks, projects, categories and notes. Deleting/archiving offers an immediate Restore in a toast
(the general undo stack is still Phase 7).

1. Domain: status transition rules, priority, and Zod schemas for task input and activity payloads.
2. Repositories and services: tasks, subtasks, projects, categories, activity, completions, and status intervals, all transactional.
3. Task drawer: editable fields, subtasks, notes field, activity timeline (system vs. user styling), and adding manual notes.
4. Detailed create dialog. Projects page (CRUD, archive, progress). Categories page.
5. FTS5 search and the `TaskFilter` query builder. Search UI.

**Tests:** creation and editing, status changes, complete → reopen → complete preserving both completions, subtask relations, project and category moves, search and filters.

## Phase 4 — Productivity interface 🏁 ✅

Delivered: Dashboard (greeting + summary, productivity tiles and 14-day completion chart, quick add,
Today / Overdue / Upcoming / In progress / Recently completed widgets; customize mode to reorder
by drag or arrows and show/hide, persisted in settings); My Day (overdue, due today, completed
today), Upcoming (by day, then Later), Overdue, In progress and Completed (by completion day);
Board with pointer + keyboard drag-and-drop (status change recorded in history, fractional
ordering with automatic renumbering); Calendar (month/week, week start setting, add on a day,
"No due date" panel); Timeline (five-week Gantt from creation to due/completion, due and done
markers, today line); Quick Add syntax with live token chips; command palette (navigate, create,
open project, toggle sidebar/density) merged with full-text search.

List view (sort, filter, density), smart lists (Today, Upcoming, Overdue, In Progress, Completed), Kanban (dnd-kit, persisted status + order, activity event), Calendar (month/week, unscheduled tray), Timeline (chronological by due date and history, undated section), Quick Add (inline + dialog), Command palette (`Ctrl+K`), and the Dashboard with configurable and reorderable widgets.

## Phase 5 — Time tracking & analytics ✅

Delivered: manual work timer (start / pause / resume / stop as sessions made of segments, one
active timer at a time, survives restarts, auto-stops when its task is completed, cancelled or
deleted, logs `work_session_logged`); timer controls and session list in the task drawer next to
the separate status-duration readout; live timer pill in the top bar; Analytics page (7 d / 30 d /
90 d / 12 m, daily / weekly / monthly): completed vs created trend, tracked-work trend, priority
mix, project table, KPIs with medians and sample sizes; status duration and tracked work are
reported separately and explained on the page. Charts use a validated categorical palette, a
legend, tooltips and a table view.

Status-duration reporting from intervals. Timer service (start/pause/resume/stop, survives restarts). Timer UI in the drawer, top bar, and tray. Analytics page (Recharts): daily/weekly/monthly completions, average lead time, priority and project distribution, trends, and status duration vs. tracked time shown separately.

## Phase 6 — Windows integration 🏁

Close-to-tray, tray menu, single instance, quit flow with flush, autostart (`--minimized`), notifications (due soon, overdue, reminder) with per-type settings and dedupe, and a window-state restore. Manual test checklist.

## Phase 7 — Backups & customization

JSON export, validated restore with preview and safety backup, scheduled auto-backup with retention, CSV export, the undo stack (`Ctrl+Z` + toasts), archiving completed tasks and projects, the full Settings page (accent, density, sidebar, dashboard, notifications, tray, startup, backup), and first-launch onboarding.

## Phase 8 — Testing, polish, release 🏁

Full regression pass. Performance with 10k+ seeded tasks (virtualized lists, query plans checked with `EXPLAIN QUERY PLAN`). Accessibility pass (focus rings, keyboard paths, ARIA). Optional WebdriverIO + `tauri-driver` E2E. App icon, version metadata, and the NSIS installer.

## Explicitly out of scope (v1)

Cloud sync and accounts, recurring tasks, an embedded AI assistant, a global Windows hotkey, multi-user and enterprise features.
