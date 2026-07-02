export type IntegrationTool =
  | "openai"
  | "cursor"
  | "figma"
  | "github"
  | "notion"
  | "filesystem"
  | "shell";

export type IntegrationStatus = "connected" | "disconnected" | "error";
export type ConnectionMode = "mcp" | "api_key" | "local";

export interface IntegrationConfig {
  tool: IntegrationTool;
  status: IntegrationStatus;
  config: Record<string, string>;
  lastSyncAt?: string;
  errorMessage?: string;
}

export interface McpServerInfo {
  name: string;
  source: string;
  transport: string;
  command?: string;
  url?: string;
  mappedTool?: string;
}

export interface ToolCardInfo {
  tool: IntegrationTool;
  name: string;
  description: string;
  connectionMethod: string;
  supportsMcp: boolean;
}

export const TOOL_CARDS: ToolCardInfo[] = [
  {
    tool: "openai",
    name: "OpenAI",
    description: "Generate product deliverables with AI",
    connectionMethod: "API Key",
    supportsMcp: false,
  },
  {
    tool: "cursor",
    name: "Cursor",
    description: "Open projects and generate implementation tasks",
    connectionMethod: "Local App + MCP",
    supportsMcp: true,
  },
  {
    tool: "figma",
    name: "Figma",
    description: "Read design context and generate prompts",
    connectionMethod: "MCP (recommended) or Token",
    supportsMcp: true,
  },
  {
    tool: "github",
    name: "GitHub",
    description: "Create issues and sync engineering tasks",
    connectionMethod: "MCP (recommended) or Token",
    supportsMcp: true,
  },
  {
    tool: "notion",
    name: "Notion",
    description: "Sync project documentation",
    connectionMethod: "MCP (recommended) or Token",
    supportsMcp: true,
  },
  {
    tool: "filesystem",
    name: "Filesystem",
    description: "Manage local project files",
    connectionMethod: "Local Access",
    supportsMcp: false,
  },
  {
    tool: "shell",
    name: "Terminal",
    description: "Run safe local commands",
    connectionMethod: "Local Shell",
    supportsMcp: false,
  },
];

/** Tools that can connect via MCP */
export const MCP_CAPABLE_TOOLS: IntegrationTool[] = [
  "notion",
  "figma",
  "github",
  "cursor",
];
