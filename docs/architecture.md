# TaskFlow — Architecture

Status: **Proposed (Phase 1)**. Changes to this document that alter layering or persistence need the owner's sign-off.

## 1. Overview

TaskFlow is a local-first Windows desktop app. A Tauri 2 shell hosts a React + TypeScript UI in WebView2. All business logic runs in TypeScript. Rust is kept to a thin layer for native work: the SQLite connection, the tray, window lifecycle, autostart, notifications, and the file system.

```
┌──────────────────────────── WebView2 (TypeScript) ────────────────────────────┐
│  UI (pages, components)  ──►  hooks (TanStack Query)  ──►  feature services   │
│                                                             │        │        │
│                                     domain (pure rules) ◄───┘        ▼        │
│                                                              repositories     │
│                                                                    │          │
│                                                        SqlExecutor interface  │
└────────────────────────────────────────────────────────────────────┼──────────┘
                                         Tauri IPC (invoke)          │
┌──────────────────────────── Rust (src-tauri) ──────────────────────▼──────────┐
│  db bridge (rusqlite, 1 connection, WAL)   tray   window lifecycle            │
│  plugins: notification · autostart · dialog · fs · single-instance · window-state │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 2. Layers and rules

| Layer        | Folder                                                   | Responsibility                                                                               | May depend on        |
| ------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------- |
| UI           | `src/app`, `src/components`, `src/features/*/components` | Rendering, user interaction, local UI state                                                  | hooks, domain types  |
| Hooks        | `src/features/*/hooks`                                   | TanStack Query queries/mutations, cache invalidation                                         | services             |
| Services     | `src/features/*/service.ts`                              | Use cases ("complete task", "move to project"): validation, transactions, activity recording | repositories, domain |
| Domain       | `src/domain`                                             | Pure types, Zod schemas, rules (status transitions, duration math). No I/O.                  | nothing              |
| Repositories | `src/db/repositories`                                    | SQL for one aggregate. No business rules.                                                    | `SqlExecutor`        |
| DB core      | `src/db`                                                 | `SqlExecutor` interface, adapters, migrator, migrations                                      | —                    |
| Platform     | `src/platform`                                           | Typed wrappers over Tauri APIs (tray, notifications, autostart, dialogs, fs). Mockable.      | Tauri JS APIs        |

Hard rules:

- UI never writes SQL or calls repositories directly. Every write goes through a service.
- Every multi-statement write runs in **one transaction**, and that includes the activity events it produces. History is written atomically with the change it describes.
- Domain code is pure, so it can be unit-tested without a database.

## 3. Database access: a deliberate deviation

**Recommendation: a small custom Rust bridge over `rusqlite` (bundled SQLite), not `tauri-plugin-sql`.**

The reasons:

1. **Transactions.** `tauri-plugin-sql` runs on an sqlx connection _pool_. When `BEGIN`, the writes, and `COMMIT` go out as separate IPC calls, they can land on different connections, so multi-step transactions from JS are unreliable. Atomic history recording is central to this app, so this matters.
2. **Testability.** Business logic lives in TypeScript and has to be tested against real SQLite. The services talk to an interface, so the same logic and the same migration files run under Vitest on Node's built-in `node:sqlite`, and in the app on rusqlite.
3. **FTS5.** Bundled SQLite includes FTS5 for fast global search, with no dependency on the system SQLite.

```ts
// src/db/executor.ts (shape, not final code)
interface SqlExecutor {
  execute(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  select<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
```

- **App adapter:** Tauri commands `db_execute`, `db_select`, `db_begin`, `db_commit`, `db_rollback` run against a single `Mutex<Connection>`. On the TS side, an async mutex serializes transactions, so only one runs at a time. A single-user desktop app needs no more concurrency than that.
- **Test adapter:** wraps `node:sqlite` `DatabaseSync`.
- **Connection pragmas:** `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`.
- **DB location:** `%APPDATA%\com.taskflow.app\taskflow.db`, resolved by Tauri's `app_data_dir`.

The cost is roughly 150 lines of Rust that we own. For you, `rusqlite` will feel much like ADO.NET with `SqliteConnection`, and `SqlExecutor` like a minimal Dapper.

## 4. Migrations

- These are plain `.sql` files in `src/db/migrations/NNNN_name.sql`. Vite bundles them with `import.meta.glob('./migrations/*.sql', { query: '?raw' })`.
- A TS migrator records applied versions in `schema_migrations` and applies each pending file in its own transaction at startup, before any UI query runs.
- Migrations are **forward-only** and must never be edited after they are committed. A fix is always a new migration.
- Each migration is tested by migrating an empty DB to head, and by migrating a fixture DB from the previous version.
- Before it applies migrations to a non-empty DB, the app takes an automatic file copy (`taskflow.db.pre-NNNN.bak`).

## 5. Identity, time and dates

| Concern                     | Decision                                                         | Why                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| IDs                         | UUIDv7 strings (`uuid` package)                                  | Unique across devices for future sync. Time-ordered, so they index well.                                                  |
| Instants                    | UTC ISO-8601 with milliseconds, `2026-11-26T14:03:22.118Z`, TEXT | Human-readable, sorts lexicographically in chronological order, JSON-friendly. Produced _only_ by `lib/time.ts#nowIso()`. |
| Date-only values (due date) | `YYYY-MM-DD` TEXT, a local calendar date                         | A due date is a calendar day, not an instant, so it must not shift when the time zone changes.                            |
| Optional due time           | `HH:mm` TEXT, local                                              | Only allowed together with a due date.                                                                                    |
| Reminder                    | `remind_at` as a UTC instant                                     | Notifications fire at an absolute moment.                                                                                 |
| Analytics day buckets       | `completed_on` (local date) stored when the completion happens   | "Completed on Tuesday" stays true even if you later travel or change the time zone.                                       |

Durations are computed from interval rows, never from a single "started at" field.

## 6. Sync-readiness, without sync

The schema leaves room for sync, but no sync is built:

- Every syncable row has a UUID `id`, plus `created_at`, `updated_at`, and `deleted_at`. Deletes are soft (tombstones).
- History tables are append-only.
- There is no auto-increment identity in domain tables.
- Settings separate device-local keys (window state, backup folder) from portable keys (accent color, dashboard layout).

## 7. State management (frontend)

- **TanStack Query** caches DB reads. Mutations invalidate by key (`['tasks', ...]`, `['task', id]`, `['activity', taskId]`). This is the main data layer for the UI.
- **Zustand** holds ephemeral UI state: sidebar collapsed, drawer open, command palette, the undo stack.
- **React Router** (memory or hash routing) handles pages. The task drawer is controlled by a `?task=<id>` search param, so it opens over any page without navigating away.

## 8. Undo

- Undo is an in-memory, per-session stack of **compensating commands**. Each undoable service call returns an inverse (for example, `moveTask(id, from→to)` returns `moveTask(id, to→from)`).
- History stays append-only. Undoing a status change records a _new_ status-change event with `payload.undo = true`, and completion records are never deleted. The undone action's effect is reversed, but the fact that it happened stays on record.
- Delete is a soft delete, so undoing a delete is a restore.
- After a destructive or batch action, a toast offers "Undo" for about 8 seconds. `Ctrl+Z` also triggers undo when focus is not in a text field.

## 9. Search

- An FTS5 virtual table `search_index` covers task titles and descriptions, project names and descriptions, category names, and activity note bodies. Triggers keep it in sync, so it cannot drift from the source tables.
- Queries use prefix matching (`term*`), are ranked with `bm25`, and are debounced at 120 ms.
- Structured filters (status, priority, project, category, due range, completion) are plain indexed SQL `WHERE` clauses. A typed `TaskFilter` object builds them.

## 10. Windows integration (Rust side)

| Feature         | Implementation                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Close to tray   | Intercept `WindowEvent::CloseRequested`. If the setting is on, call `prevent_close()` and `hide()`. The webview stays alive, so timers and schedulers keep running.                                                                                                                               |
| Tray            | Tauri 2 core `TrayIconBuilder` with Open, Quick Add, Pause/Resume timer, and Quit. Left-click restores the window.                                                                                                                                                                                |
| Quit            | The tray "Quit" item, or Close with the setting off. Rust first emits `app://before-quit`. The frontend flushes pending edits and acknowledges, then the app exits. A running timer needs no action because it is stored as an open segment in the DB.                                            |
| Single instance | `tauri-plugin-single-instance`. Launching a second instance focuses the existing window.                                                                                                                                                                                                          |
| Autostart       | `tauri-plugin-autostart` (HKCU Run key) with a `--minimized` arg, so a Windows-startup launch goes straight to the tray.                                                                                                                                                                          |
| Notifications   | `tauri-plugin-notification` (Windows toast). A TS scheduler ticks every 60 s while the app is alive, and `notification_log` dedupe keys prevent repeats across restarts. Note: in `tauri dev`, toasts appear under PowerShell's identity. The real app identity only shows in an installed build. |
| Window state    | `tauri-plugin-window-state` restores size and position.                                                                                                                                                                                                                                           |
| Files           | `tauri-plugin-dialog` for pickers, `tauri-plugin-fs` scoped to the backup directory and export targets.                                                                                                                                                                                           |

## 11. Backups

- **One format:** a versioned JSON document `{ format: "taskflow-backup", formatVersion, schemaVersion, exportedAt, data: {...all tables} }`.
- **Manual export/restore** and **automatic scheduled backups** both use this format, so any backup can be restored the same way.
- **Restore flow:**
  1. Zod validates the structure and checks referential integrity in memory.
  2. A preview shows the counts.
  3. You confirm explicitly.
  4. A safety backup of the current DB is written automatically.
  5. The restore runs in one transaction.
- **Automatic backups:** the interval (default daily), the folder (default `Documents\TaskFlow Backups`), and retention (default 14 files) are configurable. Each run is logged in `backup_runs`.
- **CSV export** covers tasks only (flat columns, UTF-8 with BOM so Excel opens it correctly).

## 12. UI system

- Tailwind CSS v4 with design tokens as CSS variables (`--color-bg`, `--color-surface`, `--color-border`, `--color-accent-*`). Accent switching changes only the variables.
- Accessible primitives come from **Radix UI** (Dialog, DropdownMenu, Popover, Tooltip, Select, Tabs), styled in-house (the shadcn/ui approach: copy-in components, no runtime theme library).
- `cmdk` for the command palette, `@dnd-kit` for Kanban drag-and-drop, Recharts for charts, Lucide for icons, `date-fns` for dates.
- Density modes (`comfortable`/`compact`) come from a root `data-density` attribute that switches spacing tokens.
- Text goes through `i18next`. All strings live in `src/i18n/en/*.json`. Layout uses logical CSS properties (`ps-*`, `me-*`), so RTL can be added later.

## 13. Testing strategy

| Level                            | Tooling                                                                                                                | Covers                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Domain unit                      | Vitest                                                                                                                 | Status transitions, duration math, date helpers, filter builders                                                                     |
| Service + repository integration | Vitest + `node:sqlite` adapter + real migrations                                                                       | Task CRUD, history, completion/reopen, subtasks, projects/categories, time tracking, search, backup round-trip, migrations, settings |
| Component                        | Vitest + Testing Library (jsdom)                                                                                       | Drawer editing, Quick Add, palette, Kanban move handlers                                                                             |
| Rust                             | `cargo test`                                                                                                           | DB bridge (transactions, errors), settings plumbing                                                                                  |
| Windows features                 | Scripted manual checklist (`docs/manual-test-checklist.md`), plus optional WebdriverIO + `tauri-driver` E2E in Phase 8 | Tray, close-to-tray, autostart registry entry, toasts, single instance                                                               |

Gate per significant change: `npm run typecheck && npm run lint && npm test && npm run tauri build` (the build runs at milestones).
