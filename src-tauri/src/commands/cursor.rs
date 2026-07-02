use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Emitter};

use crate::secrets::require_secret;

const CURSOR_SECRET_KEY: &str = "builder-os-cursor-api";

fn running_jobs() -> &'static Mutex<HashMap<String, u32>> {
    static JOBS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorAgentOutputEvent {
    job_id: String,
    line: String,
    stream: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorAgentDoneEvent {
    job_id: String,
    success: bool,
    output: String,
    error: Option<String>,
}

fn find_cursor_cli() -> Option<String> {
    let candidates = [
        "cursor",
        "/usr/local/bin/cursor",
        "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    ];
    for candidate in candidates {
        if candidate.contains('/') {
            if std::path::Path::new(candidate).exists() {
                return Some(candidate.to_string());
            }
            continue;
        }
        let output = Command::new("sh")
            .arg("-c")
            .arg(format!("command -v {} 2>/dev/null", candidate))
            .output()
            .ok()?;
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
}

fn emit_line(app: &AppHandle, job_id: &str, line: &str, stream: &str) {
    let _ = app.emit(
        "cursor-agent-output",
        CursorAgentOutputEvent {
            job_id: job_id.to_string(),
            line: line.to_string(),
            stream: stream.to_string(),
        },
    );
}

fn emit_done(app: &AppHandle, job_id: &str, success: bool, output: String, error: Option<String>) {
    let _ = app.emit(
        "cursor-agent-done",
        CursorAgentDoneEvent {
            job_id: job_id.to_string(),
            success,
            output,
            error,
        },
    );
}

async fn run_cloud_cursor_agent(api_key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "prompt": { "text": prompt }
    });

    let resp = client
        .post("https://api.cursor.com/v0/agents")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Cloud agent request failed: {}", e))?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("Cloud agent error: {}", err));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Cloud agent invalid response: {}", e))?;

    if let Some(text) = json.get("result").and_then(|v| v.as_str()) {
        return Ok(text.to_string());
    }
    if let Some(text) = json.get("output").and_then(|v| v.as_str()) {
        return Ok(text.to_string());
    }

    Ok(json.to_string())
}

fn stream_process_output(
    app: &AppHandle,
    job_id: &str,
    reader: impl BufRead,
    stream: &str,
    output: &mut String,
) {
    for line in reader.lines().map_while(Result::ok) {
        output.push_str(&line);
        output.push('\n');
        emit_line(app, job_id, &line, stream);
    }
}

#[tauri::command]
pub fn detect_cursor_cli() -> Result<bool, String> {
    Ok(find_cursor_cli().is_some())
}

#[tauri::command]
pub async fn test_cursor_agent() -> Result<String, String> {
    let _api_key = require_secret(
        CURSOR_SECRET_KEY,
        "Cursor API key not found. Add it in Settings.",
    )?;
    let cli = find_cursor_cli().ok_or_else(|| {
        "Cursor CLI not found. Install Cursor and ensure the `cursor` command is available.".to_string()
    })?;
    Ok(format!("Cursor CLI found at {}. API key is saved.", cli))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCursorAgentInput {
    pub job_id: String,
    pub folder_path: String,
    pub prompt: String,
    pub mode: Option<String>,
}

#[tauri::command]
pub async fn run_cursor_agent(app: AppHandle, input: RunCursorAgentInput) -> Result<String, String> {
    let api_key = require_secret(CURSOR_SECRET_KEY, "Cursor API key not found. Add it in Settings.")?;
    let mode = input.mode.unwrap_or_else(|| "local".to_string());
    let job_id = input.job_id.clone();

    if mode == "cloud" {
        match run_cloud_cursor_agent(&api_key, &input.prompt).await {
            Ok(output) => {
                emit_done(&app, &job_id, true, output.clone(), None);
                return Ok(output);
            }
            Err(cloud_err) => {
                emit_line(
                    &app,
                    &job_id,
                    &format!("Cloud agent unavailable ({cloud_err}). Falling back to local CLI."),
                    "stderr",
                );
            }
        }
    }

    let cli = find_cursor_cli().ok_or_else(|| {
        "Cursor CLI not found. Install Cursor or use OpenAI fallback in Settings.".to_string()
    })?;

    if !std::path::Path::new(&input.folder_path).exists() {
        return Err(format!("Project folder not found: {}", input.folder_path));
    }

    let escaped_prompt = input.prompt.replace('\\', "\\\\").replace('"', "\\\"");

    let mut child = Command::new("sh")
        .arg("-c")
        .arg(format!(
            "cd \"{}\" && CURSOR_API_KEY=\"{}\" \"{}\" agent -p --output-format text \"{}\"",
            input.folder_path.replace('"', "\\\""),
            api_key.replace('"', "\\\""),
            cli.replace('"', "\\\""),
            escaped_prompt
        ))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Cursor agent: {}", e))?;

    if let Ok(mut jobs) = running_jobs().lock() {
        jobs.insert(job_id.clone(), child.id());
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let mut combined = String::new();

    if let Some(out) = stdout {
        stream_process_output(&app, &job_id, BufReader::new(out), "stdout", &mut combined);
    }
    if let Some(err) = stderr {
        stream_process_output(&app, &job_id, BufReader::new(err), "stderr", &mut combined);
    }

    let status = child
        .wait()
        .map_err(|e| format!("Cursor agent wait failed: {}", e))?;

    if let Ok(mut jobs) = running_jobs().lock() {
        jobs.remove(&job_id);
    }

    if status.success() {
        let output = if combined.trim().is_empty() {
            "Cursor agent completed with no output.".to_string()
        } else {
            combined
        };
        emit_done(&app, &job_id, true, output.clone(), None);
        Ok(output)
    } else {
        let err = format!("Cursor agent exited with status {}", status);
        emit_done(&app, &job_id, false, combined.clone(), Some(err.clone()));
        Err(err)
    }
}

#[tauri::command]
pub fn cancel_cursor_agent(job_id: String) -> Result<(), String> {
    let pid = running_jobs()
        .lock()
        .map_err(|e| e.to_string())?
        .get(&job_id)
        .copied()
        .ok_or_else(|| "No running job with that ID".to_string())?;

    Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to cancel job: {}", e))?;

    if let Ok(mut jobs) = running_jobs().lock() {
        jobs.remove(&job_id);
    }

    Ok(())
}
