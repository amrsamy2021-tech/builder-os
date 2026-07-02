import { create } from "zustand";
import { commands, type ActivityLogEntry } from "@/lib/tauri-commands";

interface ActivityLogState {
  entries: ActivityLogEntry[];
  loading: boolean;
  fetch: (projectId?: string) => Promise<void>;
  log: (
    projectId: string | null,
    action: string,
    details?: Record<string, unknown>,
  ) => Promise<void>;
}

export const useActivityLogStore = create<ActivityLogState>((set) => ({
  entries: [],
  loading: false,

  fetch: async (projectId) => {
    set({ loading: true });
    try {
      const entries = await commands.getActivityLog(projectId);
      set({ entries, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  log: async (projectId, action, details) => {
    await commands.logActivity(projectId, action, details);
  },
}));
