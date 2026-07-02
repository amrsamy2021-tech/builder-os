import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import type { IntegrationConfig } from "@/types/integrations";

interface IntegrationState {
  integrations: IntegrationConfig[];
  loading: boolean;
  error: string | null;
  fetchIntegrations: () => Promise<void>;
  connect: (tool: string, config: Record<string, string>, secret?: string) => Promise<void>;
  disconnect: (tool: string) => Promise<void>;
  test: (tool: string) => Promise<string>;
  getIntegration: (tool: string) => IntegrationConfig | undefined;
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  integrations: [],
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

  connect: async (tool, config, secret) => {
    set({ loading: true, error: null });
    try {
      if (secret) {
        await commands.saveSecret(`builder-os-${tool}`, secret);
      }
      await commands.saveIntegration(tool, config);
      await get().fetchIntegrations();
      await commands.logActivity(null, "integration_connected", { tool });
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

  getIntegration: (tool) => {
    return get().integrations.find((i) => i.tool === tool);
  },
}));
