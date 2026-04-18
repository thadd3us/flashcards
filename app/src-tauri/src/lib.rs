mod commands;
mod db;

use db::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .manage(DbState::default())
        .invoke_handler(tauri::generate_handler![
            commands::open_db,
            commands::db_status,
            commands::log_answer_event,
            commands::create_user,
            commands::list_users,
            commands::get_answer_history,
            commands::checkpoint_db,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
