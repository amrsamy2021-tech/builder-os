import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import type { IntegrationConfig, McpServerInfo } from "@/types/integrations";

interface IntegrationState {
  integrations: IntegrationConfig[];
  mcpServers: McpServerInfo[];
  loading: boolean;
  error: string | null;
  fetchIntegrations: () => Promise<void>;
  fetchMcpServers: () => Promise<void>;
  connect: (tool: string, config: Record<string, string>, secret?: string) => Promise<void>;
  connectViaMcp: (tool: string, mcpServerName: string, folderPath?: string) => Promise<void>;
  disconnect: (tool: string) => Promise<void>;
  test: (tool: string) => Promise<string>;
  testMcp: (mcpServerName: string) => Promise<string>;
  getIntegration: (tool: string) => IntegrationConfig | undefined;
  getMcpServerForTool: (tool: string) => McpServerInfo | undefined;
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  integrations: [],
  mcpServers: [],
  loading: false,
  error: null,

  fetchIntegrations: async () => {
    set({ loading: true });
    try {
      const integrations = await commands.getIntegrations();
      set({ integrations, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchMcpServers: async () => {
    try {
      const mcpServers = await commands.listMcpServers();
      set({ mcpServers });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  connect: async (tool, config, secret) => {
    set({ loading: true, error: null });
    try {
      if (secret) {
        await commands.saveSecret(`builder-os-${tool}`, secret);
      }
      await commands.saveIntegration(tool, { ...config, mode: "api_key", connected: "true" });
      await get().fetchIntegrations();
      await commands.logActivity(null, "integration_connected", { tool, mode: "api_key" });
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
  },

  connectViaMcp: async (tool, mcpServerName, folderPath) => {
    set({ loading: true, error: null });
    try {
      const server = await commands.connectToolViaMcp(tool, mcpServerName, folderPath);
      await commands.saveIntegration(tool, {
        mode: "mcp",
        mcpServer: mcpServerName,
        transport: server.transport,
        connected: "true",
      });
      await get().fetchIntegrations();
      await get().fetchMcpServers();
      await commands.logActivity(null, "integration_connected", {
        tool,
        mode: "mcp",
        mcpServer: mcpServerName,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
  },

  disconnect: async (tool) => {
    await commands.disconnectIntegration(tool);
    await commands.deleteSecret(`builder-os-${tool}`);
    await get().fetchIntegrations();
  },

  test: async (tool) => {
    const integration = get().getIntegration(tool);
    if (integration?.config?.mode === "mcp" && integration.config.mcpServer) {
      return get().testMcp(integration.config.mcpServer);
    }
    switch (tool) {
      case "openai":
        return commands.testOpenAI();
      case "github":
        return commands.testGitHub();
      case "notion":
        return commands.testNotion();
      case "figma":
        return commands.testFigma();
      case "cursor":
        return (await commands.detectCursor())
          ? "Cursor detected"
          : "Cursor not found";
      default:
        return "Connected";
    }
  },

  testMcp: async (mcpServerName) => commands.testMcpConnection(mcpServerName),

  getIntegration: (tool) => get().integrations.find((i) => i.tool === tool),

  getMcpServerForTool: (tool) =>
    get().mcpServers.find(
      (s) => s.mappedTool === tool || s.name.toLowerCase().includes(tool),
    ),
}));
