use parking_lot::Mutex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum DbError {
    #[error("database is locked by another writer")]
    Locked,
    #[error("database not open")]
    NotOpen,
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Default)]
pub struct DbState {
    inner: Mutex<Option<DbInner>>,
}

struct DbInner {
    conn: Connection,
    path: PathBuf,
}

impl DbState {
    pub fn open(&self, path: PathBuf) -> Result<(), DbError> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
        let conn = Connection::open(&path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "busy_timeout", 5000i64)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS answer_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS user_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
             );",
        )?;
        *self.inner.lock() = Some(DbInner { conn, path });
        Ok(())
    }

    pub fn path(&self) -> Option<PathBuf> {
        self.inner.lock().as_ref().map(|i| i.path.clone())
    }

    fn with<R>(&self, f: impl FnOnce(&Connection) -> Result<R, DbError>) -> Result<R, DbError> {
        let guard = self.inner.lock();
        let inner = guard.as_ref().ok_or(DbError::NotOpen)?;
        f(&inner.conn)
    }

    pub fn insert_answer_event(&self, event: &serde_json::Value) -> Result<(), DbError> {
        let json = serde_json::to_string(event)?;
        self.with(|conn| {
            conn.execute(
                "INSERT INTO answer_events (data) VALUES (?1)",
                params![json],
            )?;
            Ok(())
        })
    }

    pub fn insert_user_profile(&self, profile: &serde_json::Value) -> Result<(), DbError> {
        let json = serde_json::to_string(profile)?;
        self.with(|conn| {
            conn.execute(
                "INSERT INTO user_profiles (data) VALUES (?1)",
                params![json],
            )?;
            Ok(())
        })
    }

    pub fn query_all_users(&self) -> Result<Vec<serde_json::Value>, DbError> {
        self.with(|conn| {
            let mut stmt = conn.prepare("SELECT data FROM user_profiles ORDER BY id ASC")?;
            let rows = stmt.query_map([], |row| {
                let s: String = row.get(0)?;
                Ok(s)
            })?;
            let mut out = Vec::new();
            for r in rows {
                let s = r?;
                out.push(serde_json::from_str(&s)?);
            }
            Ok(out)
        })
    }

    pub fn query_events_for_user(
        &self,
        username: &str,
        since_iso: Option<&str>,
    ) -> Result<Vec<serde_json::Value>, DbError> {
        self.with(|conn| {
            let mut stmt = conn.prepare("SELECT data FROM answer_events ORDER BY id ASC")?;
            let rows = stmt.query_map([], |row| {
                let s: String = row.get(0)?;
                Ok(s)
            })?;
            let mut out = Vec::new();
            for r in rows {
                let s = r?;
                let v: serde_json::Value = serde_json::from_str(&s)?;
                if v.get("username").and_then(|x| x.as_str()) == Some(username) {
                    if let Some(since) = since_iso {
                        if let Some(ts) = v.get("timestamp").and_then(|x| x.as_str()) {
                            if ts < since {
                                continue;
                            }
                        }
                    }
                    out.push(v);
                }
            }
            Ok(out)
        })
    }

    pub fn checkpoint(&self) -> Result<(), DbError> {
        self.with(|conn| {
            conn.pragma_update(None, "wal_checkpoint", "FULL")?;
            Ok(())
        })
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DbStatus {
    pub open: bool,
    pub path: Option<String>,
}
