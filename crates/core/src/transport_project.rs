//! Workspace-local, loss-resistant persistence for Transport workflow projects.
//!
//! The frontend owns schema migration and graph validation. This layer preserves
//! opaque JSON, uses stable IDs instead of display names for updates, and backs
//! up the exact previous bytes before replacing an existing project.

use fs2::FileExt;
use serde::Serialize;
use serde_json::Value;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct TransportProjectSummary {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "backupPath", skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
}

fn project_root() -> Result<PathBuf, String> {
    if crate::workdir::is_multiuser() && !crate::workdir::workdir_is_scoped() {
        return Err("Transport projects require a scoped user workspace".into());
    }
    let workspace = crate::workdir::current_workdir();
    if !workspace.is_absolute() {
        return Err("cannot resolve an absolute Transport workspace".into());
    }
    let root = workspace
        .join(".thclaws")
        .join("transport")
        .join("projects");
    // Check existing ancestors too: a symlinked .thclaws/ must not redirect
    // project writes outside the active workspace. check_write intentionally
    // disallows internal state, so use the regular boundary check here.
    crate::sandbox::Sandbox::check_in(&workspace, &root.to_string_lossy())
        .map_err(|e| format!("resolve project directory: {e}"))
}

fn validate_id(id: &str) -> Result<(), String> {
    // Validate the exact supplied ID, never sanitize/truncate it into a
    // different project's filename. Keep compatibility with readable v1 IDs.
    if id.is_empty()
        || id.encode_utf16().count() > 180
        || id.starts_with('.')
        || id.ends_with(['.', ' '])
        || id.chars().any(|ch| {
            ch.is_control() || matches!(ch, '/' | '\\' | ':' | '<' | '>' | '"' | '|' | '?' | '*')
        })
    {
        return Err("invalid project ID: expected a safe filename stem".into());
    }
    let device = id.split('.').next().unwrap_or(id).to_ascii_uppercase();
    if matches!(device.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || device
            .strip_prefix("COM")
            .or_else(|| device.strip_prefix("LPT"))
            .is_some_and(|n| {
                matches!(
                    n,
                    "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
                )
            })
    {
        return Err("invalid project ID: reserved Windows filename".into());
    }
    Ok(())
}

fn new_project_id(name: &str) -> String {
    let slug: String = name
        .chars()
        .take(40)
        .map(|ch| {
            if ch.is_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let slug = slug.trim_matches('-');
    format!(
        "{}-{}",
        if slug.is_empty() { "project" } else { slug },
        Uuid::new_v4()
    )
}

fn project_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    validate_id(id)?;
    Ok(root.join(format!("{id}.json")))
}

fn validate_payload(name: &str, project: &Value) -> Result<(), String> {
    if name.trim().is_empty() || name.chars().any(char::is_control) {
        return Err("project name is required and must not contain control characters".into());
    }
    if !project.is_object() {
        return Err("project payload must be a JSON object".into());
    }
    let metadata = project
        .get("metadata")
        .and_then(Value::as_object)
        .ok_or("project metadata must be a JSON object")?;
    if metadata
        .get("name")
        .and_then(Value::as_str)
        .is_none_or(|name| name.trim().is_empty())
    {
        return Err("project metadata.name must be a non-empty string".into());
    }
    Ok(())
}

fn require_regular_file(path: &Path) -> Result<(), String> {
    let metadata =
        std::fs::symlink_metadata(path).map_err(|e| format!("read project metadata: {e}"))?;
    if !metadata.file_type().is_file() {
        return Err("project path must be a regular file, not a directory or symlink".into());
    }
    Ok(())
}

fn prepare_directory(path: &Path) -> Result<(), String> {
    if let Ok(metadata) = std::fs::symlink_metadata(path) {
        if !metadata.file_type().is_dir() {
            return Err(format!(
                "{} must be a directory, not a symlink or file",
                path.display()
            ));
        }
    }
    std::fs::create_dir_all(path).map_err(|e| format!("create project directory: {e}"))
}

fn backup_existing(root: &Path, id: &str, path: &Path) -> Result<PathBuf, String> {
    require_regular_file(path)?;
    let backup_root = root.join("backups");
    prepare_directory(&backup_root)?;
    let backup_path = backup_root.join(format!("{id}-{}.json", Uuid::new_v4()));
    let mut source = File::open(path).map_err(|e| format!("open project for backup: {e}"))?;
    let mut temporary =
        NamedTempFile::new_in(&backup_root).map_err(|e| format!("create project backup: {e}"))?;
    std::io::copy(&mut source, temporary.as_file_mut())
        .map_err(|e| format!("copy project backup: {e}"))?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|e| format!("flush project backup: {e}"))?;
    temporary
        .persist_noclobber(&backup_path)
        .map_err(|e| format!("preserve project backup: {e}"))?;
    Ok(backup_path)
}

pub fn save(
    name: &str,
    project: &Value,
    existing_id: Option<&str>,
    save_as: bool,
) -> Result<TransportProjectSummary, String> {
    save_in(&project_root()?, name, project, existing_id, save_as)
}

fn save_in(
    root: &Path,
    name: &str,
    project: &Value,
    existing_id: Option<&str>,
    save_as: bool,
) -> Result<TransportProjectSummary, String> {
    validate_payload(name, project)?;
    if let Some(id) = existing_id {
        validate_id(id)?;
    }
    let update_id = existing_id.filter(|_| !save_as);
    let id = update_id
        .map(str::to_owned)
        .unwrap_or_else(|| new_project_id(name));
    let path = project_path(root, &id)?;
    let content = format!(
        "{}\n",
        serde_json::to_string_pretty(project).map_err(|e| format!("serialize project: {e}"))?
    );
    prepare_directory(root)?;
    let lock_path = root.join(".save.lock");
    if std::fs::symlink_metadata(&lock_path).is_ok() {
        require_regular_file(&lock_path)?;
    }
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&lock_path)
        .map_err(|e| format!("open project save lock: {e}"))?;
    lock.lock_exclusive()
        .map_err(|e| format!("lock project save: {e}"))?;

    // Stage and flush the complete replacement before touching the current
    // file. tempfile uses a same-filesystem rename/Windows replacement, not a
    // delete-then-rename fallback, so failure leaves the original in place.
    let mut temporary =
        NamedTempFile::new_in(root).map_err(|e| format!("create temporary project: {e}"))?;
    temporary
        .write_all(content.as_bytes())
        .map_err(|e| format!("write temporary project: {e}"))?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|e| format!("flush temporary project: {e}"))?;
    let backup_path = if update_id.is_some() {
        // Explicit update IDs must already exist. A deleted/moved project
        // should prompt Save As, not silently turn an update into a new file.
        let backup = backup_existing(root, &id, &path)?;
        temporary.persist(&path).map_err(|e| {
            format!(
                "replace project (original backup at {}): {e}",
                backup.display()
            )
        })?;
        Some(backup.to_string_lossy().into_owned())
    } else {
        temporary
            .persist_noclobber(&path)
            .map_err(|e| format!("save new project without overwriting: {e}"))?;
        None
    };
    // Closing the file releases the advisory lock, including all error paths.
    drop(lock);
    Ok(TransportProjectSummary {
        id,
        name: name.trim().to_owned(),
        path: path.to_string_lossy().into_owned(),
        backup_path,
    })
}

pub fn load(id: &str) -> Result<(TransportProjectSummary, Value), String> {
    load_in(&project_root()?, id)
}

fn load_in(root: &Path, id: &str) -> Result<(TransportProjectSummary, Value), String> {
    let path = project_path(root, id)?;
    require_regular_file(&path)?;
    let content = std::fs::read_to_string(&path).map_err(|e| format!("read project: {e}"))?;
    let project: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse project JSON: {e}"))?;
    let name = project
        .get("metadata")
        .and_then(|v| v.get("name"))
        .and_then(Value::as_str)
        .unwrap_or(id)
        .to_owned();
    Ok((
        TransportProjectSummary {
            id: id.to_owned(),
            name,
            path: path.to_string_lossy().into_owned(),
            backup_path: None,
        },
        project,
    ))
}

pub fn list() -> Result<Vec<TransportProjectSummary>, String> {
    list_in(&project_root()?)
}

fn list_in(root: &Path) -> Result<Vec<TransportProjectSummary>, String> {
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut projects = Vec::new();
    for entry in std::fs::read_dir(root).map_err(|e| format!("list projects: {e}"))? {
        let entry = entry.map_err(|e| format!("read project entry: {e}"))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        if validate_id(id).is_err() || require_regular_file(&path).is_err() {
            continue;
        }
        let name = std::fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<Value>(&content).ok())
            .and_then(|project| {
                project
                    .get("metadata")
                    .and_then(|v| v.get("name"))
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| id.to_owned());
        projects.push(TransportProjectSummary {
            id: id.to_owned(),
            name,
            path: path.to_string_lossy().into_owned(),
            backup_path: None,
        });
    }
    projects.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then_with(|| a.id.cmp(&b.id))
    });
    Ok(projects)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn project(name: &str, version: u32) -> Value {
        json!({"schemaVersion": version, "metadata": {"name": name}, "opaque": {"keep": [1, "ไทย"]}})
    }

    #[test]
    fn same_or_colliding_display_names_never_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let a = save_in(
            dir.path(),
            "Bangkok Model",
            &project("Bangkok Model", 1),
            None,
            false,
        )
        .unwrap();
        let b = save_in(
            dir.path(),
            "Bangkok-Model",
            &project("Bangkok-Model", 2),
            None,
            false,
        )
        .unwrap();
        let c = save_in(
            dir.path(),
            "Bangkok Model",
            &project("Bangkok Model", 2),
            None,
            false,
        )
        .unwrap();
        assert_ne!(a.id, b.id);
        assert_ne!(a.id, c.id);
        assert_eq!(list_in(dir.path()).unwrap().len(), 3);
        assert_eq!(
            load_in(dir.path(), &a.id).unwrap().1,
            project("Bangkok Model", 1)
        );
    }

    #[test]
    fn update_uses_stable_id_and_preserves_exact_legacy_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let legacy = b"{\"schemaVersion\":1,\"metadata\":{\"name\":\"Old\"},\"nodes\":[]}\r\n";
        std::fs::write(dir.path().join("Old-Model.json"), legacy).unwrap();
        let new = project("Renamed Model", 2);
        let saved = save_in(dir.path(), "Renamed Model", &new, Some("Old-Model"), false).unwrap();
        assert_eq!(saved.id, "Old-Model");
        assert_eq!(std::fs::read(saved.backup_path.unwrap()).unwrap(), legacy);
        assert_eq!(load_in(dir.path(), "Old-Model").unwrap().1, new);
        assert_eq!(list_in(dir.path()).unwrap().len(), 1);
        let again = save_in(dir.path(), "Renamed Model", &new, Some("Old-Model"), false).unwrap();
        assert!(again.backup_path.is_some());
        assert_eq!(
            std::fs::read_dir(dir.path().join("backups"))
                .unwrap()
                .count(),
            2
        );
    }

    #[test]
    fn save_as_does_not_touch_original() {
        let dir = tempfile::tempdir().unwrap();
        let a = save_in(dir.path(), "Model", &project("Model", 1), None, false).unwrap();
        let b = save_in(dir.path(), "Model", &project("Model", 2), Some(&a.id), true).unwrap();
        assert_ne!(a.id, b.id);
        assert!(b.backup_path.is_none());
        assert_eq!(load_in(dir.path(), &a.id).unwrap().1["schemaVersion"], 1);
    }

    #[test]
    fn exact_id_validation_rejects_paths_reserved_names_and_truncation() {
        for id in [
            "",
            "../outside",
            "a/b",
            "a\\b",
            "C:escape",
            "bad?name",
            "CON",
            "NUL.json",
            "LPT9",
            "COM¹",
            "trailing ",
            ".hidden",
            "trailing.",
        ] {
            assert!(validate_id(id).is_err(), "accepted {id}");
        }
        assert!(validate_id(&"a".repeat(181)).is_err());
        assert!(validate_id("Bangkok-Base-Model").is_ok());
        assert!(validate_id("แบบจำลอง-กรุงเทพ").is_ok());
    }

    #[test]
    fn backup_failure_leaves_original_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let a = save_in(dir.path(), "Model", &project("Model", 1), None, false).unwrap();
        let before = std::fs::read(&a.path).unwrap();
        std::fs::write(dir.path().join("backups"), "not a directory").unwrap();
        assert!(save_in(
            dir.path(),
            "Model",
            &project("Model", 2),
            Some(&a.id),
            false
        )
        .is_err());
        assert_eq!(std::fs::read(&a.path).unwrap(), before);
    }

    #[test]
    fn invalid_payload_or_missing_update_never_changes_existing_project() {
        let dir = tempfile::tempdir().unwrap();
        let a = save_in(dir.path(), "Model", &project("Model", 1), None, false).unwrap();
        let before = std::fs::read(&a.path).unwrap();
        for invalid in [
            Value::Null,
            json!([]),
            json!({}),
            json!({"metadata": "x"}),
            json!({"metadata": {"name": 5}}),
        ] {
            assert!(save_in(dir.path(), "Model", &invalid, Some(&a.id), false).is_err());
        }
        assert!(save_in(
            dir.path(),
            "Model",
            &project("Model", 2),
            Some("missing"),
            false
        )
        .is_err());
        assert_eq!(std::fs::read(&a.path).unwrap(), before);
        assert_eq!(list_in(dir.path()).unwrap().len(), 1);
    }

    #[test]
    fn directory_targets_cannot_be_loaded_or_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("directory.json")).unwrap();
        assert!(load_in(dir.path(), "directory").is_err());
        assert!(save_in(
            dir.path(),
            "Model",
            &project("Model", 2),
            Some("directory"),
            false
        )
        .is_err());
        assert!(list_in(dir.path()).unwrap().is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn windows_locked_target_failure_preserves_original() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let a = save_in(dir.path(), "Model", &project("Model", 1), None, false).unwrap();
        let before = std::fs::read(&a.path).unwrap();
        // FILE_SHARE_READ permits backup reads, but withholding DELETE share
        // makes the atomic replacement fail (as when another app holds it).
        let held_open = OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(&a.path)
            .unwrap();
        assert!(save_in(
            dir.path(),
            "Model",
            &project("Model", 2),
            Some(&a.id),
            false
        )
        .is_err());
        assert_eq!(std::fs::read(&a.path).unwrap(), before);
        assert_eq!(
            std::fs::read_dir(dir.path().join("backups"))
                .unwrap()
                .count(),
            1
        );
        drop(held_open);
    }
}
