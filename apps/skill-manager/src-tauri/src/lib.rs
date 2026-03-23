mod commands;

use commands::agent::{
    get_agent_bridge_status, start_agent_bridge, stop_agent_bridge, AgentBridgeState,
};
use commands::config::{get_config, save_config};
use commands::mcp_process::get_gateway_status;
use commands::skills::{
    create_skill_directory, delete_skill, delete_skill_file, get_skill, list_skill_files,
    list_skills, read_skill_file, save_skill, save_skill_file,
};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AgentBridgeState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_skills,
            get_skill,
            save_skill,
            delete_skill,
            list_skill_files,
            read_skill_file,
            save_skill_file,
            delete_skill_file,
            create_skill_directory,
            get_gateway_status,
            start_agent_bridge,
            stop_agent_bridge,
            get_agent_bridge_status,
        ]);

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
