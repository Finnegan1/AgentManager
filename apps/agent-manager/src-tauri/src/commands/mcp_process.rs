use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

fn status_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".agent-manager")
        .join("status.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConnectionStatus {
    pub connected: bool,
    pub tool_count: u32,
    pub resource_count: u32,
    pub prompt_count: u32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub started_at: Option<String>,
    pub servers: BTreeMap<String, ServerConnectionStatus>,
}

#[tauri::command]
pub fn get_gateway_status() -> Result<GatewayStatus, String> {
    let path = status_path();

    if !path.exists() {
        return Ok(GatewayStatus {
            running: false,
            pid: None,
            started_at: None,
            servers: BTreeMap::new(),
        });
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read status file: {}", e))?;

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RawStatus {
        pid: u32,
        started_at: String,
        servers: BTreeMap<String, ServerConnectionStatus>,
    }

    let raw: RawStatus = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse status file: {}", e))?;

    // Check if the process is actually running
    let running = is_process_running(raw.pid);

    if !running {
        // Clean up stale status file
        let _ = fs::remove_file(&path);
    }

    Ok(GatewayStatus {
        running,
        pid: if running { Some(raw.pid) } else { None },
        started_at: if running { Some(raw.started_at) } else { None },
        servers: if running { raw.servers } else { BTreeMap::new() },
    })
}

fn is_process_running(pid: u32) -> bool {
    // On Unix, sending signal 0 checks if process exists
    #[cfg(unix)]
    {
        use std::process::Command;
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(unix))]
    {
        // On Windows, use tasklist
        use std::process::Command;
        Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid)])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
            .unwrap_or(false)
    }
}
