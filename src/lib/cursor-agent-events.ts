import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAgentJobsStore } from "@/stores/useAgentJobsStore";

let initialized = false;
let unlisteners: UnlistenFn[] = [];

export async function initCursorAgentListeners(): Promise<void> {
  if (initialized) return;
  initialized = true;

  unlisteners.push(
    await listen<{ jobId: string; line: string; stream: string }>(
      "cursor-agent-output",
      (event) => {
        useAgentJobsStore.getState().appendJobOutput(event.payload.jobId, event.payload.line);
      },
    ),
  );

  unlisteners.push(
    await listen<{ jobId: string; success: boolean; output: string; error?: string }>(
      "cursor-agent-done",
      (event) => {
        useAgentJobsStore.getState().markJobStreamDone(event.payload.jobId);
      },
    ),
  );
}

export function teardownCursorAgentListeners(): void {
  for (const unlisten of unlisteners) unlisten();
  unlisteners = [];
  initialized = false;
}
