use serde::Serialize;
use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::State;

pub struct AgentBridgeState(pub Mutex<Option<AgentBridge>>);

pub struct AgentBridge {
    child: Child,
    port: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentBridgeStatus {
    pub running: bool,
    pub port: Option<u16>,
}

#[tauri::command]
pub fn start_agent_bridge(
    state: State<'_, AgentBridgeState>,
) -> Result<u16, String> {
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;

    // If already running, return existing port
    if let Some(ref mut bridge) = *guard {
        // Check if process is still alive
        match bridge.child.try_wait() {
            Ok(None) => return Ok(bridge.port), // Still running
            _ => {
                // Process exited, clean up
                *guard = None;
            }
        }
    }

    // Find the agent-bridge script
    // In dev: relative to the project root
    // In production: bundled alongside the app
    let script_path = find_agent_bridge_script()?;

    let mut child = Command::new("node")
        .arg(&script_path)
        .stdin(Stdio::piped()) // Keep stdin open for orphan detection
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn agent-bridge: {}. Is Node.js installed?", e))?;

    // Read the port from stdout (first line)
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture agent-bridge stdout")?;
    let mut reader = std::io::BufReader::new(stdout);
    let mut port_line = String::new();
    reader
        .read_line(&mut port_line)
        .map_err(|e| format!("Failed to read port from agent-bridge: {}", e))?;

    let port: u16 = port_line
        .trim()
        .parse()
        .map_err(|e| format!("Invalid port from agent-bridge: '{}' ({})", port_line.trim(), e))?;

    *guard = Some(AgentBridge { child, port });

    Ok(port)
}

#[tauri::command]
pub fn stop_agent_bridge(state: State<'_, AgentBridgeState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(mut bridge) = guard.take() {
        let _ = bridge.child.kill();
        let _ = bridge.child.wait();
    }

    Ok(())
}

#[tauri::command]
pub fn get_agent_bridge_status(
    state: State<'_, AgentBridgeState>,
) -> Result<AgentBridgeStatus, String> {
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(ref mut bridge) = *guard {
        match bridge.child.try_wait() {
            Ok(None) => Ok(AgentBridgeStatus {
                running: true,
                port: Some(bridge.port),
            }),
            _ => {
                *guard = None;
                Ok(AgentBridgeStatus {
                    running: false,
                    port: None,
                })
            }
        }
    } else {
        Ok(AgentBridgeStatus {
            running: false,
            port: None,
        })
    }
}

fn find_agent_bridge_script() -> Result<String, String> {
    // Try multiple locations:
    // 1. Development: relative to the Tauri app
    // 2. Alongside the executable (production bundle)

    let candidates = vec![
        // Dev mode: monorepo structure
        std::env::current_dir()
            .ok()
            .map(|d| d.join("../agent-bridge/dist/index.js")),
        // Also try from the workspace root
        std::env::current_dir()
            .ok()
            .map(|d| d.join("apps/agent-bridge/dist/index.js")),
        // From the Tauri source dir
        Some(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../agent-bridge/dist/index.js"),
        ),
    ];

    for candidate in candidates.into_iter().flatten() {
        if let Ok(canonical) = candidate.canonicalize() {
            return Ok(canonical.to_string_lossy().to_string());
        }
    }

    Err("Could not find agent-bridge script. Run 'bun run build' in apps/agent-bridge first.".to_string())
}
