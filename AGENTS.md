# AGENTS.md — TaskFlow

Guidance for AI coding agents (Codex, Claude Code) and humans working on this repo. Keep it current: when a convention or command changes, update this file in the same commit.

## What this is

TaskFlow is a local-first personal task manager for **Windows**, built on Tauri 2 + React + TypeScript + Vite + Tailwind v4 + SQLite. It runs fully offline, with no backend server, no cloud sync, and no embedded AI.

Read before substantial work:

- `docs/architecture.md`: layers, DB bridge, lifecycle, testing strategy
- `docs/database.md`: schema, invariants, event types
- `docs/roadmap.md`: the current phase and what is in or out of scope

## Commands

Toolchain: Node 26 LTS, Rust stable (MSVC), VS 2022 Build Tools (C++ workload), WebView2.

| Task                     | Command                                                        |
| ------------------------ | -------------------------------------------------------------- |
| Install deps             | `npm install`                                                  |
| Run app (dev)            | `npm run tauri dev`                                            |
| Typecheck · lint · tests | `npm run check`                                                |
| Typecheck                | `npm run typecheck`                                            |
| Lint / format            | `npm run lint` · `npm run format`                              |
| TS tests                 | `npm test` (Vitest, uses `node:sqlite`, requires Node ≥ 22.13) |
| Rust tests               | `npm run test:rust`                                            |
| Production build         | `npm run tauri build` → `src-tauri/target/release/bundle/`     |

Before you say a change is done: run `npm run check`. Run `npm run test:rust` if you touched Rust, and `npm run tauri build` at milestones.

Dev database: `%APPDATA%\com.taskflow.app\taskflow.db` (dev and release builds share it). Pre-migration snapshots go to `…\snapshots\`. Running `npm run dev` alone opens a browser tab that cannot reach the DB; always use `npm run tauri dev`.

## Project layout

```
src/
  main.tsx        entry: CSS, i18n, <App/>
  app/            app.tsx, boot-gate.tsx (open DB → migrate → load settings), router.tsx,
                  navigation.ts (sidebar items + planned phase), services.ts (composition root),
                  use-services.ts, data.ts (useServiceQuery / useServiceMutation + query keys),
                  ui-store.ts + toast-store.ts (zustand), layout/ (app-shell, sidebar, top-bar), pages/
  components/ui/  design-system primitives (Radix + Tailwind), no business logic
  features/<name>/ components/, use-*.ts hooks, <name>-service.ts (+ .test.ts). Exists: settings,
                  tasks, projects, categories, activity, search (+ command palette), dashboard (stats),
                  views (smart lists, board, calendar, timeline). To come: analytics, time-tracking,
                  notifications, backup, undo, onboarding.
  domain/         pure types, Zod schemas, rules — no I/O (task, project, category, activity,
                  task-filter, smart-lists, quick-add, dashboard, durations, colors, settings)
  db/             executor.ts (SqlExecutor + Database), drivers/ (tauri, node-test), migrator.ts,
                  migrations/NNNN_name.sql, repositories/ (one per aggregate + index.ts), sql.ts
                  (updateById, toFtsQuery), client.ts (app bootstrap)
  platform/       typed wrappers around Tauri APIs (mock these in tests) — from Phase 6
  lib/            time.ts, ids.ts, errors.ts, validation.ts, format.ts, mutex.ts, cn.ts
  i18n/en/        UI strings (typed keys)
  styles/         index.css — Tailwind v4 tokens (colors, type, accent + density variables)
  test/           setup.ts, test-db.ts (fresh migrated in-memory DB)
src-tauri/src/    lib.rs (setup, command registration), db.rs (rusqlite bridge), commands.rs
scripts/          dev-inspect.ps1 + drive-webview.mjs (UI automation over DevTools)
docs/             architecture, database, roadmap, manual-test-checklist
```

Adding a page: add a `NavItem` in `app/navigation.ts`, then register its element in `app/router.tsx`. Remove `planned` once the page is real.
Adding a setting: add it to `settingDefinitions` in `domain/settings.ts` (no migration needed), then read and write it with `useSetting(key)`.
Adding a write use case: a service method that validates with Zod (`parseOrThrow`), is `async`
(validation failures must reject, not throw synchronously), runs in `write(ctx => …)` and records
activity via `record(...)`. Call it from the UI only through `useServiceMutation`, which refreshes
queries and toasts errors. New activity event types need a payload schema in `domain/activity.ts`
and a sentence in `features/activity/describe-event.ts`.
Views: every list is a `TaskFilter` (see `domain/smart-lists.ts`); add a view by adding a filter,
not a new query. Board moves go through `tasks.move` (status + position in one transaction).
Task drawer: open any task with `useTaskDrawer().open(id)` (it sets `?task=<id>`).
Adding a migration: create `src/db/migrations/NNNN_name.sql` (the next number) and extend `src/db/schema.test.ts`.
Design tokens: use `bg-canvas/surface/raised/overlay`, `text-fg/fg-muted/fg-subtle`, `border-line/line-strong`, and `accent`, `accent-soft` and `accent-text`. Never use raw hex in components (the accent swatches on the Settings page are the one documented exception).

## Architecture rules (non-negotiable)

1. **Flow:** UI → hooks (TanStack Query) → service → repository → `SqlExecutor`. UI never touches SQL or repositories.
2. **Every write is a service call in one transaction**, and that includes the activity events it produces.
3. **History is append-only.** Never delete or rewrite `activity_events`, `completion_events`, `status_intervals`, or work segments as part of a normal operation. Reopening a task marks the completion `reopened_at`; it does not delete it. Undo is a _compensating_ action that writes new history.
4. **Archive ≠ delete.** Archive sets `archived_at`. Delete is a soft delete (`deleted_at`). A hard delete happens only through an explicit purge feature.
5. **Status-duration and tracked work time are separate metrics** with separate labels. Never sum them or present them as the same thing.
6. **Migrations are forward-only.** Never edit a committed migration; add a new one with a test.
7. **The database is SQLite.** `localStorage` holds nothing beyond trivially rebuildable UI hints.
8. Keep Rust thin: native integration only. Business logic goes in TypeScript.
9. Never ship a fake feature. If something is not implemented, show an honest empty state ("Available in a later version"), never a working-looking placeholder.

## Data conventions

- IDs: UUIDv7 strings from `lib/ids.ts#newId()`.
- Instants: UTC ISO-8601 with ms (`2026-11-26T14:03:22.118Z`), only from `lib/time.ts#nowIso()`. Tests inject a clock.
- Calendar dates: `YYYY-MM-DD` local (`due_date`, `completed_on`). Never convert a due date to an instant.
- SQL: snake_case. TS: camelCase. Repositories map between them. Always use parameterized queries; never interpolate values into SQL.
- Enums are string literals that match DB CHECK constraints: `'todo' | 'in_progress' | 'completed' | 'cancelled'`, `'low' | 'medium' | 'high' | 'urgent'`.

## TypeScript & React conventions

- Run with `strict` and `noUncheckedIndexedAccess`. **No `any`.** Use `unknown` + Zod at boundaries (IPC results, backup files, settings JSON).
- Validate user input and external data with Zod schemas from `src/domain`.
- Errors: services throw typed `AppError` subclasses (`ValidationError`, `NotFoundError`, `ConflictError`). The UI shows them via toast or inline messages. Never swallow errors silently.
- File names: `kebab-case.ts`. Components: `PascalCase` exports in `kebab-case.tsx` files. Hooks: `use-*.ts`, exporting `useX`.
- Keep components small. Pull logic out into hooks or services. Avoid prop drilling deeper than about 2 levels; use context or Zustand for UI state.
- Server state comes from TanStack Query. Do not copy query results into Zustand.
- Styling uses Tailwind with design tokens (CSS variables). No hard-coded hex colors in components. Use logical properties (`ps-`, `me-`, `start-`) so RTL is possible later.
- Every user-visible string goes through i18next (`t('tasks.empty.title')`).
- Accessibility: interactive elements are real buttons or links, have visible focus, are reachable by keyboard, and icon-only buttons have `aria-label`.

## Testing

- **UI automation:** never send OS-level mouse or keyboard input; it can land in whatever window the owner is using. Start the app with `powershell -File scripts/dev-inspect.ps1` (DevTools on 127.0.0.1:9333, window doesn't take focus) and drive it with `node scripts/drive-webview.mjs 9333 steps.json` (eval, click, type, key, drag and screenshot steps, all dispatched inside the webview).

- Service and repository tests run on the **real migrations** via the `node:sqlite` adapter. Each test gets a fresh in-memory DB.
- Each bug fix gets a regression test where practical.
- Windows-only behaviour (tray, autostart, toasts, single instance) is covered in `docs/manual-test-checklist.md`. Update it when that behaviour changes.
- Do not disable, skip, or loosen tests or lint rules to get green. Fix the cause.

## Dependencies

Approved core set: react, react-router, @tanstack/react-query, zustand, zod, date-fns, uuid, i18next, react-i18next, radix-ui, clsx, tailwind-merge, cmdk, @dnd-kit/\*, recharts, lucide-react, tailwindcss; Tauri plugins: notification, autostart, dialog, fs, single-instance, window-state; Rust: rusqlite (bundled), serde. Ask before adding anything else, and prefer the platform or a few lines of code over a new package.

## Git

- Small, logical commits in imperative mood (`Add completion history repository`). Commit at each meaningful milestone.
- Never commit `node_modules/`, `dist/`, `src-tauri/target/`, `*.db`, or backups.
- Ask the owner before major architectural changes or before removing existing functionality.

## Working with the owner

The owner is an experienced C#/.NET/SQL/JS developer who is new to TypeScript and Tauri. Briefly explain unfamiliar TS or Tauri concepts when they matter. After each stage, report the changed files, how to run and verify, and anything not yet verified.
