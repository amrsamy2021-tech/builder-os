mod db;
mod commands;
mod secrets;

use db::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = DbState::new().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::get_projects,
            commands::project::get_project,
            commands::project::update_product_brain,
            commands::project::get_product_brain,
            commands::project::init_workflow_stages,
            commands::project::get_workflow_stages,
            commands::project::update_workflow_stage,
            commands::project::get_deliverables,
            commands::project::save_deliverable,
            commands::project::approve_deliverable,
            commands::project::log_activity,
            commands::project::get_activity_log,
            commands::project::get_integrations,
            commands::project::save_integration,
            commands::project::disconnect_integration,
            commands::filesystem::pick_folder,
            commands::filesystem::scaffold_project,
            commands::filesystem::write_file,
            commands::filesystem::read_file,
            commands::filesystem::file_exists,
            commands::shell::detect_cursor,
            commands::shell::open_in_cursor,
            commands::shell::run_shell_command,
            commands::shell::write_cursor_files,
            commands::openai::save_secret_cmd,
            commands::openai::get_secret_cmd,
            commands::openai::delete_secret_cmd,
            commands::openai::test_openai,
            commands::openai::generate_with_openai,
            commands::github::test_github,
            commands::github::list_github_repos,
            commands::github::create_github_repo,
            commands::github::create_github_issues,
            commands::github::list_github_issues,
            commands::notion::test_notion,
            commands::notion::create_notion_project,
            commands::notion::sync_deliverable_to_notion,
            commands::figma::test_figma,
            commands::figma::fetch_figma_file,
            commands::figma::generate_figma_prompts,
            commands::mcp::list_mcp_servers,
            commands::mcp::read_project_mcp_config,
            commands::mcp::connect_tool_via_mcp,
            commands::mcp::test_mcp_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
