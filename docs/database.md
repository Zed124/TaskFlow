# TaskFlow — Database Design

Status: **Proposed (Phase 1)**. The DDL below is the draft of `0001_initial.sql`, and it will be finalized and tested in Phase 2.

## 1. Principles

1. **Current state and history are separate.** `tasks` holds what is true _now_. `activity_events`, `completion_events`, `status_intervals` and `work_sessions` hold what _happened_. History rows are append-only: they are never updated, except to close an open interval or mark a completion as reopened.
2. **Nothing historical is destroyed by normal use.** Archive sets `archived_at`. Delete sets `deleted_at` (a soft delete, which is undoable). Only an explicit "purge" ever hard-deletes, and `ON DELETE CASCADE` then removes dependent history with it.
3. **The DB enforces invariants where it cheaply can** through CHECK constraints, foreign keys, and partial unique indexes such as "one open interval per task". Services enforce the rest inside transactions.
4. **Formats are fixed.** Instants are UTC ISO-8601 with milliseconds (`...Z`). Calendar dates are `YYYY-MM-DD`. IDs are UUIDv7 text.

## 2. Entity overview

```
projects 1───* tasks *───1 categories
                 │ 1
   tasks (parent) 1───* tasks (subtasks, one level)
                 │
     ┌───────────┼──────────────┬───────────────────┬────────────────┐
     *           *              *                   *                *
activity_events  completion_events  status_intervals  work_sessions  notification_log
                                                         │ 1
                                                         *
                                                    work_segments
settings (key/value) · backup_runs · schema_migrations · search_index (FTS5)
```

## 3. Key decisions

| #   | Decision                                                                                                                                                                 | Alternative considered          | Reason                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **A subtask is a task with `parent_id`**, one level deep (enforced in the service)                                                                                       | Separate checklist table        | Subtasks get status, priority, due date, history and time tracking for free, and every view and query works on them. One level keeps the UI simple.                                       |
| D2  | **Completions are their own table** (`completion_events`) and `tasks.completed_at` mirrors only the _current_ completion                                                 | Overwrite `completed_at`        | Complete Mon → reopen Tue → complete Thu leaves 2 rows. The Monday row gets `reopened_at` = Tue and is never deleted.                                                                     |
| D3  | **Status intervals** (`status_intervals`): a row per stay in a status, exactly one open per task                                                                         | A single `started_at` column    | Sums in-progress time correctly across multiple In Progress stretches and reopen cycles. This is a measurement of how long a task _sat in a status_, not of how much work was done on it. |
| D4  | **Manual timer = session + segments.** Pause closes a segment; Resume opens a new one; Stop closes the session                                                           | One row per start/stop          | Models Start/Pause/Resume/Stop exactly, survives app restarts (an open segment is just a row), and makes "tracked work" sum only real segments.                                           |
| D5  | **One active timer globally** (running or paused)                                                                                                                        | Concurrent timers               | Matches personal use and avoids double-counting. Enforced by a partial unique index.                                                                                                      |
| D6  | **Activity is generic but strongly keyed**: nullable `task_id`/`project_id`/`category_id` with exactly one set, `event_type`, `source` (`system`/`user`), JSON `payload` | One table per event type        | One timeline query, so the global Activity History page is trivial. FKs still cascade on purge.                                                                                           |
| D7  | `completed_on` (local date) is stored on each completion                                                                                                                 | Convert UTC→local at query time | Day/week/month analytics stay stable regardless of time-zone changes, and the SQL is simple.                                                                                              |
| D8  | **Settings are key/value with JSON values**, validated by a Zod schema in TS. Backup config lives in settings under `backup.*`, and run history in `backup_runs`         | A wide settings table           | Adding a setting needs no migration. Types are enforced in one place.                                                                                                                     |
| D9  | `sort_order REAL` (fractional ordering)                                                                                                                                  | Integer positions               | A Kanban drop updates only one row (midpoint between neighbours). Values are renormalized occasionally.                                                                                   |
| D10 | FTS5 `search_index` kept in sync by triggers                                                                                                                             | LIKE queries                    | Fast as the DB grows, and triggers guarantee consistency.                                                                                                                                 |

## 4. Draft DDL (`0001_initial.sql`)

```sql
-- Connection-level (set by the adapter, not the migration):
-- PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;

CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL
);

CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  description  TEXT NOT NULL DEFAULT '',
  color        TEXT,                       -- token name, e.g. 'violet'
  sort_order   REAL NOT NULL DEFAULT 0,
  archived_at  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX ix_projects_active ON projects(archived_at, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  color        TEXT,
  sort_order   REAL NOT NULL DEFAULT 0,
  archived_at  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE UNIQUE INDEX ux_categories_name ON categories(name COLLATE NOCASE) WHERE deleted_at IS NULL;

CREATE TABLE tasks (
  id                 TEXT PRIMARY KEY,
  parent_id          TEXT REFERENCES tasks(id)      ON DELETE CASCADE,
  project_id         TEXT REFERENCES projects(id)   ON DELETE SET NULL,
  category_id        TEXT REFERENCES categories(id) ON DELETE SET NULL,
  title              TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  description        TEXT NOT NULL DEFAULT '',
  notes              TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'todo'
                       CHECK (status IN ('todo','in_progress','completed','cancelled')),
  priority           TEXT NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low','medium','high','urgent')),
  due_date           TEXT CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  due_time           TEXT CHECK (due_time IS NULL OR (due_date IS NOT NULL AND due_time GLOB '[0-2][0-9]:[0-5][0-9]')),
  remind_at          TEXT,
  sort_order         REAL NOT NULL DEFAULT 0,
  status_changed_at  TEXT NOT NULL,
  completed_at       TEXT,                 -- mirror of the open completion_events row
  archived_at        TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT,
  CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX ix_tasks_status    ON tasks(status, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX ix_tasks_due       ON tasks(due_date)           WHERE deleted_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX ix_tasks_project   ON tasks(project_id)         WHERE deleted_at IS NULL;
CREATE INDEX ix_tasks_category  ON tasks(category_id)        WHERE deleted_at IS NULL;
CREATE INDEX ix_tasks_parent    ON tasks(parent_id);
CREATE INDEX ix_tasks_completed ON tasks(completed_at)       WHERE completed_at IS NOT NULL;
CREATE INDEX ix_tasks_remind    ON tasks(remind_at)          WHERE remind_at IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE completion_events (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_at  TEXT NOT NULL,
  completed_on  TEXT NOT NULL,             -- local calendar date at completion time
  reopened_at   TEXT,                      -- set when the task leaves 'completed'; row is kept
  CHECK (reopened_at IS NULL OR reopened_at >= completed_at)
);
CREATE UNIQUE INDEX ux_completion_open ON completion_events(task_id) WHERE reopened_at IS NULL;
CREATE INDEX ix_completion_on   ON completion_events(completed_on);
CREATE INDEX ix_completion_task ON completion_events(task_id, completed_at);

CREATE TABLE status_intervals (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('todo','in_progress','completed','cancelled')),
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX ux_status_interval_open ON status_intervals(task_id) WHERE ended_at IS NULL;
CREATE INDEX ix_status_intervals_task ON status_intervals(task_id, started_at);
CREATE INDEX ix_status_intervals_inprog ON status_intervals(started_at) WHERE status = 'in_progress';

CREATE TABLE work_sessions (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  state        TEXT NOT NULL CHECK (state IN ('running','paused','stopped')),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  duration_ms  INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),  -- sum of segments, set on stop
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  CHECK ((state = 'stopped') = (ended_at IS NOT NULL)),
  CHECK ((state = 'stopped') = (duration_ms IS NOT NULL))
);
-- At most one running/paused session in the whole DB (D5): every active row indexes the same value (0).
CREATE UNIQUE INDEX ux_work_sessions_one_active ON work_sessions((state = 'stopped')) WHERE state <> 'stopped';
CREATE INDEX ix_work_sessions_task ON work_sessions(task_id, started_at);

CREATE TABLE work_segments (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX ux_work_segment_open ON work_segments(session_id) WHERE ended_at IS NULL;
CREATE INDEX ix_work_segments_session ON work_segments(session_id, started_at);

CREATE TABLE activity_events (
  id           TEXT PRIMARY KEY,
  task_id      TEXT REFERENCES tasks(id)      ON DELETE CASCADE,
  project_id   TEXT REFERENCES projects(id)   ON DELETE CASCADE,
  category_id  TEXT REFERENCES categories(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,              -- see §5
  source       TEXT NOT NULL CHECK (source IN ('system','user')),
  body         TEXT,                       -- user-written note text
  payload      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload)),
  group_id     TEXT,                       -- events produced by one user action share this
  occurred_at  TEXT NOT NULL,
  edited_at    TEXT,                       -- user notes only
  CHECK ((task_id IS NOT NULL) + (project_id IS NOT NULL) + (category_id IS NOT NULL) = 1),
  CHECK ((source = 'user') = (event_type = 'note')),
  CHECK (event_type <> 'note' OR length(trim(coalesce(body, ''))) > 0)
);
CREATE INDEX ix_activity_task     ON activity_events(task_id, occurred_at)    WHERE task_id IS NOT NULL;
CREATE INDEX ix_activity_project  ON activity_events(project_id, occurred_at) WHERE project_id IS NOT NULL;
CREATE INDEX ix_activity_occurred ON activity_events(occurred_at);

CREATE TABLE notification_log (
  id          TEXT PRIMARY KEY,
  task_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,               -- 'due_soon' | 'overdue' | 'reminder' | ...
  dedupe_key  TEXT NOT NULL UNIQUE,        -- e.g. 'overdue:<taskId>:<due_date>'
  sent_at     TEXT NOT NULL
);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL CHECK (json_valid(value)),
  updated_at  TEXT NOT NULL
);

CREATE TABLE backup_runs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('auto','manual','pre_restore','pre_migration')),
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
  file_path    TEXT,
  size_bytes   INTEGER,
  error        TEXT
);
CREATE INDEX ix_backup_runs_started ON backup_runs(started_at);

CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type UNINDEXED,                   -- 'task' | 'project' | 'category' | 'note'
  entity_id   UNINDEXED,
  task_id     UNINDEXED,                   -- for notes: the owning task
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
-- + AFTER INSERT/UPDATE/DELETE triggers on tasks, projects, categories and
--   activity_events (event_type='note') that keep search_index in sync and drop
--   rows whose deleted_at becomes non-null.
```

## 5. Event types (initial set)

`created`, `field_changed` (payload `{field, from, to}`, one per field, grouped by `group_id`), `status_changed`, `priority_changed`, `completed`, `reopened`, `cancelled`, `project_changed`, `category_changed`, `due_changed`, `subtask_added`, `subtask_removed`, `archived`, `unarchived`, `deleted`, `restored`, `work_session_logged` (payload `{sessionId, durationMs, reason: manual|switched|task_closed|task_deleted}`), `note` (user).

Payloads are typed in `src/domain/activity.ts` with a Zod discriminated union, and every payload is validated before it is written.

## 6. Status-change transaction (example)

Calling `TaskService.setStatus(taskId, 'completed')` runs **one transaction**:

1. Load the task and assert the transition is allowed (domain rule).
2. `UPDATE status_intervals SET ended_at = :now WHERE task_id = :id AND ended_at IS NULL`.
3. `INSERT status_intervals (status='completed', started_at=:now)`.
4. `INSERT completion_events (completed_at=:now, completed_on=:localDate)`.
5. `UPDATE tasks SET status, status_changed_at, completed_at, updated_at`.
6. `INSERT activity_events (event_type='completed', payload {from:'in_progress'})`.

Reopening goes the other way: the open completion row gets `reopened_at = :now` (the row is kept), a new interval opens, `tasks.completed_at` becomes NULL, and a `reopened` event is written.

## 7. Analytics derivations

| Metric                              | Source                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completions per day/week/month      | `completion_events GROUP BY completed_on` (week/month bucketing in TS with `date-fns`, respecting the week-start setting)                                      |
| Completed count                     | `completion_events`, counting either distinct tasks or all completion events (the UI labels which)                                                             |
| Average completion time (lead time) | `completion_events.completed_at − tasks.created_at`, using only the first completion per task                                                                  |
| Time in In Progress                 | Σ `status_intervals` where status = `in_progress`, open interval measured up to now and shown as "ongoing". Labelled **"Time in progress (status duration)"**. |
| Tracked work time                   | Σ closed `work_segments` (+ the running segment shown live). Labelled **"Tracked work time"**.                                                                 |
| Distribution by priority / project  | `tasks` grouped, excluding deleted. Archived tasks are included only if you toggle them on.                                                                    |

The two duration metrics are never summed together or shown under the same label. Where a metric has incomplete data (for example, an open interval), it is marked as ongoing or partial in the UI.
