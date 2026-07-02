import { create } from "zustand";
import { commands, type Deliverable } from "@/lib/tauri-commands";
import {
  ensureNotionProjectPage,
  syncDeliverableToNotionPage,
} from "@/lib/notion-sync";
import { runWithLoading } from "@/stores/useLoadingStore";
import type { ProductBrain } from "@/types/product-brain";

interface DeliverablesState {
  deliverables: Record<string, Deliverable[]>;
  loading: boolean;
  fetchDeliverables: (projectId: string) => Promise<void>;
  saveDeliverable: (
    deliverable: Omit<Deliverable, "createdAt" | "updatedAt">,
  ) => Promise<Deliverable>;
  updateDeliverableContent: (
    projectId: string,
    deliverable: Deliverable,
    content: string,
  ) => Promise<Deliverable>;
  approveDeliverable: (projectId: string, id: string) => Promise<void>;
  syncDeliverableToNotion: (
    projectId: string,
    deliverableId: string,
    brain: ProductBrain,
    updateBrain: (brain: ProductBrain) => Promise<void>,
  ) => Promise<ProductBrain>;
  getByType: (projectId: string, type: string) => Deliverable | undefined;
}

async function syncWorkflow(projectId: string) {
  const { useWorkflowStore } = await import("@/stores/useWorkflowStore");
  await useWorkflowStore.getState().syncWorkflowProgress(projectId);
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
      const withoutTypeDupes = projectDeliverables.filter(
        (d) => d.type !== saved.type || d.id === saved.id,
      );
      const existing = withoutTypeDupes.findIndex((d) => d.id === saved.id);
      const updated =
        existing >= 0
          ? withoutTypeDupes.map((d, i) => (i === existing ? saved : d))
          : [...withoutTypeDupes, saved];
      return {
        deliverables: {
          ...state.deliverables,
          [deliverable.projectId]: updated,
        },
      };
    });
    await syncWorkflow(deliverable.projectId);
    return saved;
  },

  updateDeliverableContent: async (projectId, deliverable, content) => {
    return runWithLoading("Saving changes...", async () => {
    const saved = await get().saveDeliverable({
      id: deliverable.id,
      projectId,
      type: deliverable.type,
      title: deliverable.title,
      content,
      status: deliverable.status === "synced" ? "approved" : deliverable.status,
      version: deliverable.version,
    });
    return saved;
    });
  },

  approveDeliverable: async (projectId, id) => {
    return runWithLoading("Approving deliverable...", async () => {
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
    await syncWorkflow(projectId);
    });
  },

  syncDeliverableToNotion: async (projectId, deliverableId, brain, updateBrain) => {
    return runWithLoading("Syncing to Notion...", async () => {
    const projectDeliverables = get().deliverables[projectId] ?? [];
    const deliverable = projectDeliverables.find((d) => d.id === deliverableId);
    if (!deliverable) {
      throw new Error("Deliverable not found");
    }
    if (deliverable.status === "draft") {
      throw new Error("Approve the deliverable before syncing to Notion");
    }

    const { pageId, brain: updatedBrain } = await ensureNotionProjectPage(brain);
    if (updatedBrain.notionPageId !== brain.notionPageId) {
      await updateBrain(updatedBrain);
    }

    const syncResult = await syncDeliverableToNotionPage(deliverable, pageId);
    const synced = await commands.markDeliverableSynced(
      deliverableId,
      syncResult.pageId,
      syncResult.pageUrl,
    );

    set((state) => {
      const items = state.deliverables[projectId] ?? [];
      return {
        deliverables: {
          ...state.deliverables,
          [projectId]: items.map((d) => (d.id === deliverableId ? synced : d)),
        },
      };
    });

    await commands.logActivity(projectId, "deliverable_synced_notion", {
      id: deliverableId,
      pageId: syncResult.pageId,
      pageUrl: syncResult.pageUrl,
    });
    await syncWorkflow(projectId);

    return updatedBrain.notionPageId ? updatedBrain : { ...updatedBrain, notionPageId: pageId };
    });
  },

  getByType: (projectId, type) => {
    const items = get().deliverables[projectId] ?? [];
    return items
      .filter((d) => d.type === type)
      .sort((a, b) => b.version - a.version)[0];
  },
}));
