import { create } from "zustand";
import { runWithLoading } from "@/stores/useLoadingStore";
import { commands } from "@/lib/tauri-commands";
import {
  recordQARetest,
  screenToNotionMarkdown,
  updateQACaseInBrain,
  updateScreenInBrain,
  upsertScreenInBrain,
} from "@/lib/screen-hub";
import { importAllFromDeliverables } from "@/lib/screen-import";
import { ensureNotionProjectPage } from "@/lib/notion-sync";
import { syncScreenToNotion } from "@/lib/notion-screen-sync";
import type { ProductBrain, QATestCase, ScreenSpec } from "@/types/product-brain";
import type { Deliverable } from "@/lib/tauri-commands";
import { useProjectStore } from "@/stores/useProjectStore";

interface ScreensState {
  updateScreen: (
    projectId: string,
    brain: ProductBrain,
    screenId: string,
    patch: Partial<ScreenSpec>,
  ) => Promise<ProductBrain>;
  addScreen: (projectId: string, brain: ProductBrain, screen: ScreenSpec) => Promise<ProductBrain>;
  recordRetest: (
    projectId: string,
    brain: ProductBrain,
    caseId: string,
    status: "pass" | "fail",
    note?: string,
  ) => Promise<ProductBrain>;
  updateQACase: (
    projectId: string,
    brain: ProductBrain,
    caseId: string,
    patch: Partial<QATestCase>,
  ) => Promise<ProductBrain>;
  importFromDeliverables: (
    projectId: string,
    brain: ProductBrain,
    deliverables: Deliverable[],
  ) => Promise<{ brain: ProductBrain; screensAdded: number; screensUpdated: number; qaCasesAdded: number }>;
  syncScreenNotion: (
    projectId: string,
    brain: ProductBrain,
    screen: ScreenSpec,
  ) => Promise<ProductBrain>;
}

async function persistBrain(projectId: string, brain: ProductBrain): Promise<ProductBrain> {
  await useProjectStore.getState().updateProductBrain(projectId, brain);
  return brain;
}

export const useScreensStore = create<ScreensState>(() => ({
  updateScreen: async (projectId, brain, screenId, patch) => {
    const updated = updateScreenInBrain(brain, screenId, patch);
    return persistBrain(projectId, updated);
  },

  addScreen: async (projectId, brain, screen) => {
    const updated = upsertScreenInBrain(brain, screen);
    return persistBrain(projectId, updated);
  },

  recordRetest: async (projectId, brain, caseId, status, note) => {
    const updated = recordQARetest(brain, caseId, status, note);
    return persistBrain(projectId, updated);
  },

  updateQACase: async (projectId, brain, caseId, patch) => {
    const updated = updateQACaseInBrain(brain, caseId, patch);
    return persistBrain(projectId, updated);
  },

  importFromDeliverables: async (projectId, brain, deliverables) => {
    return runWithLoading("Importing screens and test cases...", async () => {
      const result = importAllFromDeliverables(brain, deliverables);
      await persistBrain(projectId, result.brain);
      return result;
    });
  },

  syncScreenNotion: async (projectId, brain, screen) => {
    return runWithLoading(`Syncing ${screen.name} to Notion...`, async () => {
      const { brain: withPage, pageId } = await ensureNotionProjectPage(brain);
      if (withPage.notionPageId !== brain.notionPageId) {
        await persistBrain(projectId, withPage);
      }
      const content = screenToNotionMarkdown(screen, brain.projectName);
      const synced = await syncScreenToNotion(withPage, screen, pageId, content);
      const updated = updateScreenInBrain(withPage, screen.id, {
        notionPageId: synced.pageId,
        notionPageUrl: synced.pageUrl,
      });
      await persistBrain(projectId, updated);
      await commands.logActivity(projectId, "screen_synced_notion", {
        screenId: screen.id,
        screenName: screen.name,
      });
      return updated;
    });
  },
}));
