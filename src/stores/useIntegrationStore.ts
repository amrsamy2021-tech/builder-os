import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import { runWithLoading } from "@/stores/useLoadingStore";
import type { IntegrationConfig, McpServerInfo } from "@/types/integrations";

interface IntegrationState {
  integrations: IntegrationConfig[];
  mcpServers: McpServerInfo[];
  notionSyncReady: boolean;
  loading: boolean;
  error: string | null;
  fetchIntegrations: () => Promise<void>;
  fetchMcpServers: () => Promise<void>;
  checkNotionSyncReady: () => Promise<boolean>;
  saveNotionSyncToken: (token: string) => Promise<void>;
  connect: (tool: string, config: Record<string, string>, secret?: string) => Promise<void>;
  connectViaMcp: (tool: string, mcpServerName: string, folderPath?: string, syncToken?: string) => Promise<void>;
  disconnect: (tool: string) => Promise<void>;
  test: (tool: string) => Promise<string>;
  testMcp: (mcpServerName: string) => Promise<string>;
  getIntegration: (tool: string) => IntegrationConfig | undefined;
  getMcpServerForTool: (tool: string) => McpServerInfo | undefined;
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  integrations: [],
  mcpServers: [],
  notionSyncReady: false,
  loading: false,
  error: null,

  checkNotionSyncReady: async () => {
    try {
      const ready = await commands.hasSecret("builder-os-notion");
      set({ notionSyncReady: ready });
      return ready;
    } catch {
      set({ notionSyncReady: false });
      return false;
    }
  },

  saveNotionSyncToken: async (token) => {
    return runWithLoading("Saving Notion sync token...", async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new Error("Please paste your Notion integration token");
    }
    await commands.saveSecret("builder-os-notion", trimmed);
    const verified = await commands.hasSecret("builder-os-notion");
    if (!verified) {
      throw new Error("Token could not be verified after save");
    }
    const existing = get().getIntegration("notion");
    await commands.saveIntegration("notion", {
      ...existing?.config,
      mode: existing?.config?.mode ?? "mcp",
      connected: "true",
      syncTokenSaved: "true",
    });
    await get().fetchIntegrations();
    set({ notionSyncReady: true });
    await commands.logActivity(null, "notion_sync_token_saved", {});
    });
  },

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
    return runWithLoading(`Connecting ${tool}...`, async () => {
    set({ loading: true, error: null });
    try {
      if (secret) {
        await commands.saveSecret(`builder-os-${tool}`, secret);
        const verified = await commands.hasSecret(`builder-os-${tool}`);
        if (!verified) {
          throw new Error(`${tool} key saved but could not be verified`);
        }
      }
      await commands.saveIntegration(tool, { ...config, mode: "api_key", connected: "true", syncTokenSaved: secret ? "true" : "false" });
      await get().fetchIntegrations();
      if (tool === "notion") {
        await get().checkNotionSyncReady();
      }
      await commands.logActivity(null, "integration_connected", { tool, mode: "api_key" });
      set({ loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
    });
  },

  connectViaMcp: async (tool, mcpServerName, folderPath, syncToken) => {
    return runWithLoading(`Connecting ${tool}...`, async () => {
    set({ loading: true, error: null });
    try {
      const server = await commands.connectToolViaMcp(tool, mcpServerName, folderPath);
      await commands.saveIntegration(tool, {
        mode: "mcp",
        mcpServer: mcpServerName,
        transport: server.transport,
        connected: "true",
        syncTokenSaved: syncToken ? "true" : get().getIntegration(tool)?.config?.syncTokenSaved ?? "false",
      });
      if (tool === "notion" && syncToken?.trim()) {
        await get().saveNotionSyncToken(syncToken);
      }
      await get().fetchIntegrations();
      await get().fetchMcpServers();
      await get().checkNotionSyncReady();
      await commands.logActivity(null, "integration_connected", {
        tool,
        mode: "mcp",
        mcpServer: mcpServerName,
      });
      set({ loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
    });
  },

  disconnect: async (tool) => {
    await commands.disconnectIntegration(tool);
    if (tool === "notion") {
      await commands.deleteSecret(`builder-os-${tool}`);
      set({ notionSyncReady: false });
    } else {
      await commands.deleteSecret(`builder-os-${tool}`);
    }
    await get().fetchIntegrations();
  },

  test: async (tool) => {
    if (tool === "notion") {
      const ready = await get().checkNotionSyncReady();
      if (ready) {
        return commands.testNotion();
      }
    }
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
