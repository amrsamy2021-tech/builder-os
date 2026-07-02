export type IntegrationTool =
  | "openai"
  | "cursor"
  | "figma"
  | "github"
  | "notion"
  | "filesystem"
  | "shell";

export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface IntegrationConfig {
  tool: IntegrationTool;
  status: IntegrationStatus;
  config: Record<string, string>;
  lastSyncAt?: string;
  errorMessage?: string;
}

export interface ToolCardInfo {
  tool: IntegrationTool;
  name: string;
  description: string;
  connectionMethod: string;
}

export const TOOL_CARDS: ToolCardInfo[] = [
  {
    tool: "openai",
    name: "OpenAI",
    description: "Generate product deliverables with AI",
    connectionMethod: "API Key",
  },
  {
    tool: "cursor",
    name: "Cursor",
    description: "Open projects and generate implementation tasks",
    connectionMethod: "Local App Detection",
  },
  {
    tool: "figma",
    name: "Figma",
    description: "Read design context and generate prompts",
    connectionMethod: "Personal Access Token",
  },
  {
    tool: "github",
    name: "GitHub",
    description: "Create issues and sync engineering tasks",
    connectionMethod: "Personal Access Token",
  },
  {
    tool: "notion",
    name: "Notion",
    description: "Sync project documentation",
    connectionMethod: "Integration Token",
  },
  {
    tool: "filesystem",
    name: "Filesystem",
    description: "Manage local project files",
    connectionMethod: "Local Access",
  },
  {
    tool: "shell",
    name: "Terminal",
    description: "Run safe local commands",
    connectionMethod: "Local Shell",
  },
];
