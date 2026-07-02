use std::collections::HashMap;

use crate::secrets::require_secret;

fn get_notion_token() -> Result<String, String> {
    require_secret(
        "builder-os-notion",
        "Notion sync token not found. In Connect Tools → Notion, add your Integration Token (MCP alone works in Cursor only — Builder OS needs the token to create pages).",
    )
}

pub fn normalize_notion_page_id(raw: &str) -> String {
    let raw = raw.trim();
    if raw.is_empty() {
        return String::new();
    }

    if raw.contains("notion.so") || raw.contains("notion.site") || raw.contains("notion.com") {
        let path = raw.split('?').next().unwrap_or(raw);
        let segment = path.rsplit('/').next().unwrap_or(path);

        // Standard slug ending: Page-Title-<32 hex>
        if let Some(id) = extract_trailing_hex_id(segment) {
            return format_notion_uuid(id);
        }

        let alnum: String = segment
            .chars()
            .filter(|c| c.is_ascii_hexdigit())
            .collect();
        if alnum.len() >= 32 {
            return format_notion_uuid(&alnum[alnum.len() - 32..]);
        }
        return String::new();
    }

    // UUID embedded anywhere in the string
    if let Some(id) = extract_uuid_substring(raw) {
        return id;
    }

    format_notion_uuid(raw)
}

fn format_notion_uuid(raw: &str) -> String {
    let hex: String = raw
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect();
    if hex.len() != 32 {
        return String::new();
    }
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

pub fn is_valid_notion_page_id(raw: &str) -> bool {
    !normalize_notion_page_id(raw).is_empty()
}

fn is_hex_byte(c: char) -> bool {
    c.is_ascii_digit() || matches!(c, 'a'..='f' | 'A'..='F')
}

fn extract_trailing_hex_id(segment: &str) -> Option<&str> {
    if segment.len() >= 32 && segment.chars().all(is_hex_byte) {
        return Some(segment);
    }
    if segment.len() > 33 {
        let (prefix, id) = segment.split_at(segment.len() - 32);
        if id.chars().all(is_hex_byte) {
            let boundary = prefix.chars().last()?;
            if boundary == '-' || prefix.is_empty() {
                return Some(id);
            }
        }
    }
    None
}

fn extract_uuid_substring(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    if bytes.len() < 36 {
        return None;
    }
    for i in 0..=(bytes.len() - 36) {
        let slice = &raw[i..i + 36];
        let chars: Vec<char> = slice.chars().collect();
        if chars.len() != 36 {
            continue;
        }
        let dashes = [8, 13, 18, 23];
        if dashes.iter().all(|&idx| chars[idx] == '-')
            && chars
                .iter()
                .enumerate()
                .all(|(idx, c)| dashes.contains(&idx) || is_hex_byte(*c))
        {
            return Some(slice.to_lowercase());
        }
    }
    None
}

fn rich_text(content: &str) -> serde_json::Value {
    serde_json::json!([{ "type": "text", "text": { "content": content } }])
}

fn chunk_text(text: &str, max_len: usize) -> Vec<String> {
    if text.len() <= max_len {
        return vec![text.to_string()];
    }

    let mut chunks = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let mut end = (start + max_len).min(text.len());
        if end < text.len() {
            if let Some(pos) = text[start..end].rfind(' ') {
                end = start + pos;
            }
        }
        if end <= start {
            end = (start + max_len).min(text.len());
        }
        chunks.push(text[start..end].trim().to_string());
        start = end;
    }
    chunks
}

fn line_to_blocks(line: &str) -> Vec<serde_json::Value> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return vec![];
    }

    let (block_type, text) = if trimmed.starts_with("### ") {
        ("heading_3", trimmed.trim_start_matches("### "))
    } else if trimmed.starts_with("## ") {
        ("heading_2", trimmed.trim_start_matches("## "))
    } else if trimmed.starts_with("# ") {
        ("heading_1", trimmed.trim_start_matches("# "))
    } else if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
        (
            "bulleted_list_item",
            trimmed.trim_start_matches("- ").trim_start_matches("* "),
        )
    } else {
        ("paragraph", trimmed)
    };

    chunk_text(text, 1900)
        .into_iter()
        .map(|chunk| {
            serde_json::json!({
                "object": "block",
                "type": block_type,
                block_type: { "rich_text": rich_text(&chunk) }
            })
        })
        .collect()
}

fn content_to_blocks(content: &str) -> Vec<serde_json::Value> {
    let mut blocks = Vec::new();
    for line in content.lines() {
        blocks.extend(line_to_blocks(line));
    }
    if blocks.is_empty() {
        blocks.extend(line_to_blocks(content));
    }
    blocks
}

async fn append_blocks(
    client: &reqwest::Client,
    token: &str,
    page_id: &str,
    blocks: Vec<serde_json::Value>,
) -> Result<(), String> {
    for chunk in blocks.chunks(100) {
        let body = serde_json::json!({ "children": chunk });
        let resp = client
            .patch(format!(
                "https://api.notion.com/v1/blocks/{}/children",
                page_id
            ))
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
    }
    Ok(())
}

async fn archive_all_block_children(
    client: &reqwest::Client,
    token: &str,
    page_id: &str,
) -> Result<(), String> {
    loop {
        let resp = client
            .get(format!(
                "https://api.notion.com/v1/blocks/{}/children?page_size=100",
                page_id
            ))
            .header("Authorization", format!("Bearer {}", token))
            .header("Notion-Version", "2022-06-28")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let err = resp.text().await.unwrap_or_default();
            return Err(format!("Notion read blocks error: {}", err));
        }

        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let results = body["results"].as_array().cloned().unwrap_or_default();
        let has_more = body["has_more"].as_bool().unwrap_or(false);
        let empty = results.is_empty();

        for block in &results {
            if let Some(block_id) = block["id"].as_str() {
                let archive_resp = client
                    .patch(format!("https://api.notion.com/v1/blocks/{}", block_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .header("Notion-Version", "2022-06-28")
                    .header("Content-Type", "application/json")
                    .json(&serde_json::json!({ "archived": true }))
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if !archive_resp.status().is_success() {
                    let err = archive_resp.text().await.unwrap_or_default();
                    return Err(format!("Notion archive block error: {}", err));
                }
            }
        }

        if !has_more || empty {
            break;
        }
    }
    Ok(())
}

async fn create_deliverable_page(
    client: &reqwest::Client,
    token: &str,
    project_page_id: &str,
    title: &str,
    content: &str,
) -> Result<(String, String), String> {
    let blocks = content_to_blocks(content);
    let children: Vec<serde_json::Value> = blocks.iter().take(100).cloned().collect();

    let body = serde_json::json!({
        "parent": { "type": "page_id", "page_id": project_page_id },
        "properties": {
            "title": {
                "title": [{ "text": { "content": title } }]
            }
        },
        "children": children
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
    let page_id = normalize_notion_page_id(page["id"].as_str().unwrap_or(""));
    if page_id.is_empty() {
        return Err("Notion returned an invalid page ID".to_string());
    }
    let page_url = page["url"].as_str().unwrap_or("").to_string();

    if blocks.len() > 100 {
        append_blocks(client, token, &page_id, blocks[100..].to_vec()).await?;
    }

    Ok((page_id, page_url))
}

async fn update_deliverable_page(
    client: &reqwest::Client,
    token: &str,
    deliverable_page_id: &str,
    title: &str,
    content: &str,
) -> Result<(), String> {
    let patch_resp = client
        .patch(format!(
            "https://api.notion.com/v1/pages/{}",
            deliverable_page_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "properties": {
                "title": {
                    "title": [{ "text": { "content": title } }]
                }
            }
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !patch_resp.status().is_success() {
        let err = patch_resp.text().await.unwrap_or_default();
        return Err(format!("Notion update page error: {}", err));
    }

    archive_all_block_children(client, token, deliverable_page_id).await?;
    append_blocks(
        client,
        token,
        deliverable_page_id,
        content_to_blocks(content),
    )
    .await
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
        let status = resp.status();
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("Notion API error: {} — {}", status, err));
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

    let parent = if let Some(pid) = parent_page_id.filter(|p| !p.trim().is_empty()) {
        let normalized = normalize_notion_page_id(&pid);
        if normalized.is_empty() {
            return Err("Invalid Notion parent page ID or URL".to_string());
        }
        serde_json::json!({ "type": "page_id", "page_id": normalized })
    } else {
        return Err(
            "A parent Notion page is required. Paste a page URL or ID where Builder OS can create project pages.".to_string(),
        );
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
    let page_id_raw = page["id"].as_str().unwrap_or("");
    let page_id = normalize_notion_page_id(page_id_raw);
    if page_id.is_empty() {
        return Err("Notion returned an invalid page ID".to_string());
    }
    let page_url = page["url"].as_str().unwrap_or("").to_string();

    let mut result = HashMap::new();
    result.insert("projectPageId".to_string(), page_id.clone());
    result.insert("projectPageUrl".to_string(), page_url);

    Ok(result)
}

#[tauri::command]
pub async fn sync_deliverable_to_notion(
    project_page_id: String,
    title: String,
    content: String,
    deliverable_page_id: Option<String>,
) -> Result<HashMap<String, String>, String> {
    let token = get_notion_token()?;
    let client = reqwest::Client::new();

    if !is_valid_notion_page_id(&project_page_id) {
        return Err(format!(
            "Invalid project Notion page: \"{}\". Create Notion pages in Project Integrations first.",
            project_page_id.trim()
        ));
    }

    let project_id = normalize_notion_page_id(&project_page_id);

    if content.trim().is_empty() {
        return Err("Deliverable content is empty — nothing to sync".to_string());
    }

    let (page_id, page_url, message) =
        if let Some(existing) = deliverable_page_id.filter(|p| !p.trim().is_empty()) {
            if !is_valid_notion_page_id(&existing) {
                return Err("Stored deliverable Notion page ID is invalid".to_string());
            }
            let normalized = normalize_notion_page_id(&existing);
            update_deliverable_page(&client, &token, &normalized, &title, &content).await?;
            (
                normalized,
                String::new(),
                format!("Updated Notion page for '{}'", title),
            )
        } else {
            let (id, url) =
                create_deliverable_page(&client, &token, &project_id, &title, &content).await?;
            (
                id,
                url,
                format!("Created Notion page for '{}'", title),
            )
        };

    let mut result = HashMap::new();
    result.insert("pageId".to_string(), page_id);
    if !page_url.is_empty() {
        result.insert("pageUrl".to_string(), page_url);
    }
    result.insert("message".to_string(), message);
    Ok(result)
}

#[tauri::command]
pub async fn sync_screen_to_notion(
    project_page_id: String,
    screen_name: String,
    content: String,
    screen_page_id: Option<String>,
) -> Result<HashMap<String, String>, String> {
    sync_deliverable_to_notion(
        project_page_id,
        format!("Screen: {}", screen_name),
        content,
        screen_page_id,
    )
    .await
}
