import { create } from "zustand";
import { commands, type Deliverable } from "@/lib/tauri-commands";

interface DeliverablesState {
  deliverables: Record<string, Deliverable[]>;
  loading: boolean;
  fetchDeliverables: (projectId: string) => Promise<void>;
  saveDeliverable: (
    deliverable: Omit<Deliverable, "createdAt" | "updatedAt">,
  ) => Promise<Deliverable>;
  approveDeliverable: (projectId: string, id: string) => Promise<void>;
  getByType: (projectId: string, type: string) => Deliverable | undefined;
}

export const useDeliverablesStore = create<DeliverablesState>((set, get) => ({
  deliverables: {},
  loading: false,

  fetchDeliverables: async (projectId) => {
    set({ loading: true });
    try {
      const items = await commands.getDeliverables(projectId);
      set((state) => ({
        deliverables: { ...state.deliverables, [projectId]: items },
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  saveDeliverable: async (deliverable) => {
    const saved = await commands.saveDeliverable(deliverable);
    set((state) => {
      const projectDeliverables = state.deliverables[deliverable.projectId] ?? [];
      const existing = projectDeliverables.findIndex((d) => d.id === saved.id);
      const updated =
        existing >= 0
          ? projectDeliverables.map((d, i) => (i === existing ? saved : d))
          : [...projectDeliverables, saved];
      return {
        deliverables: {
          ...state.deliverables,
          [deliverable.projectId]: updated,
        },
      };
    });
    return saved;
  },

  approveDeliverable: async (projectId, id) => {
    const approved = await commands.approveDeliverable(id);
    set((state) => {
      const projectDeliverables = state.deliverables[projectId] ?? [];
      return {
        deliverables: {
          ...state.deliverables,
          [projectId]: projectDeliverables.map((d) =>
            d.id === id ? approved : d,
          ),
        },
      };
    });
    await commands.logActivity(projectId, "deliverable_approved", { id });
  },

  getByType: (projectId, type) => {
    return get().deliverables[projectId]?.find((d) => d.type === type);
  },
}));
