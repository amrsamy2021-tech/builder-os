import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";

export type AgentJobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type AgentJobMode = "local" | "cloud";
export type AgentProvider = "cursor" | "openai" | "cursor_with_openai_fallback";

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
  liveOutput?: string;
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
  appendJobOutput: (jobId: string, line: string) => void;
  markJobStreamDone: (jobId: string) => void;
  cancelJob: (jobId: string) => Promise<void>;
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
      liveOutput: "",
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
      const output = await commands.runCursorAgent({
        jobId: job.id,
        folderPath: input.folderPath,
        prompt: input.prompt,
        mode: input.mode ?? "local",
      });

      const finishedAt = new Date().toISOString();
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: "done" as const,
                output,
                liveOutput: j.liveOutput || output,
                finishedAt,
              }
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
      const current = get().jobs.find((j) => j.id === job.id);
      if (current?.status === "cancelled") {
        return { ...current, finishedAt };
      }
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

  appendJobOutput: (jobId, line) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? { ...j, liveOutput: `${j.liveOutput ?? ""}${line}\n` }
          : j,
      ),
    }));
  },

  markJobStreamDone: (jobId) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId && j.status === "running"
          ? { ...j, output: j.liveOutput ?? j.output }
          : j,
      ),
    }));
  },

  cancelJob: async (jobId) => {
    try {
      await commands.cancelCursorAgent(jobId);
    } catch {
      // Job may have already finished
    }
    const finishedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? { ...j, status: "cancelled" as const, error: "Cancelled by user", finishedAt }
          : j,
      ),
      activeJobId: state.activeJobId === jobId ? null : state.activeJobId,
    }));
  },

  getProjectJobs: (projectId) => get().jobs.filter((j) => j.projectId === projectId),

  clearFinished: () =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.status === "queued" || j.status === "running"),
    })),
}));

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

export async function isAnyAgentReady(): Promise<boolean> {
  const [cursorReady, hasOpenAI] = await Promise.all([
    isCursorReady(),
    commands.hasSecret("builder-os-openai"),
  ]);
  return cursorReady || hasOpenAI;
}
