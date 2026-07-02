use serde::{Deserialize, Serialize};

use crate::secrets::require_secret;

fn get_github_token() -> Result<String, String> {
    require_secret("builder-os-github", "GitHub token")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub private: bool,
    pub html_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubIssue {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub html_url: String,
}

#[derive(Deserialize)]
struct GHRepoRaw {
    id: u64,
    name: String,
    full_name: String,
    private: bool,
    html_url: String,
}

#[derive(Deserialize)]
struct GHIssueRaw {
    number: u64,
    title: String,
    state: String,
    html_url: String,
}

#[tauri::command]
pub async fn test_github() -> Result<String, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Builder-OS")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let user: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let login = user["login"].as_str().unwrap_or("unknown");
    Ok(format!("GitHub connected as @{}", login))
}

#[tauri::command]
pub async fn list_github_repos() -> Result<Vec<GitHubRepo>, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user/repos?per_page=100&sort=updated")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Builder-OS")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let repos: Vec<GHRepoRaw> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(repos
        .into_iter()
        .map(|r| GitHubRepo {
            id: r.id,
            name: r.name,
            full_name: r.full_name,
            private: r.private,
            html_url: r.html_url,
        })
        .collect())
}

#[tauri::command]
pub async fn create_github_repo(name: String, is_private: bool) -> Result<GitHubRepo, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();
    let body = serde_json::json!({ "name": name, "private": is_private });

    let resp = client
        .post("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Builder-OS")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let r: GHRepoRaw = resp.json().await.map_err(|e| e.to_string())?;
    Ok(GitHubRepo {
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        html_url: r.html_url,
    })
}

#[tauri::command]
pub async fn create_github_issues(
    repo: String,
    user_stories: serde_json::Value,
) -> Result<Vec<GitHubIssue>, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();
    let stories = user_stories.as_array().cloned().unwrap_or_default();
    let mut issues = vec![];

    for story in stories {
        let title = story["title"].as_str().unwrap_or("User Story");
        let as_a = story["asA"].as_str().unwrap_or("");
        let i_want = story["iWant"].as_str().unwrap_or("");
        let so_that = story["soThat"].as_str().unwrap_or("");
        let criteria = story["acceptanceCriteria"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| format!("- [ ] {}", s))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        let body = format!(
            "## User Story\n\n**As a** {}\n**I want** {}\n**So that** {}\n\n## Acceptance Criteria\n{}\n",
            as_a, i_want, so_that, criteria
        );

        let issue_body = serde_json::json!({
            "title": title,
            "body": body,
            "labels": ["product"]
        });

        let resp = client
            .post(format!("https://api.github.com/repos/{}/issues", repo))
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "Builder-OS")
            .json(&issue_body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if resp.status().is_success() {
            let issue: GHIssueRaw = resp.json().await.map_err(|e| e.to_string())?;
            issues.push(GitHubIssue {
                number: issue.number,
                title: issue.title,
                state: issue.state,
                html_url: issue.html_url,
            });
        }
    }

    Ok(issues)
}

#[tauri::command]
pub async fn list_github_issues(repo: String) -> Result<Vec<GitHubIssue>, String> {
    let token = get_github_token()?;
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("https://api.github.com/repos/{}/issues?state=all", repo))
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Builder-OS")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let raw: Vec<GHIssueRaw> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(raw
        .into_iter()
        .map(|i| GitHubIssue {
            number: i.number,
            title: i.title,
            state: i.state,
            html_url: i.html_url,
        })
        .collect())
}
