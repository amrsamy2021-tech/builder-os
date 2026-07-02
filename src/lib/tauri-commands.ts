import { invoke } from "@tauri-apps/api/core";
import type { ProductBrain, Project } from "@/types/product-brain";
import type { WorkflowStageState } from "@/types/workflow";
import type { IntegrationConfig } from "@/types/integrations";

export interface Deliverable {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content: string;
  status: "draft" | "approved" | "synced";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  projectId?: string;
  action: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  folderPath: string;
  productBrain: ProductBrain;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
}

export interface FigmaFileContext {
  name: string;
  pages: { id: string; name: string }[];
  components: { id: string; name: string }[];
}

export const commands = {
  // Projects
  createProject: (input: CreateProjectInput) =>
    invoke<Project>("create_project", { input }),
  getProjects: () => invoke<Project[]>("get_projects"),
  getProject: (id: string) => invoke<Project>("get_project", { id }),
  updateProductBrain: (projectId: string, data: ProductBrain) =>
    invoke<void>("update_product_brain", { projectId, data }),
  getProductBrain: (projectId: string) =>
    invoke<ProductBrain>("get_product_brain", { projectId }),

  // Workflow
  getWorkflowStages: (projectId: string) =>
    invoke<WorkflowStageState[]>("get_workflow_stages", { projectId }),
  updateWorkflowStage: (projectId: string, stage: WorkflowStageState) =>
    invoke<void>("update_workflow_stage", { projectId, stage }),
  initWorkflowStages: (projectId: string) =>
    invoke<void>("init_workflow_stages", { projectId }),

  // Deliverables
  getDeliverables: (projectId: string) =>
    invoke<Deliverable[]>("get_deliverables", { projectId }),
  saveDeliverable: (deliverable: Omit<Deliverable, "createdAt" | "updatedAt">) =>
    invoke<Deliverable>("save_deliverable", { deliverable }),
  approveDeliverable: (id: string) =>
    invoke<Deliverable>("approve_deliverable", { id }),

  // Activity log
  logActivity: (projectId: string | null, action: string, details?: Record<string, unknown>) =>
    invoke<void>("log_activity", { projectId, action, details }),
  getActivityLog: (projectId?: string) =>
    invoke<ActivityLogEntry[]>("get_activity_log", { projectId }),

  // Filesystem
  pickFolder: () => invoke<string | null>("pick_folder"),
  scaffoldProject: (folderPath: string, productBrain: ProductBrain) =>
    invoke<void>("scaffold_project", { folderPath, productBrain }),
  writeFile: (path: string, content: string, overwrite?: boolean) =>
    invoke<void>("write_file", { path, content, overwrite }),
  readFile: (path: string) => invoke<string>("read_file", { path }),
  fileExists: (path: string) => invoke<boolean>("file_exists", { path }),

  // Integrations config
  getIntegrations: () => invoke<IntegrationConfig[]>("get_integrations"),
  saveIntegration: (tool: string, config: Record<string, string>) =>
    invoke<void>("save_integration", { tool, config }),
  disconnectIntegration: (tool: string) =>
    invoke<void>("disconnect_integration", { tool }),

  // Keychain
  saveSecret: (key: string, value: string) =>
    invoke<void>("save_secret", { key, value }),
  getSecret: (key: string) => invoke<string | null>("get_secret", { key }),
  deleteSecret: (key: string) => invoke<void>("delete_secret", { key }),

  // OpenAI
  testOpenAI: (model?: string) => invoke<string>("test_openai", { model }),
  generateWithOpenAI: (
    agentType: string,
    productBrain: ProductBrain,
    deliverableType: string,
    model?: string,
  ) =>
    invoke<string>("generate_with_openai", {
      agentType,
      productBrain,
      deliverableType,
      model,
    }),

  // Cursor
  detectCursor: () => invoke<boolean>("detect_cursor"),
  openInCursor: (folderPath: string) =>
    invoke<void>("open_in_cursor", { folderPath }),
  writeCursorFiles: (folderPath: string, productBrain: ProductBrain) =>
    invoke<void>("write_cursor_files", { folderPath, productBrain }),

  // GitHub
  testGitHub: () => invoke<string>("test_github"),
  listGitHubRepos: () => invoke<GitHubRepo[]>("list_github_repos"),
  createGitHubRepo: (name: string, isPrivate: boolean) =>
    invoke<GitHubRepo>("create_github_repo", { name, isPrivate }),
  createGitHubIssues: (
    repo: string,
    userStories: ProductBrain["userStories"],
  ) => invoke<GitHubIssue[]>("create_github_issues", { repo, userStories }),
  listGitHubIssues: (repo: string) =>
    invoke<GitHubIssue[]>("list_github_issues", { repo }),

  // Notion
  testNotion: () => invoke<string>("test_notion"),
  createNotionProject: (projectName: string, parentPageId?: string) =>
    invoke<Record<string, string>>("create_notion_project", {
      projectName,
      parentPageId,
    }),
  syncDeliverableToNotion: (
    pageId: string,
    title: string,
    content: string,
  ) => invoke<string>("sync_deliverable_to_notion", { pageId, title, content }),

  // Figma
  testFigma: () => invoke<string>("test_figma"),
  fetchFigmaFile: (fileUrl: string) =>
    invoke<FigmaFileContext>("fetch_figma_file", { fileUrl }),
  generateFigmaPrompts: (productBrain: ProductBrain) =>
    invoke<string>("generate_figma_prompts", { productBrain }),

  // Shell
  runShellCommand: (command: string, cwd?: string) =>
    invoke<string>("run_shell_command", { command, cwd }),
};
