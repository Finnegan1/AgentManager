mod commands;

use commands::config::{get_config, save_config};
use commands::mcp_process::get_gateway_status;
use commands::skills::{delete_skill, get_skill, list_skills, save_skill};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_skills,
            get_skill,
            save_skill,
            delete_skill,
            get_gateway_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
