use std::collections::HashMap;

use crate::secrets::require_secret;

fn get_notion_token() -> Result<String, String> {
    require_secret("builder-os-notion", "Notion token")
}

#[tauri::command]
pub async fn test_notion() -> Result<String, String> {
    let token = get_notion_token()?;
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.notion.com/v1/users/me")
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Notion API error: {}", resp.status()));
    }

    let user: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let name = user["name"].as_str().unwrap_or("unknown");
    Ok(format!("Notion connected as {}", name))
}

#[tauri::command]
pub async fn create_notion_project(
    project_name: String,
    parent_page_id: Option<String>,
) -> Result<HashMap<String, String>, String> {
    let token = get_notion_token()?;
    let client = reqwest::Client::new();

    let parent = if let Some(pid) = parent_page_id {
        serde_json::json!({ "type": "page_id", "page_id": pid })
    } else {
        serde_json::json!({ "type": "workspace", "workspace": true })
    };

    let body = serde_json::json!({
        "parent": parent,
        "properties": {
            "title": {
                "title": [{ "text": { "content": project_name } }]
            }
        },
        "children": [
            {
                "object": "block",
                "type": "heading_1",
                "heading_1": {
                    "rich_text": [{ "text": { "content": "Project Overview" } }]
                }
            },
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{ "text": { "content": format!("Builder OS project: {}", project_name) } }]
                }
            }
        ]
    });

    let resp = client
        .post("https://api.notion.com/v1/pages")
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("Notion create page error: {}", err));
    }

    let page: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let page_id = page["id"].as_str().unwrap_or("").to_string();
    let page_url = page["url"].as_str().unwrap_or("").to_string();

    let mut result = HashMap::new();
    result.insert("projectPageId".to_string(), page_id.clone());
    result.insert("projectPageUrl".to_string(), page_url);

    for (child_name, child_key) in [
        ("PRD", "prdPageId"),
        ("Architecture", "architecturePageId"),
        ("QA", "qaPageId"),
    ] {
        let child_body = serde_json::json!({
            "parent": { "type": "page_id", "page_id": page_id },
            "properties": {
                "title": {
                    "title": [{ "text": { "content": format!("{} — {}", project_name, child_name) } }]
                }
            }
        });

        if let Ok(child_resp) = client
            .post("https://api.notion.com/v1/pages")
            .header("Authorization", format!("Bearer {}", token))
            .header("Notion-Version", "2022-06-28")
            .header("Content-Type", "application/json")
            .json(&child_body)
            .send()
            .await
        {
            if let Ok(child_page) = child_resp.json::<serde_json::Value>().await {
                if let Some(id) = child_page["id"].as_str() {
                    result.insert(child_key.to_string(), id.to_string());
                }
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn sync_deliverable_to_notion(
    page_id: String,
    title: String,
    content: String,
) -> Result<String, String> {
    let token = get_notion_token()?;
    let client = reqwest::Client::new();

    let blocks: Vec<serde_json::Value> = content
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            if line.starts_with("# ") {
                serde_json::json!({
                    "object": "block",
                    "type": "heading_1",
                    "heading_1": { "rich_text": [{ "text": { "content": line.trim_start_matches("# ") } }] }
                })
            } else if line.starts_with("## ") {
                serde_json::json!({
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": { "rich_text": [{ "text": { "content": line.trim_start_matches("## ") } }] }
                })
            } else {
                serde_json::json!({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": { "rich_text": [{ "text": { "content": line } }] }
                })
            }
        })
        .collect();

    let body = serde_json::json!({ "children": blocks });

    let resp = client
        .patch(format!("https://api.notion.com/v1/blocks/{}/children", page_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("Notion sync error: {}", err));
    }

    Ok(format!("Synced '{}' to Notion page {}", title, page_id))
}
