-- 0001_initial — TaskFlow base schema. See docs/database.md for the rationale behind each table.
-- Conventions: TEXT UUIDv7 ids; instants are UTC ISO-8601 "YYYY-MM-DDTHH:MM:SS.sssZ";
-- calendar dates are local "YYYY-MM-DD". Connection pragmas (foreign_keys, WAL) are set by the driver.
-- DO NOT EDIT after release: add a new migration instead.

CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  description  TEXT NOT NULL DEFAULT '',
  color        TEXT,
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
                       CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  priority           TEXT NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date           TEXT CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  due_time           TEXT CHECK (due_time IS NULL OR (due_date IS NOT NULL AND due_time GLOB '[0-2][0-9]:[0-5][0-9]')),
  remind_at          TEXT,
  sort_order         REAL NOT NULL DEFAULT 0,
  status_changed_at  TEXT NOT NULL,
  completed_at       TEXT,
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
  completed_on  TEXT NOT NULL CHECK (completed_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  reopened_at   TEXT,
  CHECK (reopened_at IS NULL OR reopened_at >= completed_at)
);
CREATE UNIQUE INDEX ux_completion_open ON completion_events(task_id) WHERE reopened_at IS NULL;
CREATE INDEX ix_completion_on   ON completion_events(completed_on);
CREATE INDEX ix_completion_task ON completion_events(task_id, completed_at);

CREATE TABLE status_intervals (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX ux_status_interval_open ON status_intervals(task_id) WHERE ended_at IS NULL;
CREATE INDEX ix_status_intervals_task   ON status_intervals(task_id, started_at);
CREATE INDEX ix_status_intervals_inprog ON status_intervals(started_at) WHERE status = 'in_progress';

CREATE TABLE work_sessions (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  state        TEXT NOT NULL CHECK (state IN ('running', 'paused', 'stopped')),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  duration_ms  INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  CHECK ((state = 'stopped') = (ended_at IS NOT NULL)),
  CHECK ((state = 'stopped') = (duration_ms IS NOT NULL))
);
-- At most one running/paused session in the whole database: every active row indexes the same value.
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
  event_type   TEXT NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('system', 'user')),
  body         TEXT,
  payload      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload)),
  group_id     TEXT,
  occurred_at  TEXT NOT NULL,
  edited_at    TEXT,
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
  kind        TEXT NOT NULL,
  dedupe_key  TEXT NOT NULL UNIQUE,
  sent_at     TEXT NOT NULL
);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL CHECK (json_valid(value)),
  updated_at  TEXT NOT NULL
);

CREATE TABLE backup_runs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('auto', 'manual', 'pre_restore', 'pre_migration')),
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  file_path    TEXT,
  size_bytes   INTEGER,
  error        TEXT
);
CREATE INDEX ix_backup_runs_started ON backup_runs(started_at);

-- Global search. Kept in sync by the triggers below; soft-deleted rows are removed from the index.
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type UNINDEXED,
  entity_id   UNINDEXED,
  task_id     UNINDEXED,
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER trg_tasks_search_ai AFTER INSERT ON tasks WHEN NEW.deleted_at IS NULL BEGIN
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  VALUES ('task', NEW.id, NEW.id, NEW.title, NEW.description || char(10) || NEW.notes);
END;
CREATE TRIGGER trg_tasks_search_au AFTER UPDATE OF title, description, notes, deleted_at ON tasks BEGIN
  DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = OLD.id;
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  SELECT 'task', NEW.id, NEW.id, NEW.title, NEW.description || char(10) || NEW.notes
  WHERE NEW.deleted_at IS NULL;
END;
CREATE TRIGGER trg_tasks_search_ad AFTER DELETE ON tasks BEGIN
  DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = OLD.id;
END;

CREATE TRIGGER trg_projects_search_ai AFTER INSERT ON projects WHEN NEW.deleted_at IS NULL BEGIN
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  VALUES ('project', NEW.id, NULL, NEW.name, NEW.description);
END;
CREATE TRIGGER trg_projects_search_au AFTER UPDATE OF name, description, deleted_at ON projects BEGIN
  DELETE FROM search_index WHERE entity_type = 'project' AND entity_id = OLD.id;
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  SELECT 'project', NEW.id, NULL, NEW.name, NEW.description WHERE NEW.deleted_at IS NULL;
END;
CREATE TRIGGER trg_projects_search_ad AFTER DELETE ON projects BEGIN
  DELETE FROM search_index WHERE entity_type = 'project' AND entity_id = OLD.id;
END;

CREATE TRIGGER trg_categories_search_ai AFTER INSERT ON categories WHEN NEW.deleted_at IS NULL BEGIN
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  VALUES ('category', NEW.id, NULL, NEW.name, '');
END;
CREATE TRIGGER trg_categories_search_au AFTER UPDATE OF name, deleted_at ON categories BEGIN
  DELETE FROM search_index WHERE entity_type = 'category' AND entity_id = OLD.id;
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  SELECT 'category', NEW.id, NULL, NEW.name, '' WHERE NEW.deleted_at IS NULL;
END;
CREATE TRIGGER trg_categories_search_ad AFTER DELETE ON categories BEGIN
  DELETE FROM search_index WHERE entity_type = 'category' AND entity_id = OLD.id;
END;

CREATE TRIGGER trg_notes_search_ai AFTER INSERT ON activity_events WHEN NEW.event_type = 'note' BEGIN
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  VALUES ('note', NEW.id, NEW.task_id, '', NEW.body);
END;
CREATE TRIGGER trg_notes_search_au AFTER UPDATE OF body ON activity_events WHEN NEW.event_type = 'note' BEGIN
  DELETE FROM search_index WHERE entity_type = 'note' AND entity_id = OLD.id;
  INSERT INTO search_index (entity_type, entity_id, task_id, title, body)
  VALUES ('note', NEW.id, NEW.task_id, '', NEW.body);
END;
CREATE TRIGGER trg_notes_search_ad AFTER DELETE ON activity_events WHEN OLD.event_type = 'note' BEGIN
  DELETE FROM search_index WHERE entity_type = 'note' AND entity_id = OLD.id;
END;
