use std::fs;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
pub fn scaffold_project(
    folder_path: String,
    product_brain: serde_json::Value,
) -> Result<(), String> {
    let root = Path::new(&folder_path);

    let dirs = [
        ".builder",
        "docs",
        "design",
        ".cursor/rules",
        ".cursor/tasks",
    ];
    for dir in dirs {
        fs::create_dir_all(root.join(dir)).map_err(|e| e.to_string())?;
    }

    let files: Vec<(&str, String)> = vec![
        (
            ".builder/product-brain.json",
            serde_json::to_string_pretty(&product_brain).unwrap_or_default(),
        ),
        (
            ".builder/workflow-state.json",
            r#"{"currentStage":"idea","stages":[]}"#.to_string(),
        ),
        (
            ".builder/integrations.json",
            r#"{"integrations":[]}"#.to_string(),
        ),
        (
            ".builder/activity-log.json",
            r#"{"entries":[]}"#.to_string(),
        ),
        ("docs/prd.md", "# PRD\n\n".to_string()),
        ("docs/user-stories.md", "# User Stories\n\n".to_string()),
        ("docs/architecture.md", "# Architecture\n\n".to_string()),
        ("docs/qa-test-cases.md", "# QA Test Cases\n\n".to_string()),
        ("docs/release-notes.md", "# Release Notes\n\n".to_string()),
        (
            "design/figma-context.json",
            r#"{"pages":[],"components":[]}"#.to_string(),
        ),
        (
            "design/figma-prompts.md",
            "# Figma Prompts\n\n".to_string(),
        ),
        (
            "implementation-plan.md",
            "# Implementation Plan\n\n".to_string(),
        ),
    ];

    for (rel_path, content) in files {
        let path = root.join(rel_path);
        if !path.exists() {
            fs::write(&path, content).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn write_file(path: String, content: String, overwrite: Option<bool>) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() && !overwrite.unwrap_or(false) {
        return Err(format!("File already exists: {}", path));
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn file_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}
