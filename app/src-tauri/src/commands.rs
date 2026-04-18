use crate::db::{DbError, DbState, DbStatus};
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn open_db(path: String, state: State<DbState>) -> Result<DbStatus, DbError> {
    let p = PathBuf::from(&path);
    state.open(p)?;
    Ok(DbStatus {
        open: true,
        path: Some(path),
    })
}

#[tauri::command]
pub fn db_status(state: State<DbState>) -> DbStatus {
    let p = state.path();
    DbStatus {
        open: p.is_some(),
        path: p.map(|pp| pp.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub fn log_answer_event(event: Value, state: State<DbState>) -> Result<(), DbError> {
    state.insert_answer_event(&event)
}

#[tauri::command]
pub fn create_user(profile: Value, state: State<DbState>) -> Result<(), DbError> {
    state.insert_user_profile(&profile)
}

#[tauri::command]
pub fn list_users(state: State<DbState>) -> Result<Vec<Value>, DbError> {
    state.query_all_users()
}

#[tauri::command]
pub fn get_answer_history(
    username: String,
    since: Option<String>,
    state: State<DbState>,
) -> Result<Vec<Value>, DbError> {
    state.query_events_for_user(&username, since.as_deref())
}

#[tauri::command]
pub fn checkpoint_db(state: State<DbState>) -> Result<(), DbError> {
    state.checkpoint()
}
