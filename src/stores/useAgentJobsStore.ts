import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import { runWithLoading } from "@/stores/useLoadingStore";

export type AgentJobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type AgentJobMode = "local" | "cloud";

export interface AgentJob {
  id: string;
  projectId: string;
  folderPath: string;
  screenId?: string;
  deliverableType?: string;
  label: string;
  prompt: string;
  mode: AgentJobMode;
  status: AgentJobStatus;
  output?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

interface AgentJobsState {
  jobs: AgentJob[];
  activeJobId: string | null;
  enqueueJob: (input: {
    projectId: string;
    folderPath: string;
    label: string;
    prompt: string;
    mode?: AgentJobMode;
    screenId?: string;
    deliverableType?: string;
  }) => Promise<AgentJob>;
  getProjectJobs: (projectId: string) => AgentJob[];
  clearFinished: () => void;
}

export const useAgentJobsStore = create<AgentJobsState>((set, get) => ({
  jobs: [],
  activeJobId: null,

  enqueueJob: async (input) => {
    const job: AgentJob = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      folderPath: input.folderPath,
      screenId: input.screenId,
      deliverableType: input.deliverableType,
      label: input.label,
      prompt: input.prompt,
      mode: input.mode ?? "local",
      status: "queued",
      startedAt: new Date().toISOString(),
    };

    set((state) => ({
      jobs: [job, ...state.jobs],
      activeJobId: job.id,
    }));

    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === job.id ? { ...j, status: "running" as const } : j,
      ),
    }));

    try {
      const output = await runWithLoading(`Running: ${input.label}`, async () =>
        commands.runCursorAgent({
          folderPath: input.folderPath,
          prompt: input.prompt,
          mode: input.mode ?? "local",
        }),
      );

      const finishedAt = new Date().toISOString();
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === job.id
            ? { ...j, status: "done" as const, output, finishedAt }
            : j,
        ),
        activeJobId: state.activeJobId === job.id ? null : state.activeJobId,
      }));

      await commands.logActivity(input.projectId, "cursor_agent_done", {
        label: input.label,
        screenId: input.screenId,
      });

      return { ...job, status: "done", output, finishedAt };
    } catch (e) {
      const error = String(e);
      const finishedAt = new Date().toISOString();
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === job.id
            ? { ...j, status: "failed" as const, error, finishedAt }
            : j,
        ),
        activeJobId: state.activeJobId === job.id ? null : state.activeJobId,
      }));
      throw e;
    }
  },

  getProjectJobs: (projectId) => get().jobs.filter((j) => j.projectId === projectId),

  clearFinished: () =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.status === "queued" || j.status === "running"),
    })),
}));

export type AgentProvider = "cursor" | "openai" | "cursor_with_openai_fallback";

export async function getAgentProvider(): Promise<AgentProvider> {
  const integrations = await commands.getIntegrations();
  const cursorConfig = integrations.find((i) => i.tool === "cursor");
  const provider = cursorConfig?.config?.defaultProvider;
  if (
    provider === "openai" ||
    provider === "cursor" ||
    provider === "cursor_with_openai_fallback"
  ) {
    return provider;
  }
  const hasCursor = await commands.hasSecret("builder-os-cursor-api");
  return hasCursor ? "cursor" : "openai";
}

export async function isCursorReady(): Promise<boolean> {
  try {
    const [hasKey, hasCli] = await Promise.all([
      commands.hasSecret("builder-os-cursor-api"),
      commands.detectCursorCli(),
    ]);
    return hasKey && hasCli;
  } catch {
    return false;
  }
}
