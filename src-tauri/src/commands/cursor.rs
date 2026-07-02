use std::process::Command;

use crate::secrets::require_secret;

const CURSOR_SECRET_KEY: &str = "builder-os-cursor-api";

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
pub struct RunCursorAgentInput {
    pub folder_path: String,
    pub prompt: String,
    pub mode: Option<String>,
}

#[tauri::command]
pub async fn run_cursor_agent(input: RunCursorAgentInput) -> Result<String, String> {
    let api_key = require_secret(CURSOR_SECRET_KEY, "Cursor API key not found. Add it in Settings.")?;
    let cli = find_cursor_cli().ok_or_else(|| {
        "Cursor CLI not found. Install Cursor or use OpenAI fallback in Settings.".to_string()
    })?;

    if !std::path::Path::new(&input.folder_path).exists() {
        return Err(format!(
            "Project folder not found: {}",
            input.folder_path
        ));
    }

    let mode = input.mode.unwrap_or_else(|| "local".to_string());
    let escaped_prompt = input.prompt.replace('\\', "\\\\").replace('"', "\\\"");

    // Headless agent invocation — uses Cursor CLI with API key in env
    let shell_cmd = format!(
        "cd \"{}\" && CURSOR_API_KEY=\"{}\" \"{}\" agent -p --output-format text \"{}\"",
        input.folder_path.replace('"', "\\\""),
        api_key.replace('"', "\\\""),
        cli.replace('"', "\\\""),
        escaped_prompt
    );

    let output = Command::new("sh")
        .arg("-c")
        .arg(&shell_cmd)
        .output()
        .map_err(|e| format!("Failed to run Cursor agent: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(if stdout.trim().is_empty() {
            stderr
        } else {
            stdout
        })
    } else {
        Err(format!(
            "Cursor agent failed (mode: {}): {}",
            mode,
            if stderr.is_empty() { stdout } else { stderr }
        ))
    }
}
