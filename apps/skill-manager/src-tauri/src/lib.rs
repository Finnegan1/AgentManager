mod commands;

use commands::agent::{
    get_agent_bridge_status, start_agent_bridge, stop_agent_bridge, AgentBridgeState,
};
use commands::config::{get_config, save_config};
use commands::mcp_process::get_gateway_status;
use commands::skills::{delete_skill, get_skill, list_skills, save_skill};
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
