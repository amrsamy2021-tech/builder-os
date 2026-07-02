import { buildAgentPrompt } from "@/features/agents/prompts";
import { importAllFromDeliverables } from "@/lib/screen-import";
import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import { runWithLoading } from "@/stores/useLoadingStore";
import { getAgentProvider, isCursorReady, useAgentJobsStore } from "@/stores/useAgentJobsStore";
import type { ProductBrain } from "@/types/product-brain";

interface AgentState {
  generating: boolean;
  streamingContent: string;
  error: string | null;
  currentAgent: string | null;
  taskLabel: string | null;
  generate: (
    agentType: string,
    productBrain: ProductBrain,
    deliverableType: string,
    taskLabel?: string,
    model?: string,
    folderPath?: string,
  ) => Promise<string>;
  reset: () => void;
}

async function generateWithCursor(
  agentType: string,
  productBrain: ProductBrain,
  deliverableType: string,
  taskLabel: string,
  folderPath: string,
  onStream?: (text: string) => void,
): Promise<string> {
  const prompt = buildAgentPrompt(agentType, productBrain, deliverableType);
  const unsub = useAgentJobsStore.subscribe((state, prevState) => {
    if (state.jobs === prevState.jobs) return;
    const running = state.jobs.find(
      (j) => j.status === "running" && j.label === taskLabel && j.projectId === productBrain.id,
    );
    if (running?.liveOutput && onStream) onStream(running.liveOutput);
  });

  try {
    const job = await useAgentJobsStore.getState().enqueueJob({
      projectId: productBrain.id,
      folderPath,
      label: taskLabel,
      prompt,
      deliverableType,
      mode: productBrain.preferredAgentMode === "cloud" ? "cloud" : "local",
    });
    return job.output ?? job.liveOutput ?? "";
  } finally {
    unsub();
  }
}

export const useAgentStore = create<AgentState>((set) => ({
  generating: false,
  streamingContent: "",
  error: null,
  currentAgent: null,
  taskLabel: null,

  generate: async (agentType, productBrain, deliverableType, taskLabel, model, folderPath) => {
    const label = taskLabel ?? deliverableType;
    return runWithLoading(`Generating ${label}`, async () => {
      set({
        generating: true,
        streamingContent: "",
        error: null,
        currentAgent: agentType,
        taskLabel: label,
      });

      try {
        const provider = await getAgentProvider();
        const cursorReady = folderPath ? await isCursorReady() : false;
        let content = "";

        if (
          folderPath &&
          cursorReady &&
          (provider === "cursor" || provider === "cursor_with_openai_fallback")
        ) {
          try {
            content = await generateWithCursor(
              agentType,
              productBrain,
              deliverableType,
              label,
              folderPath,
              (text) => set({ streamingContent: text }),
            );
          } catch (cursorError) {
            if (provider !== "cursor_with_openai_fallback") throw cursorError;
            content = await commands.generateWithOpenAI(
              agentType,
              productBrain,
              deliverableType,
              model,
            );
          }
        } else {
          content = await commands.generateWithOpenAI(
            agentType,
            productBrain,
            deliverableType,
            model,
          );
        }

        set({ generating: false, streamingContent: content, taskLabel: null });
        await commands.logActivity(productBrain.id, "ai_generated", {
          agentType,
          deliverableType,
          provider: cursorReady ? provider : "openai",
        });
        return content;
      } catch (e) {
        set({ generating: false, error: String(e), taskLabel: null });
        throw e;
      }
    });
  },

  reset: () =>
    set({
      generating: false,
      streamingContent: "",
      error: null,
      currentAgent: null,
      taskLabel: null,
    }),
}));

export async function autoImportAfterGenerate(
  brain: ProductBrain,
  deliverables: import("@/lib/tauri-commands").Deliverable[],
): Promise<ProductBrain> {
  const result = importAllFromDeliverables(brain, deliverables);
  return result.brain;
}
