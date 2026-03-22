use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

fn config_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".skill-management")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

fn skills_dir() -> PathBuf {
    config_dir().join("skills")
}

// --- Config types mirroring shared-types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillManagementConfig {
    pub version: String,
    pub gateway: GatewayConfig,
    pub servers: HashMap<String, DownstreamServerConfig>,
    pub skills: SkillsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub auto_start: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownstreamServerConfig {
    pub name: String,
    pub enabled: bool,
    pub transport: TransportConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum TransportConfig {
    Stdio {
        command: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        args: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<HashMap<String, String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        cwd: Option<String>,
    },
    Sse {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
    },
    StreamableHttp {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
    },
}

impl Default for SkillManagementConfig {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            gateway: GatewayConfig { auto_start: false },
            servers: HashMap::new(),
            skills: SkillsConfig {
                directory: skills_dir().to_string_lossy().to_string(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsConfig {
    pub directory: String,
}

// --- Tauri Commands ---

#[tauri::command]
pub fn get_config() -> Result<SkillManagementConfig, String> {
    let path = config_path();

    // Ensure directory exists
    let dir = config_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let skills = skills_dir();
    if !skills.exists() {
        fs::create_dir_all(&skills).map_err(|e| format!("Failed to create skills directory: {}", e))?;
    }

    if !path.exists() {
        let config = SkillManagementConfig::default();
        save_config_internal(&config)?;
        return Ok(config);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    let config: SkillManagementConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;
    Ok(config)
}

#[tauri::command]
pub fn save_config(config: SkillManagementConfig) -> Result<(), String> {
    save_config_internal(&config)
}

fn save_config_internal(config: &SkillManagementConfig) -> Result<(), String> {
    let path = config_path();
    let dir = config_dir();

    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Atomic write: write to temp file, then rename
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &content)
        .map_err(|e| format!("Failed to write temp config file: {}", e))?;
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename config file: {}", e))?;

    Ok(())
}
