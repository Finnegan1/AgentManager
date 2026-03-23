use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use super::config::get_config;

const SKILL_FILE: &str = "SKILL.md";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub tags: Vec<String>,
    pub description: String,
    pub version: String,
    pub author: String,
    pub created: String,
    pub updated: String,
    // Claude Code-specific fields (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_tools: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disable_model_invocation: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_invocable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub argument_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFileInfo {
    pub relative_path: String,
    pub is_directory: bool,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillContent {
    pub metadata: SkillMetadata,
    pub content: String,
    pub files: Vec<SkillFileInfo>,
}

fn skills_directory() -> Result<PathBuf, String> {
    let config = get_config()?;
    Ok(PathBuf::from(&config.skills.directory))
}

/// Simple YAML frontmatter parser - extracts frontmatter between --- delimiters
fn parse_frontmatter(content: &str) -> (HashMap<String, String>, String) {
    let content = content.trim();
    if !content.starts_with("---") {
        return (HashMap::new(), content.to_string());
    }

    let after_first = &content[3..];
    if let Some(end_idx) = after_first.find("\n---") {
        let frontmatter_str = &after_first[..end_idx];
        let body = &after_first[end_idx + 4..];

        let mut map = HashMap::new();
        for line in frontmatter_str.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some(colon_idx) = line.find(':') {
                let key = line[..colon_idx].trim().to_string();
                let value = line[colon_idx + 1..].trim().trim_matches('"').to_string();
                map.insert(key, value);
            }
        }

        (map, body.trim().to_string())
    } else {
        (HashMap::new(), content.to_string())
    }
}

fn parse_tags(value: &str) -> Vec<String> {
    let trimmed = value.trim();
    if trimmed.starts_with('[') && trimmed.ends_with(']') {
        let inner = &trimmed[1..trimmed.len() - 1];
        inner
            .split(',')
            .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        vec![trimmed.to_string()]
    }
}

fn parse_bool(value: &str) -> Option<bool> {
    match value.trim().to_lowercase().as_str() {
        "true" => Some(true),
        "false" => Some(false),
        _ => None,
    }
}

fn parse_skill_file(id: &str, content: &str, files: Vec<SkillFileInfo>) -> SkillContent {
    let (fm, body) = parse_frontmatter(content);

    let metadata = SkillMetadata {
        id: id.to_string(),
        name: fm.get("name").cloned().unwrap_or_else(|| id.to_string()),
        tags: fm.get("tags").map(|t| parse_tags(t)).unwrap_or_default(),
        description: fm.get("description").cloned().unwrap_or_default(),
        version: fm
            .get("version")
            .cloned()
            .unwrap_or_else(|| "1.0".to_string()),
        author: fm.get("author").cloned().unwrap_or_default(),
        created: fm.get("created").cloned().unwrap_or_default(),
        updated: fm.get("updated").cloned().unwrap_or_default(),
        // Claude Code-specific fields (kebab-case in YAML)
        allowed_tools: fm.get("allowed-tools").cloned(),
        disable_model_invocation: fm
            .get("disable-model-invocation")
            .and_then(|v| parse_bool(v)),
        user_invocable: fm.get("user-invocable").and_then(|v| parse_bool(v)),
        context: fm.get("context").cloned(),
        agent: fm.get("agent").cloned(),
        model: fm.get("model").cloned(),
        argument_hint: fm.get("argument-hint").cloned(),
    };

    SkillContent {
        metadata,
        content: body,
        files,
    }
}

/// Recursively list files in a skill directory (excluding SKILL.md)
fn list_skill_files_recursive(skill_dir: &PathBuf) -> Vec<SkillFileInfo> {
    let mut results = Vec::new();

    fn walk(dir: &PathBuf, prefix: &str, results: &mut Vec<SkillFileInfo>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                let relative_path = if prefix.is_empty() {
                    file_name.clone()
                } else {
                    format!("{}/{}", prefix, file_name)
                };

                // Skip SKILL.md at root level
                if prefix.is_empty() && file_name == SKILL_FILE {
                    continue;
                }

                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        results.push(SkillFileInfo {
                            relative_path: relative_path.clone(),
                            is_directory: true,
                            size: 0,
                        });
                        walk(&entry.path(), &relative_path, results);
                    } else {
                        results.push(SkillFileInfo {
                            relative_path,
                            is_directory: false,
                            size: metadata.len(),
                        });
                    }
                }
            }
        }
    }

    walk(skill_dir, "", &mut results);
    results
}

#[tauri::command]
pub fn list_skills() -> Result<Vec<SkillMetadata>, String> {
    let dir = skills_directory()?;

    if !dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read skills directory: {}", e))?;

    let mut skills = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Only look at directories containing SKILL.md
        if path.is_dir() {
            let skill_md = path.join(SKILL_FILE);
            if skill_md.exists() {
                let id = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                let content = fs::read_to_string(&skill_md)
                    .map_err(|e| format!("Failed to read skill file {}: {}", id, e))?;

                let skill = parse_skill_file(&id, &content, vec![]);
                skills.push(skill.metadata);
            }
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

#[tauri::command]
pub fn get_skill(name: String) -> Result<SkillContent, String> {
    let dir = skills_directory()?;
    let skill_dir = dir.join(&name);
    let skill_md = skill_dir.join(SKILL_FILE);

    if !skill_md.exists() {
        return Err(format!("Skill not found: {}", name));
    }

    let content = fs::read_to_string(&skill_md)
        .map_err(|e| format!("Failed to read skill file: {}", e))?;

    let files = list_skill_files_recursive(&skill_dir);
    Ok(parse_skill_file(&name, &content, files))
}

#[tauri::command]
pub fn save_skill(name: String, content: String) -> Result<(), String> {
    let dir = skills_directory()?;
    let skill_dir = dir.join(&name);

    if !skill_dir.exists() {
        fs::create_dir_all(&skill_dir)
            .map_err(|e| format!("Failed to create skill directory: {}", e))?;
    }

    let skill_md = skill_dir.join(SKILL_FILE);
    fs::write(&skill_md, content)
        .map_err(|e| format!("Failed to write skill file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_skill(name: String) -> Result<(), String> {
    let dir = skills_directory()?;
    let skill_dir = dir.join(&name);

    if !skill_dir.exists() {
        return Err(format!("Skill not found: {}", name));
    }

    fs::remove_dir_all(&skill_dir)
        .map_err(|e| format!("Failed to delete skill directory: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn list_skill_files(name: String) -> Result<Vec<SkillFileInfo>, String> {
    let dir = skills_directory()?;
    let skill_dir = dir.join(&name);

    if !skill_dir.exists() {
        return Err(format!("Skill not found: {}", name));
    }

    Ok(list_skill_files_recursive(&skill_dir))
}

#[tauri::command]
pub fn save_skill_file(
    name: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let dir = skills_directory()?;
    let file_path = dir.join(&name).join(&relative_path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_skill_file(name: String, relative_path: String) -> Result<(), String> {
    let dir = skills_directory()?;
    let file_path = dir.join(&name).join(&relative_path);

    if !file_path.exists() {
        return Err(format!("File not found: {}", relative_path));
    }

    if file_path.is_dir() {
        fs::remove_dir_all(&file_path)
            .map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn read_skill_file(name: String, relative_path: String) -> Result<String, String> {
    let dir = skills_directory()?;
    let file_path = dir.join(&name).join(&relative_path);

    if !file_path.exists() {
        return Err(format!("File not found: {}", relative_path));
    }

    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn create_skill_directory(name: String, relative_path: String) -> Result<(), String> {
    let dir = skills_directory()?;
    let dir_path = dir.join(&name).join(&relative_path);

    fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(())
}

/// Parse a skills.sh install command and extract owner, repo, and skill name.
/// Supports: npx skills add https://github.com/{owner}/{repo} --skill {name}
fn parse_install_command(command: &str) -> Result<(String, String, String), String> {
    // Strip leading $ and whitespace
    let cleaned = command.trim().trim_start_matches('$').trim();

    // Find GitHub URL: https://github.com/{owner}/{repo}
    let github_prefix = "github.com/";
    let github_pos = cleaned
        .find(github_prefix)
        .ok_or("Invalid install command: no GitHub URL found")?;
    let after_github = &cleaned[github_pos + github_prefix.len()..];

    // Extract owner/repo (terminated by whitespace)
    let path_end = after_github.find(char::is_whitespace).unwrap_or(after_github.len());
    let path_part = &after_github[..path_end];
    let parts: Vec<&str> = path_part.split('/').collect();
    if parts.len() < 2 {
        return Err("Invalid GitHub URL: expected github.com/{owner}/{repo}".to_string());
    }
    let owner = parts[0].to_string();
    let repo = parts[1].to_string();

    // Find --skill or -s flag
    let skill_name = if let Some(idx) = cleaned.find("--skill") {
        let after_flag = cleaned[idx + 7..].trim();
        after_flag
            .split_whitespace()
            .next()
            .ok_or("Missing skill name after --skill flag")?
            .to_string()
    } else if let Some(idx) = cleaned.find(" -s ") {
        let after_flag = cleaned[idx + 4..].trim();
        after_flag
            .split_whitespace()
            .next()
            .ok_or("Missing skill name after -s flag")?
            .to_string()
    } else {
        return Err("Invalid install command: no --skill flag found".to_string());
    };

    Ok((owner, repo, skill_name))
}

#[tauri::command]
pub fn install_marketplace_skill(command: String) -> Result<String, String> {
    let (owner, repo, skill_name) = parse_install_command(&command)?;
    let dir = skills_directory()?;
    let skill_dir = dir.join(&skill_name);

    if skill_dir.exists() {
        return Err(format!(
            "Skill \"{}\" already exists locally. Delete it first if you want to reinstall.",
            skill_name
        ));
    }

    // Try multiple paths and branches
    let branches = ["main", "master"];
    let path_variants = [
        format!("{}/SKILL.md", skill_name),
        format!("skills/{}/SKILL.md", skill_name),
    ];
    let mut content: Option<String> = None;

    'outer: for branch in &branches {
        for skill_path in &path_variants {
            let url = format!(
                "https://raw.githubusercontent.com/{}/{}/{}/{}",
                owner, repo, branch, skill_path
            );

            match reqwest::blocking::get(&url) {
                Ok(response) if response.status().is_success() => {
                    content = Some(
                        response
                            .text()
                            .map_err(|e| format!("Failed to read response: {}", e))?,
                    );
                    break 'outer;
                }
                Ok(response) if response.status().as_u16() == 404 => continue,
                Ok(response) => {
                    return Err(format!("GitHub returned status {}", response.status()));
                }
                Err(e) => {
                    return Err(format!("Network error: {}", e));
                }
            }
        }
    }

    let content = content.ok_or(format!(
        "Skill not found: {}/{}/{}. No SKILL.md found on main or master branch.",
        owner, repo, skill_name
    ))?;

    fs::create_dir_all(&skill_dir)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;

    fs::write(skill_dir.join(SKILL_FILE), &content)
        .map_err(|e| format!("Failed to write SKILL.md: {}", e))?;

    Ok(skill_name)
}
