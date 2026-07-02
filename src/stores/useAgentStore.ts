import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import type { ProductBrain } from "@/types/product-brain";

interface AgentState {
  generating: boolean;
  streamingContent: string;
  error: string | null;
  currentAgent: string | null;
  generate: (
    agentType: string,
    productBrain: ProductBrain,
    deliverableType: string,
    model?: string,
  ) => Promise<string>;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  generating: false,
  streamingContent: "",
  error: null,
  currentAgent: null,

  generate: async (agentType, productBrain, deliverableType, model) => {
    set({
      generating: true,
      streamingContent: "",
      error: null,
      currentAgent: agentType,
    });
    try {
      const content = await commands.generateWithOpenAI(
        agentType,
        productBrain,
        deliverableType,
        model,
      );
      set({ generating: false, streamingContent: content });
      await commands.logActivity(productBrain.id, "ai_generated", {
        agentType,
        deliverableType,
      });
      return content;
    } catch (e) {
      set({ generating: false, error: String(e) });
      throw e;
    }
  },

  reset: () =>
    set({
      generating: false,
      streamingContent: "",
      error: null,
      currentAgent: null,
    }),
}));
