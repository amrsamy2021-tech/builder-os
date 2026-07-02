use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpServerConfig {
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Option<Vec<String>>,
    #[serde(default)]
    pub env: Option<HashMap<String, String>>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub headers: Option<HashMap<String, String>>,
    #[serde(rename = "type", default)]
    pub transport_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CursorMcpConfig {
    #[serde(rename = "mcpServers", default)]
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpServerInfo {
    pub name: String,
    pub source: String,
    pub transport: String,
    pub command: Option<String>,
    pub url: Option<String>,
    pub mapped_tool: Option<String>,
}

/// Default MCP server templates Builder OS can suggest for each tool.
pub fn default_mcp_templates() -> HashMap<&'static str, McpServerConfig> {
    let mut map = HashMap::new();
    map.insert(
        "notion",
        McpServerConfig {
            command: None,
            args: None,
            env: None,
            url: Some("https://mcp.notion.com/mcp".to_string()),
            headers: Some(HashMap::new()),
            transport_type: Some("http".to_string()),
        },
    );
    map.insert(
        "figma",
        McpServerConfig {
            command: None,
            args: None,
            env: None,
            url: Some("https://mcp.figma.com/mcp".to_string()),
            headers: None,
            transport_type: Some("http".to_string()),
        },
    );
    map.insert(
        "github",
        McpServerConfig {
            command: Some("docker".to_string()),
            args: Some(vec![
                "run".to_string(),
                "-i".to_string(),
                "--rm".to_string(),
                "-e".to_string(),
                "GITHUB_PERSONAL_ACCESS_TOKEN".to_string(),
                "ghcr.io/github/github-mcp-server".to_string(),
            ]),
            env: None,
            url: None,
            headers: None,
            transport_type: Some("stdio".to_string()),
        },
    );
    map
}

fn cursor_mcp_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cursor")
        .join("mcp.json")
}

fn parse_mcp_file(path: &Path) -> HashMap<String, McpServerConfig> {
    if !path.exists() {
        return HashMap::new();
    }
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };

    if let Ok(config) = serde_json::from_str::<CursorMcpConfig>(&content) {
        if !config.mcp_servers.is_empty() {
            return config.mcp_servers;
        }
    }

    // Plugin-style flat format: { "notion": { "type": "http", "url": "..." } }
    if let Ok(flat) = serde_json::from_str::<HashMap<String, McpServerConfig>>(&content) {
        return flat;
    }

    HashMap::new()
}

fn infer_transport(config: &McpServerConfig) -> String {
    if let Some(t) = &config.transport_type {
        return t.clone();
    }
    if config.url.is_some() {
        "http".to_string()
    } else if config.command.is_some() {
        "stdio".to_string()
    } else {
        "unknown".to_string()
    }
}

fn map_server_to_tool(name: &str) -> Option<String> {
    let lower = name.to_lowercase();
    if lower.contains("notion") {
        return Some("notion".to_string());
    }
    if lower.contains("figma") {
        return Some("figma".to_string());
    }
    if lower.contains("github") {
        return Some("github".to_string());
    }
    if lower.contains("railway") {
        return Some("railway".to_string());
    }
    if lower.contains("supabase") {
        return Some("supabase".to_string());
    }
    if lower.contains("sentry") {
        return Some("sentry".to_string());
    }
    None
}

#[tauri::command]
pub fn list_mcp_servers() -> Result<Vec<McpServerInfo>, String> {
    let cursor_path = cursor_mcp_path();
    let mut servers = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for (name, config) in parse_mcp_file(&cursor_path) {
        seen.insert(name.clone());
        servers.push(McpServerInfo {
            name: name.clone(),
            source: "~/.cursor/mcp.json".to_string(),
            transport: infer_transport(&config),
            command: config.command.clone(),
            url: config.url.clone(),
            mapped_tool: map_server_to_tool(&name),
        });
    }

    // Include default templates for tools not yet configured
    for (tool, config) in default_mcp_templates() {
        let already = servers.iter().any(|s| {
            s.mapped_tool.as_deref() == Some(tool)
                || s.name.to_lowercase().contains(tool)
        });
        if !already {
            let name = format!("builder-os-{}", tool);
            if seen.insert(name.clone()) {
                servers.push(McpServerInfo {
                    name,
                    source: "builder-os template".to_string(),
                    transport: infer_transport(&config),
                    command: config.command.clone(),
                    url: config.url.clone(),
                    mapped_tool: Some(tool.to_string()),
                });
            }
        }
    }

    Ok(servers)
}

#[tauri::command]
pub fn read_project_mcp_config(folder_path: String) -> Result<HashMap<String, McpServerConfig>, String> {
    let path = Path::new(&folder_path).join(".cursor").join("mcp.json");
    Ok(parse_mcp_file(&path))
}

#[tauri::command]
pub fn connect_tool_via_mcp(
    tool: String,
    mcp_server_name: String,
    folder_path: Option<String>,
) -> Result<McpServerInfo, String> {
    let cursor_path = cursor_mcp_path();
    let cursor_servers = parse_mcp_file(&cursor_path);
    let templates = default_mcp_templates();

    let config = cursor_servers
        .get(&mcp_server_name)
        .cloned()
        .or_else(|| {
            templates
                .get(tool.as_str())
                .cloned()
                .filter(|_| mcp_server_name.starts_with("builder-os-"))
        })
        .ok_or_else(|| format!("MCP server '{}' not found", mcp_server_name))?;

    // Sync to project .cursor/mcp.json if folder provided
    if let Some(ref folder) = folder_path {
        let project_mcp_path = Path::new(folder).join(".cursor").join("mcp.json");
        fs::create_dir_all(project_mcp_path.parent().unwrap()).map_err(|e| e.to_string())?;

        let mut project_config = parse_mcp_file(&project_mcp_path);
        project_config.insert(mcp_server_name.clone(), config.clone());

        let output = CursorMcpConfig {
            mcp_servers: project_config,
        };
        fs::write(
            &project_mcp_path,
            serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }

    // Also ensure global Cursor config has the server if using a template
    if mcp_server_name.starts_with("builder-os-") && !cursor_servers.contains_key(&mcp_server_name) {
        let mut global = cursor_servers;
        global.insert(mcp_server_name.clone(), config.clone());
        fs::create_dir_all(cursor_path.parent().unwrap()).map_err(|e| e.to_string())?;
        let output = CursorMcpConfig {
            mcp_servers: global,
        };
        fs::write(
            &cursor_path,
            serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(McpServerInfo {
        name: mcp_server_name,
        source: "connected".to_string(),
        transport: infer_transport(&config),
        command: config.command,
        url: config.url,
        mapped_tool: Some(tool),
    })
}

#[tauri::command]
pub async fn test_mcp_connection(mcp_server_name: String) -> Result<String, String> {
    let cursor_path = cursor_mcp_path();
    let servers = parse_mcp_file(&cursor_path);

    let config = servers
        .get(&mcp_server_name)
        .ok_or_else(|| format!("MCP server '{}' not in ~/.cursor/mcp.json", mcp_server_name))?;

    if let Some(url) = &config.url {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        // HTTP MCP servers may require auth; a reachable endpoint confirms config
        let resp = client
            .post(url)
            .header("Content-Type", "application/json")
            .body(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"builder-os","version":"0.1.0"}}}"#)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = resp.status();
        if status.is_success() || status.as_u16() == 401 || status.as_u16() == 403 {
            return Ok(format!(
                "MCP server '{}' reachable at {} (HTTP {})",
                mcp_server_name,
                url,
                status.as_u16()
            ));
        }
        return Err(format!("MCP server returned HTTP {}", status.as_u16()));
    }

    if let Some(cmd) = &config.command {
        if !Path::new(cmd).exists() && which_command(cmd).is_none() {
            return Err(format!("MCP command not found: {}", cmd));
        }
        return Ok(format!(
            "MCP server '{}' configured (stdio via {})",
            mcp_server_name, cmd
        ));
    }

    Err(format!("MCP server '{}' has no url or command", mcp_server_name))
}

fn which_command(cmd: &str) -> Option<String> {
    if Path::new(cmd).exists() {
        return Some(cmd.to_string());
    }
    std::process::Command::new("which")
        .arg(cmd)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}
