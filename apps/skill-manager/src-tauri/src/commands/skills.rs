use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use super::config::get_config;

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillContent {
    pub metadata: SkillMetadata,
    pub content: String,
}

fn skills_directory() -> Result<PathBuf, String> {
    let config = get_config()?;
    Ok(PathBuf::from(&config.skills.directory))
}

/// Simple YAML frontmatter parser - extracts frontmatter between --- delimiters
fn parse_frontmatter(content: &str) -> (HashMap<String, String>, String) {
    use std::collections::HashMap;

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
            if line.is_empty() {
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
        (std::collections::HashMap::new(), content.to_string())
    }
}

fn parse_tags(value: &str) -> Vec<String> {
    // Parse simple YAML array: ["tag1", "tag2", "tag3"]
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

fn parse_skill_file(id: &str, content: &str) -> SkillContent {
    let (fm, body) = parse_frontmatter(content);

    let metadata = SkillMetadata {
        id: id.to_string(),
        name: fm.get("name").cloned().unwrap_or_else(|| id.to_string()),
        tags: fm.get("tags").map(|t| parse_tags(t)).unwrap_or_default(),
        description: fm.get("description").cloned().unwrap_or_default(),
        version: fm.get("version").cloned().unwrap_or_else(|| "1.0".to_string()),
        author: fm.get("author").cloned().unwrap_or_else(|| "Unknown".to_string()),
        created: fm.get("created").cloned().unwrap_or_default(),
        updated: fm.get("updated").cloned().unwrap_or_default(),
    };

    SkillContent {
        metadata,
        content: body,
    }
}

use std::collections::HashMap;

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

        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();

            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read skill file {}: {}", id, e))?;

            let skill = parse_skill_file(&id, &content);
            skills.push(skill.metadata);
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

#[tauri::command]
pub fn get_skill(name: String) -> Result<SkillContent, String> {
    let dir = skills_directory()?;
    let path = dir.join(format!("{}.md", name));

    if !path.exists() {
        return Err(format!("Skill not found: {}", name));
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read skill file: {}", e))?;

    Ok(parse_skill_file(&name, &content))
}

#[tauri::command]
pub fn save_skill(name: String, content: String) -> Result<(), String> {
    let dir = skills_directory()?;

    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create skills directory: {}", e))?;
    }

    let path = dir.join(format!("{}.md", name));
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write skill file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_skill(name: String) -> Result<(), String> {
    let dir = skills_directory()?;
    let path = dir.join(format!("{}.md", name));

    if !path.exists() {
        return Err(format!("Skill not found: {}", name));
    }

    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete skill file: {}", e))?;

    Ok(())
}
