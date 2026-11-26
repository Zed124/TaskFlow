//! Thin SQLite bridge. Owns exactly one connection; the TypeScript side serializes
//! transactions with an async mutex, so `BEGIN`/`COMMIT` issued as separate IPC calls
//! are guaranteed to run on the same connection (see docs/architecture.md §3).
//!
//! This module contains no business logic: it executes parameterized SQL and converts
//! values between JSON (IPC) and SQLite.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection};
use serde::Serialize;
use serde_json::{Map, Number, Value as Json};

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("{0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("unsupported parameter at index {index}: {reason}")]
    InvalidParam { index: usize, reason: String },
    #[error("database lock poisoned")]
    Poisoned,
}

/// Serialized shape sent to the frontend: `{ code, message }`.
impl Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let code = match self {
            DbError::Sqlite(rusqlite::Error::SqliteFailure(e, _)) => match e.code {
                rusqlite::ErrorCode::ConstraintViolation => "constraint",
                rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked => "busy",
                _ => "sqlite",
            },
            DbError::Sqlite(_) => "sqlite",
            DbError::InvalidParam { .. } => "invalid_param",
            DbError::Poisoned => "internal",
        };
        let mut st = s.serialize_struct("DbError", 2)?;
        st.serialize_field("code", code)?;
        st.serialize_field("message", &self.to_string())?;
        st.end()
    }
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    pub changes: u64,
    pub last_insert_rowid: i64,
}

pub type Row = Map<String, Json>;

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self, DbError> {
        Self::configure(Connection::open(path)?)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, DbError> {
        Self::configure(Connection::open_in_memory()?)
    }

    fn configure(conn: Connection) -> Result<Self, DbError> {
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA busy_timeout = 5000;",
        )?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T, DbError>) -> Result<T, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::Poisoned)?;
        f(&conn)
    }

    pub fn execute(&self, sql: &str, params: &[Json]) -> Result<ExecResult, DbError> {
        let values = to_values(params)?;
        self.with_conn(|c| {
            let changes = c.execute(sql, params_from_iter(values.iter()))?;
            Ok(ExecResult { changes: changes as u64, last_insert_rowid: c.last_insert_rowid() })
        })
    }

    pub fn select(&self, sql: &str, params: &[Json]) -> Result<Vec<Row>, DbError> {
        let values = to_values(params)?;
        self.with_conn(|c| {
            let mut stmt = c.prepare(sql)?;
            let names: Vec<String> = stmt.column_names().map(str::to_owned).collect();
            let mut rows = stmt.query(params_from_iter(values.iter()))?;
            let mut out = Vec::new();
            while let Some(row) = rows.next()? {
                let mut obj = Map::with_capacity(names.len());
                for (i, name) in names.iter().enumerate() {
                    obj.insert(name.clone(), to_json(row.get_ref(i)?));
                }
                out.push(obj);
            }
            Ok(out)
        })
    }

    /// Runs a multi-statement script without parameters (used for migrations).
    pub fn execute_batch(&self, sql: &str) -> Result<(), DbError> {
        self.with_conn(|c| Ok(c.execute_batch(sql)?))
    }

    /// Writes a consistent, compacted copy of the database to `target` (must not exist).
    pub fn snapshot(&self, target: &Path) -> Result<(), DbError> {
        let target = target.to_string_lossy().into_owned();
        self.with_conn(|c| {
            c.execute("VACUUM INTO ?1", [target])?;
            Ok(())
        })
    }

    /// True when no transaction is open on the connection.
    #[cfg(test)]
    pub fn is_autocommit(&self) -> Result<bool, DbError> {
        self.with_conn(|c| Ok(c.is_autocommit()))
    }

    /// Rolls back a transaction left open by a previous webview session (e.g. a dev reload
    /// in the middle of a transaction). Returns whether a rollback happened.
    pub fn reset(&self) -> Result<bool, DbError> {
        self.with_conn(|c| {
            if c.is_autocommit() {
                Ok(false)
            } else {
                c.execute_batch("ROLLBACK")?;
                Ok(true)
            }
        })
    }
}

fn to_values(params: &[Json]) -> Result<Vec<Value>, DbError> {
    params
        .iter()
        .enumerate()
        .map(|(index, p)| match p {
            Json::Null => Ok(Value::Null),
            Json::Bool(b) => Ok(Value::Integer(i64::from(*b))),
            Json::Number(n) => {
                if let Some(i) = n.as_i64() {
                    Ok(Value::Integer(i))
                } else if let Some(f) = n.as_f64() {
                    Ok(Value::Real(f))
                } else {
                    Err(DbError::InvalidParam { index, reason: format!("number out of range: {n}") })
                }
            }
            Json::String(s) => Ok(Value::Text(s.clone())),
            Json::Array(_) | Json::Object(_) => Err(DbError::InvalidParam {
                index,
                reason: "arrays/objects are not bindable; serialize to a JSON string first".into(),
            }),
        })
        .collect()
}

fn to_json(v: ValueRef<'_>) -> Json {
    match v {
        ValueRef::Null => Json::Null,
        ValueRef::Integer(i) => Json::Number(i.into()),
        ValueRef::Real(f) => Number::from_f64(f).map_or(Json::Null, Json::Number),
        ValueRef::Text(t) => Json::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Json::Array(b.iter().map(|x| Json::Number((*x).into())).collect()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn db() -> Db {
        let db = Db::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE parent (id TEXT PRIMARY KEY);
             CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER, r REAL, s TEXT NOT NULL,
                             parent_id TEXT REFERENCES parent(id));",
        )
        .unwrap();
        db
    }

    #[test]
    fn round_trips_values() {
        let db = db();
        let res = db
            .execute("INSERT INTO t (id, n, r, s) VALUES (?, ?, ?, ?)", &[json!("a"), json!(42), json!(1.5), json!("hé")])
            .unwrap();
        assert_eq!(res.changes, 1);
        db.execute("INSERT INTO t (id, n, r, s) VALUES (?, ?, ?, ?)", &[json!("b"), json!(true), Json::Null, json!("x")])
            .unwrap();

        let rows = db.select("SELECT id, n, r, s FROM t ORDER BY id", &[]).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0]["n"], json!(42));
        assert_eq!(rows[0]["r"], json!(1.5));
        assert_eq!(rows[0]["s"], json!("hé"));
        assert_eq!(rows[1]["n"], json!(1));
        assert_eq!(rows[1]["r"], Json::Null);
    }

    #[test]
    fn rejects_object_params() {
        let err = db().execute("SELECT ?", &[json!({"a": 1})]).unwrap_err();
        assert!(matches!(err, DbError::InvalidParam { index: 0, .. }));
    }

    #[test]
    fn enforces_foreign_keys_and_reports_constraint_code() {
        let err = db()
            .execute("INSERT INTO t (id, s, parent_id) VALUES ('a', 'x', 'missing')", &[])
            .unwrap_err();
        let ser = serde_json::to_value(&err).unwrap();
        assert_eq!(ser["code"], json!("constraint"));
    }

    #[test]
    fn transactions_across_calls_commit_and_roll_back() {
        let db = db();
        db.execute_batch("BEGIN IMMEDIATE").unwrap();
        assert!(!db.is_autocommit().unwrap());
        db.execute("INSERT INTO t (id, s) VALUES ('a', 'x')", &[]).unwrap();
        db.execute_batch("ROLLBACK").unwrap();
        assert_eq!(db.select("SELECT * FROM t", &[]).unwrap().len(), 0);

        db.execute_batch("BEGIN IMMEDIATE").unwrap();
        db.execute("INSERT INTO t (id, s) VALUES ('a', 'x')", &[]).unwrap();
        db.execute_batch("COMMIT").unwrap();
        assert_eq!(db.select("SELECT * FROM t", &[]).unwrap().len(), 1);
    }

    #[test]
    fn reset_rolls_back_stale_transaction() {
        let db = db();
        assert!(!db.reset().unwrap());
        db.execute_batch("BEGIN").unwrap();
        db.execute("INSERT INTO t (id, s) VALUES ('a', 'x')", &[]).unwrap();
        assert!(db.reset().unwrap());
        assert!(db.is_autocommit().unwrap());
        assert_eq!(db.select("SELECT * FROM t", &[]).unwrap().len(), 0);
    }

    #[test]
    fn snapshot_writes_a_readable_copy() {
        let dir = std::env::temp_dir().join(format!("taskflow-snap-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("copy.db");
        let _ = std::fs::remove_file(&target);

        let db = db();
        db.execute("INSERT INTO t (id, s) VALUES ('a', 'x')", &[]).unwrap();
        db.snapshot(&target).unwrap();

        let copy = Db::open(&target).unwrap();
        assert_eq!(copy.select("SELECT id FROM t", &[]).unwrap().len(), 1);
        drop(copy);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn bundled_sqlite_has_fts5_and_json() {
        let db = db();
        db.execute_batch(
            "CREATE VIRTUAL TABLE f USING fts5(title, tokenize = 'unicode61 remove_diacritics 2');
             INSERT INTO f (title) VALUES ('Café planning');",
        )
        .unwrap();
        let rows = db.select("SELECT title FROM f WHERE f MATCH 'cafe*'", &[]).unwrap();
        assert_eq!(rows.len(), 1);
        let rows = db.select("SELECT json_valid('{}') AS ok", &[]).unwrap();
        assert_eq!(rows[0]["ok"], json!(1));
    }
}
