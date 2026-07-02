use std::path::Path;
use std::process::Command;

#[tauri::command]
pub fn detect_cursor() -> Result<bool, String> {
    Ok(Path::new("/Applications/Cursor.app").exists())
}

#[tauri::command]
pub fn open_in_cursor(folder_path: String) -> Result<(), String> {
    if !Path::new("/Applications/Cursor.app").exists() {
        return Err("Cursor is not installed".to_string());
    }
    Command::new("open")
        .args(["-a", "Cursor", &folder_path])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn run_shell_command(command: String, cwd: Option<String>) -> Result<String, String> {
    let dangerous = ["rm -rf", "sudo", "chmod 777", "git push", "npm install", "pnpm install"];
    for d in dangerous {
        if command.contains(d) {
            return Err(format!("Command requires approval: contains '{}'", d));
        }
    }

    let mut cmd = Command::new("sh");
    cmd.arg("-c").arg(&command);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(format!("Command failed: {}", stderr))
    }
}

#[tauri::command]
pub fn write_cursor_files(
    folder_path: String,
    product_brain: serde_json::Value,
) -> Result<(), String> {
    use std::fs;

    let root = Path::new(&folder_path);
    let rules_dir = root.join(".cursor/rules");
    let tasks_dir = root.join(".cursor/tasks");
    fs::create_dir_all(&rules_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&tasks_dir).map_err(|e| e.to_string())?;

    let project_name = product_brain
        .get("projectName")
        .and_then(|v| v.as_str())
        .unwrap_or("Project");
    let idea = product_brain
        .get("idea")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let vision = product_brain
        .get("vision")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let tech_stack = product_brain
        .get("techStack")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();

    let product_context = format!(
        "---\ndescription: Product context for {}\nalwaysApply: true\n---\n\n# Product Context\n\n## Vision\n{}\n\n## Idea\n{}\n\n## Project\n{}\n",
        project_name, vision, idea, project_name
    );

    let coding_standards = format!(
        "---\ndescription: Coding standards\nalwaysApply: true\n---\n\n# Coding Standards\n\n## Tech Stack\n{}\n\n## Rules\n- Write clean, typed code\n- Follow existing patterns\n- Add tests for new features\n",
        tech_stack
    );

    fs::write(rules_dir.join("product-context.mdc"), product_context)
        .map_err(|e| e.to_string())?;
    fs::write(rules_dir.join("coding-standards.mdc"), coding_standards)
        .map_err(|e| e.to_string())?;
    fs::write(
        rules_dir.join("architecture.mdc"),
        "---\ndescription: Architecture rules\nalwaysApply: true\n---\n\n# Architecture\n\nFollow the architecture defined in docs/architecture.md\n",
    )
    .map_err(|e| e.to_string())?;
    fs::write(
        rules_dir.join("design-system.mdc"),
        "---\ndescription: Design system rules\nalwaysApply: true\n---\n\n# Design System\n\nFollow design system specs in the Product Brain.\n",
    )
    .map_err(|e| e.to_string())?;

    if let Some(features) = product_brain.get("features").and_then(|v| v.as_array()) {
        for (i, feature) in features.iter().enumerate() {
            let title = feature
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Feature");
            let description = feature
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let task_num = format!("{:03}", i + 1);
            let slug = title.to_lowercase().replace(' ', "-");
            let task_content = format!(
                "# Task {} — {}\n\n## Objective\nImplement {}\n\n## Context\n{}\n\n## Steps\n1. Review Product Brain context\n2. Implement the feature\n3. Write tests\n4. Verify acceptance criteria\n\n## Acceptance Criteria\n- [ ] Feature works as described\n- [ ] Tests pass\n- [ ] No regressions\n",
                task_num, title, title, description
            );
            fs::write(tasks_dir.join(format!("{}-{}.md", task_num, slug)), task_content)
                .map_err(|e| e.to_string())?;
        }
    } else {
        let default_task = "# Task 001 — Project Setup\n\n## Objective\nSet up the project foundation.\n\n## Context\nSee Product Brain for full context.\n\n## Steps\n1. Initialize project structure\n2. Configure dependencies\n3. Set up CI/CD\n\n## Acceptance Criteria\n- [ ] Project compiles\n- [ ] Tests pass\n";
        fs::write(tasks_dir.join("001-project-setup.md"), default_task)
            .map_err(|e| e.to_string())?;
    }

    let impl_plan = format!(
        "# Implementation Plan — {}\n\n## Overview\n{}\n\n## Tasks\nSee `.cursor/tasks/` for detailed task files.\n\n## Order\n1. Project setup\n2. Core features\n3. Integrations\n4. QA\n5. Release\n",
        project_name, idea
    );
    fs::write(root.join("implementation-plan.md"), impl_plan).map_err(|e| e.to_string())?;

    Ok(())
}
