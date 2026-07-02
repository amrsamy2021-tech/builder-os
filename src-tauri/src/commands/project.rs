use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub folder_path: String,
    pub current_stage: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub folder_path: String,
    pub product_brain: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStageState {
    pub id: String,
    pub name: String,
    pub status: String,
    pub completion_percentage: i32,
    pub required_inputs: Vec<String>,
    pub deliverables: Vec<String>,
    pub blockers: Vec<String>,
    pub next_actions: Vec<serde_json::Value>,
    pub approved_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Deliverable {
    pub id: String,
    pub project_id: String,
    pub r#type: String,
    pub title: String,
    pub content: String,
    pub status: String,
    pub version: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLogEntry {
    pub id: String,
    pub project_id: Option<String>,
    pub action: String,
    pub details: Option<serde_json::Value>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationConfig {
    pub tool: String,
    pub status: String,
    pub config: serde_json::Value,
    pub last_sync_at: Option<String>,
}

const WORKFLOW_STAGES: &[(&str, &str, &[&str], &[&str])] = &[
    ("idea", "Idea", &["product idea"], &["Product Brief"]),
    ("discovery", "Discovery", &["target users", "business goal"], &["Personas", "Jobs to be Done"]),
    ("research", "Research", &["personas"], &["Research Summary", "Competitive Analysis"]),
    ("prd", "PRD", &["research summary"], &["PRD", "User Stories", "Acceptance Criteria"]),
    ("ux", "UX", &["PRD", "user stories"], &["UX Flows", "Screen List"]),
    ("ui", "UI", &["UX flows"], &["Screen Specs", "Design System Spec"]),
    ("architecture", "Architecture", &["PRD", "screen specs"], &["Architecture Plan", "DB Schema", "API Contracts"]),
    ("development", "Development", &["architecture"], &["Cursor Tasks", "Implementation Plan"]),
    ("qa", "QA", &["cursor tasks"], &["QA Test Cases"]),
    ("release", "Release", &["QA cases"], &["Release Notes", "Release Checklist"]),
];

#[tauri::command]
pub fn create_project(
    state: State<'_, DbState>,
    input: CreateProjectInput,
) -> Result<Project, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO projects (id, name, folder_path, current_stage, status, created_at, updated_at) VALUES (?1, ?2, ?3, 'idea', 'active', ?4, ?4)",
        params![id, input.name, input.folder_path, now],
    )
    .map_err(|e| e.to_string())?;

    let brain_json = input.product_brain.to_string();
    conn.execute(
        "INSERT INTO product_brain (project_id, data, version, updated_at) VALUES (?1, ?2, 1, ?3)",
        params![id, brain_json, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name: input.name,
        folder_path: input.folder_path,
        current_stage: "idea".to_string(),
        status: "active".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn get_projects(state: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, folder_path, current_stage, status, created_at, updated_at FROM projects ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                folder_path: row.get(2)?,
                current_stage: row.get(3)?,
                status: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(projects)
}

#[tauri::command]
pub fn get_project(state: State<'_, DbState>, id: String) -> Result<Project, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, folder_path, current_stage, status, created_at, updated_at FROM projects WHERE id = ?1",
        params![id],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                folder_path: row.get(2)?,
                current_stage: row.get(3)?,
                status: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_product_brain(
    state: State<'_, DbState>,
    project_id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let json = data.to_string();

    conn.execute(
        "INSERT INTO product_brain (project_id, data, version, updated_at) VALUES (?1, ?2, 1, ?3) ON CONFLICT(project_id) DO UPDATE SET data = ?2, version = version + 1, updated_at = ?3",
        params![project_id, json, now],
    )
    .map_err(|e| e.to_string())?;

    if let Ok(folder_path) = conn.query_row::<String, _, _>(
        "SELECT folder_path FROM projects WHERE id = ?1",
        params![project_id],
        |row| row.get(0),
    ) {
        let brain_path = Path::new(&folder_path).join(".builder").join("product-brain.json");
        if let Some(parent) = brain_path.parent() {
            fs::create_dir_all(parent).ok();
        }
        fs::write(&brain_path, serde_json::to_string_pretty(&data).unwrap_or(json))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_product_brain(
    state: State<'_, DbState>,
    project_id: String,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let json: String = conn
        .query_row(
            "SELECT data FROM product_brain WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn init_workflow_stages(state: State<'_, DbState>, project_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    for (i, (id, name, inputs, deliverables)) in WORKFLOW_STAGES.iter().enumerate() {
        let stage = WorkflowStageState {
            id: id.to_string(),
            name: name.to_string(),
            status: if i == 0 {
                "in_progress".to_string()
            } else {
                "not_started".to_string()
            },
            completion_percentage: 0,
            required_inputs: inputs.iter().map(|s| s.to_string()).collect(),
            deliverables: deliverables.iter().map(|s| s.to_string()).collect(),
            blockers: vec![],
            next_actions: vec![],
            approved_at: None,
        };
        let data = serde_json::to_string(&stage).map_err(|e| e.to_string())?;
        let stage_id = format!("{}-{}", project_id, id);

        conn.execute(
            "INSERT OR IGNORE INTO workflow_stages (id, project_id, stage, status, completion_percentage, data, updated_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
            params![stage_id, project_id, id, stage.status, data, now],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_workflow_stages(
    state: State<'_, DbState>,
    project_id: String,
) -> Result<Vec<WorkflowStageState>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT data FROM workflow_stages WHERE project_id = ?1 ORDER BY rowid")
        .map_err(|e| e.to_string())?;

    let stages = stmt
        .query_map(params![project_id], |row| {
            let data: String = row.get(0)?;
            Ok(data)
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter_map(|json| serde_json::from_str::<WorkflowStageState>(&json).ok())
        .collect();

    Ok(stages)
}

#[tauri::command]
pub fn update_workflow_stage(
    state: State<'_, DbState>,
    project_id: String,
    stage: WorkflowStageState,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let data = serde_json::to_string(&stage).map_err(|e| e.to_string())?;
    let stage_id = format!("{}-{}", project_id, stage.id);

    conn.execute(
        "UPDATE workflow_stages SET status = ?1, completion_percentage = ?2, data = ?3, updated_at = ?4 WHERE id = ?5",
        params![stage.status, stage.completion_percentage, data, now, stage_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_deliverables(
    state: State<'_, DbState>,
    project_id: String,
) -> Result<Vec<Deliverable>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, project_id, type, title, content, status, version, created_at, updated_at FROM deliverables WHERE project_id = ?1 ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![project_id], |row| {
            Ok(Deliverable {
                id: row.get(0)?,
                project_id: row.get(1)?,
                r#type: row.get(2)?,
                title: row.get(3)?,
                content: row.get(4)?,
                status: row.get(5)?,
                version: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

#[tauri::command]
pub fn save_deliverable(
    state: State<'_, DbState>,
    deliverable: Deliverable,
) -> Result<Deliverable, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO deliverables (id, project_id, type, title, content, status, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) ON CONFLICT(id) DO UPDATE SET content = ?5, status = ?6, version = version + 1, updated_at = ?8",
        params![
            deliverable.id,
            deliverable.project_id,
            deliverable.r#type,
            deliverable.title,
            deliverable.content,
            deliverable.status,
            deliverable.version,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Deliverable {
        created_at: now.clone(),
        updated_at: now,
        ..deliverable
    })
}

#[tauri::command]
pub fn approve_deliverable(state: State<'_, DbState>, id: String) -> Result<Deliverable, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE deliverables SET status = 'approved', updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, project_id, type, title, content, status, version, created_at, updated_at FROM deliverables WHERE id = ?1",
        params![id],
        |row| {
            Ok(Deliverable {
                id: row.get(0)?,
                project_id: row.get(1)?,
                r#type: row.get(2)?,
                title: row.get(3)?,
                content: row.get(4)?,
                status: row.get(5)?,
                version: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn log_activity(
    state: State<'_, DbState>,
    project_id: Option<String>,
    action: String,
    details: Option<serde_json::Value>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let details_str = details.map(|d| d.to_string());

    conn.execute(
        "INSERT INTO activity_log (id, project_id, action, details, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, project_id, action, details_str, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_activity_log(
    state: State<'_, DbState>,
    project_id: Option<String>,
) -> Result<Vec<ActivityLogEntry>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let entries: Vec<ActivityLogEntry> = if let Some(pid) = project_id {
        let mut stmt = conn
            .prepare("SELECT id, project_id, action, details, created_at FROM activity_log WHERE project_id = ?1 ORDER BY created_at DESC LIMIT 100")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pid], map_activity_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    } else {
        let mut stmt = conn
            .prepare("SELECT id, project_id, action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 100")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], map_activity_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    Ok(entries)
}

fn map_activity_row(row: &rusqlite::Row) -> rusqlite::Result<ActivityLogEntry> {
    let details_str: Option<String> = row.get(3)?;
    let details = details_str.and_then(|s| serde_json::from_str(&s).ok());
    Ok(ActivityLogEntry {
        id: row.get(0)?,
        project_id: row.get(1)?,
        action: row.get(2)?,
        details,
        created_at: row.get(4)?,
    })
}

#[tauri::command]
pub fn get_integrations(state: State<'_, DbState>) -> Result<Vec<IntegrationConfig>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT tool, status, config, last_sync_at FROM integrations")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
            let config_str: Option<String> = row.get(2)?;
            let config = config_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or(serde_json::json!({}));
            Ok(IntegrationConfig {
                tool: row.get(0)?,
                status: row.get(1)?,
                config,
                last_sync_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

#[tauri::command]
pub fn save_integration(
    state: State<'_, DbState>,
    tool: String,
    config: serde_json::Value,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let config_str = config.to_string();

    conn.execute(
        "INSERT INTO integrations (id, tool, status, config, updated_at) VALUES (?1, ?2, 'connected', ?3, ?4) ON CONFLICT(tool) DO UPDATE SET status = 'connected', config = ?3, updated_at = ?4",
        params![id, tool, config_str, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn disconnect_integration(state: State<'_, DbState>, tool: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE integrations SET status = 'disconnected', updated_at = ?1 WHERE tool = ?2",
        params![now, tool],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
