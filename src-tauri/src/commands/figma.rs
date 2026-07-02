use keyring::Entry;
use serde::{Deserialize, Serialize};

fn get_figma_token() -> Result<String, String> {
    let entry = Entry::new("builder-os", "builder-os-figma").map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FigmaFileContext {
    pub name: String,
    pub pages: Vec<FigmaPage>,
    pub components: Vec<FigmaComponent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FigmaPage {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FigmaComponent {
    pub id: String,
    pub name: String,
}

fn extract_file_key(url: &str) -> Result<String, String> {
    if url.contains("/design/") {
        let parts: Vec<&str> = url.split("/design/").collect();
        if parts.len() > 1 {
            let key = parts[1].split('/').next().unwrap_or("");
            if !key.is_empty() {
                return Ok(key.to_string());
            }
        }
    }
    if url.contains("/file/") {
        let parts: Vec<&str> = url.split("/file/").collect();
        if parts.len() > 1 {
            let key = parts[1].split('/').next().unwrap_or("");
            if !key.is_empty() {
                return Ok(key.to_string());
            }
        }
    }
    Err("Could not extract Figma file key from URL".to_string())
}

#[tauri::command]
pub async fn test_figma() -> Result<String, String> {
    let token = get_figma_token()?;
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.figma.com/v1/me")
        .header("X-Figma-Token", &token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Figma API error: {}", resp.status()));
    }

    let user: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let email = user["email"].as_str().unwrap_or("unknown");
    Ok(format!("Figma connected as {}", email))
}

#[tauri::command]
pub async fn fetch_figma_file(file_url: String) -> Result<FigmaFileContext, String> {
    let token = get_figma_token()?;
    let file_key = extract_file_key(&file_url)?;
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("https://api.figma.com/v1/files/{}", file_key))
        .header("X-Figma-Token", &token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Figma file fetch error: {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let name = data["name"].as_str().unwrap_or("Untitled").to_string();

    let pages: Vec<FigmaPage> = data["document"]["children"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|p| {
                    Some(FigmaPage {
                        id: p["id"].as_str()?.to_string(),
                        name: p["name"].as_str()?.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let components: Vec<FigmaComponent> = data["components"]
        .as_object()
        .map(|obj| {
            obj.values()
                .filter_map(|c| {
                    Some(FigmaComponent {
                        id: c["key"].as_str()?.to_string(),
                        name: c["name"].as_str()?.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(FigmaFileContext {
        name,
        pages,
        components,
    })
}

#[tauri::command]
pub fn generate_figma_prompts(product_brain: serde_json::Value) -> Result<String, String> {
    let project_name = product_brain
        .get("projectName")
        .and_then(|v| v.as_str())
        .unwrap_or("Project");
    let idea = product_brain
        .get("idea")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let screens = product_brain
        .get("screens")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|s| {
                    let name = s["name"].as_str()?;
                    let purpose = s["purpose"].as_str().unwrap_or("");
                    Some(format!("### {}\n{}\n", name, purpose))
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_else(|| "- Home Screen\n- Detail Screen\n".to_string());

    Ok(format!(
        "# Figma Make Prompts — {}\n\n## Project Context\n{}\n\n## Screen Prompts\n{}\n\n## Design Direction\n- Modern, clean interface\n- Consistent with design system\n- Accessible and responsive\n",
        project_name, idea, screens
    ))
}
