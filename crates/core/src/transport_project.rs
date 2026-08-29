//! Workspace-local persistence for Transport workflow projects.
//!
//! Projects are intentionally plain JSON under
//! `.thclaws/transport/projects/` so the GUI, agent tools, and future
//! execution engine can share one inspectable format.

use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct TransportProjectSummary {
    pub id: String,
    pub name: String,
    pub path: String,
}

fn project_root() -> Result<PathBuf, String> {
    std::env::current_dir()
        .map(|cwd| cwd.join(".thclaws").join("transport").join("projects"))
        .map_err(|e| format!("resolve workspace: {e}"))
}

fn project_id(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("project name is required".into());
    }
    let mut id = String::new();
    let mut last_dash = false;
    for ch in trimmed.chars().take(80) {
        if ch.is_alphanumeric() || ch == '_' || ch == '-' {
            id.push(ch);
            last_dash = false;
        } else if ch.is_whitespace() && !last_dash && !id.is_empty() {
            id.push('-');
            last_dash = true;
        } else {
            return Err(
                "project name may contain only letters, numbers, spaces, '-' and '_'".into(),
            );
        }
    }
    let id = id.trim_matches('-').to_string();
    if id.is_empty() {
        Err("project name is required".into())
    } else {
        Ok(id)
    }
}

fn project_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    let safe_id = project_id(id)?;
    Ok(root.join(format!("{safe_id}.json")))
}

pub fn save(name: &str, project: &Value) -> Result<TransportProjectSummary, String> {
    if !project.is_object() {
        return Err("project payload must be a JSON object".into());
    }
    let root = project_root()?;
    std::fs::create_dir_all(&root).map_err(|e| format!("create project directory: {e}"))?;
    let id = project_id(name)?;
    let path = project_path(&root, &id)?;
    let content =
        serde_json::to_string_pretty(project).map_err(|e| format!("serialize project: {e}"))?;
    std::fs::write(&path, format!("{content}\n")).map_err(|e| format!("write project: {e}"))?;
    Ok(TransportProjectSummary {
        id,
        name: name.trim().to_string(),
        path: path.to_string_lossy().to_string(),
    })
}

pub fn load(id: &str) -> Result<(TransportProjectSummary, Value), String> {
    let root = project_root()?;
    let safe_id = project_id(id)?;
    let path = project_path(&root, &safe_id)?;
    let content = std::fs::read_to_string(&path).map_err(|e| format!("read project: {e}"))?;
    let project: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse project JSON: {e}"))?;
    let name = project
        .get("metadata")
        .and_then(|v| v.get("name"))
        .and_then(Value::as_str)
        .unwrap_or(&safe_id)
        .to_string();
    Ok((
        TransportProjectSummary {
            id: safe_id,
            name,
            path: path.to_string_lossy().to_string(),
        },
        project,
    ))
}

pub fn list() -> Result<Vec<TransportProjectSummary>, String> {
    let root = project_root()?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut projects = Vec::new();
    for entry in std::fs::read_dir(&root).map_err(|e| format!("list projects: {e}"))? {
        let entry = entry.map_err(|e| format!("read project entry: {e}"))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        let name = std::fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<Value>(&content).ok())
            .and_then(|project| {
                project
                    .get("metadata")
                    .and_then(|v| v.get("name"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .unwrap_or_else(|| id.to_string());
        projects.push(TransportProjectSummary {
            id: id.to_string(),
            name,
            path: path.to_string_lossy().to_string(),
        });
    }
    projects.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(projects)
}

#[cfg(test)]
mod tests {
    use super::project_id;

    #[test]
    fn project_id_accepts_readable_names_and_rejects_paths() {
        assert_eq!(
            project_id("Bangkok Base Model").unwrap(),
            "Bangkok-Base-Model"
        );
        assert_eq!(project_id("แบบจำลอง กรุงเทพ").unwrap(), "แบบจำลอง-กรุงเทพ");
        assert!(project_id("../outside").is_err());
        assert!(project_id("").is_err());
    }
}
