use keyring::Entry;
use serde::{Deserialize, Serialize};

#[tauri::command]
pub fn save_secret(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new("builder-os", &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new("builder-os", &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
    let entry = Entry::new("builder-os", &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn get_api_key(service: &str) -> Result<String, String> {
    let entry = Entry::new("builder-os", service).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[tauri::command]
pub async fn test_openai(model: Option<String>) -> Result<String, String> {
    let api_key = get_api_key("builder-os-openai")?;
    let model = model.unwrap_or_else(|| "gpt-4o".to_string());

    let client = reqwest::Client::new();
    let body = OpenAIRequest {
        model: model.clone(),
        messages: vec![OpenAIMessage {
            role: "user".to_string(),
            content: "Say 'Connection successful' in exactly those words.".to_string(),
        }],
    };

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", err));
    }

    let data: OpenAIResponse = resp.json().await.map_err(|e| e.to_string())?;
    let message = data
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "Connected".to_string());

    Ok(format!("OpenAI connected ({}): {}", model, message))
}

#[tauri::command]
pub async fn generate_with_openai(
    agent_type: String,
    product_brain: serde_json::Value,
    deliverable_type: String,
    model: Option<String>,
) -> Result<String, String> {
    let api_key = get_api_key("builder-os-openai")?;
    let model = model.unwrap_or_else(|| "gpt-4o".to_string());

    let context = product_brain.to_string();
    let prompt = format!(
        "You are a {} agent for Builder OS. Generate a detailed {} based on this Product Brain context. Return well-structured markdown.\n\nProduct Brain:\n{}\n\nGenerate {}",
        agent_type, deliverable_type, context, deliverable_type
    );

    let client = reqwest::Client::new();
    let body = OpenAIRequest {
        model,
        messages: vec![OpenAIMessage {
            role: "user".to_string(),
            content: prompt,
        }],
    };

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", err));
    }

    let data: OpenAIResponse = resp.json().await.map_err(|e| e.to_string())?;
    data.choices
        .first()
        .map(|c| c.message.content.clone())
        .ok_or_else(|| "No response from OpenAI".to_string())
}
