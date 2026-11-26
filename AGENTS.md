# AGENTS.md — TaskFlow

Guidance for AI coding agents (Codex, Claude Code) and humans working on this repo. Keep it current: when a convention or command changes, update this file in the same commit.

## What this is
TaskFlow is a local-first personal task manager for **Windows**, built on Tauri 2 + React + TypeScript + Vite + Tailwind v4 + SQLite. It runs fully offline, with no backend server, no cloud sync, and no embedded AI.

Read before substantial work:
- `docs/architecture.md`: layers, DB bridge, lifecycle, testing strategy
- `docs/database.md`: schema, invariants, event types
- `docs/roadmap.md`: the current phase and what is in or out of scope

## Commands
> Phase 2 creates these. Until then they are planned.

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Run app (dev) | `npm run tauri dev` |
| Typecheck | `npm run typecheck` |
| Lint / format | `npm run lint` · `npm run format` |
| TS tests | `npm test` (Vitest, uses `node:sqlite`, requires Node ≥ 22.13) |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Production build | `npm run tauri build` |

Before you say a change is done: run typecheck, lint, and `npm test`. Run `cargo test` if you touched Rust, and `npm run tauri build` at milestones.

## Project layout (target)
```
src/
  app/            shell, router, providers, layout (sidebar, top bar)
  components/ui/  design-system primitives (Radix + Tailwind), no business logic
  features/<name>/ components/ hooks/ service.ts  (tasks, projects, categories,
                  activity, search, dashboard, kanban, calendar, timeline, analytics,
                  time-tracking, notifications, backup, settings, command-palette, undo, onboarding)
  domain/         pure types, Zod schemas, rules — no I/O
  db/             executor.ts, adapters/, migrator.ts, migrations/NNNN_*.sql, repositories/
  platform/       typed wrappers around Tauri APIs (mock these in tests)
  lib/            time.ts, ids.ts, small utilities
  i18n/en/        UI strings
src-tauri/        Rust: db bridge, tray, window lifecycle, plugin setup
docs/             architecture, database, roadmap, manual-test-checklist
```

## Architecture rules (non-negotiable)
1. **Flow:** UI → hooks (TanStack Query) → service → repository → `SqlExecutor`. UI never touches SQL or repositories.
2. **Every write is a service call in one transaction**, and that includes the activity events it produces.
3. **History is append-only.** Never delete or rewrite `activity_events`, `completion_events`, `status_intervals`, or work segments as part of a normal operation. Reopening a task marks the completion `reopened_at`; it does not delete it. Undo is a *compensating* action that writes new history.
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
- Service and repository tests run on the **real migrations** via the `node:sqlite` adapter. Each test gets a fresh in-memory DB.
- Each bug fix gets a regression test where practical.
- Windows-only behaviour (tray, autostart, toasts, single instance) is covered in `docs/manual-test-checklist.md`. Update it when that behaviour changes.
- Do not disable, skip, or loosen tests or lint rules to get green. Fix the cause.

## Dependencies
Approved core set: react, react-router, @tanstack/react-query, zustand, zod, date-fns, uuid, i18next, react-i18next, @radix-ui/*, cmdk, @dnd-kit/*, recharts, lucide-react, tailwindcss; Tauri plugins: notification, autostart, dialog, fs, single-instance, window-state; Rust: rusqlite (bundled), serde. Ask before adding anything else, and prefer the platform or a few lines of code over a new package.

## Git
- Small, logical commits in imperative mood (`Add completion history repository`). Commit at each meaningful milestone.
- Never commit `node_modules/`, `dist/`, `src-tauri/target/`, `*.db`, or backups.
- Ask the owner before major architectural changes or before removing existing functionality.

## Working with the owner
The owner is an experienced C#/.NET/SQL/JS developer who is new to TypeScript and Tauri. Briefly explain unfamiliar TS or Tauri concepts when they matter. After each stage, report the changed files, how to run and verify, and anything not yet verified.
