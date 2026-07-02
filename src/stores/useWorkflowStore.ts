import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import type { WorkflowStageState, NextAction } from "@/types/workflow";
import { computeNextAction } from "@/features/workflow/next-action-engine";
import {
  calculateStageCompletion,
  isStageComplete,
} from "@/features/workflow/workflow-sync";
import type { ProductBrain } from "@/types/product-brain";
import type { Deliverable } from "@/lib/tauri-commands";

interface WorkflowState {
  stages: Record<string, WorkflowStageState[]>;
  nextActions: Record<string, NextAction | null>;
  loading: boolean;
  fetchStages: (projectId: string) => Promise<void>;
  updateStage: (projectId: string, stage: WorkflowStageState) => Promise<void>;
  computeNextActionForProject: (
    projectId: string,
    productBrain: ProductBrain,
    deliverables: Deliverable[],
  ) => NextAction | null;
  approveStage: (projectId: string, stageId: string) => Promise<void>;
  syncWorkflowProgress: (projectId: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  stages: {},
  nextActions: {},
  loading: false,

  fetchStages: async (projectId) => {
    set({ loading: true });
    try {
      let stages = await commands.getWorkflowStages(projectId);
      if (stages.length === 0) {
        await commands.initWorkflowStages(projectId);
        stages = await commands.getWorkflowStages(projectId);
      }
      set((state) => ({
        stages: { ...state.stages, [projectId]: stages },
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  updateStage: async (projectId, stage) => {
    await commands.updateWorkflowStage(projectId, stage);
    set((state) => {
      const projectStages = state.stages[projectId] ?? [];
      return {
        stages: {
          ...state.stages,
          [projectId]: projectStages.map((s) =>
            s.id === stage.id ? stage : s,
          ),
        },
      };
    });
  },

  computeNextActionForProject: (projectId, productBrain, deliverables) => {
    const stages = get().stages[projectId] ?? [];
    const action = computeNextAction(stages, productBrain, deliverables);
    const current = get().nextActions[projectId];
    if (current?.id === action?.id && current?.title === action?.title) {
      return action;
    }
    set((state) => ({
      nextActions: { ...state.nextActions, [projectId]: action },
    }));
    return action;
  },

  approveStage: async (projectId, stageId) => {
    const stages = get().stages[projectId] ?? [];
    const stageIndex = stages.findIndex((s) => s.id === stageId);
    const stage = stages[stageIndex];
    if (!stage) return;

    const updated: WorkflowStageState = {
      ...stage,
      status: "completed",
      completionPercentage: 100,
      approvedAt: new Date().toISOString(),
    };
    await get().updateStage(projectId, updated);

    const nextStage = stages[stageIndex + 1];
    if (nextStage && nextStage.status === "not_started") {
      await get().updateStage(projectId, {
        ...nextStage,
        status: "in_progress",
      });
    }
  },

  syncWorkflowProgress: async (projectId) => {
    const { useDeliverablesStore } = await import("@/stores/useDeliverablesStore");
    const deliverables =
      useDeliverablesStore.getState().deliverables[projectId] ?? [];
    const stages = get().stages[projectId] ?? [];
    if (stages.length === 0) return;

    for (const stage of stages) {
      const pct = calculateStageCompletion(stage, deliverables);
      if (pct !== stage.completionPercentage) {
        await get().updateStage(projectId, {
          ...stage,
          completionPercentage: pct,
        });
      }
    }

    const refreshed = get().stages[projectId] ?? [];
    const current =
      refreshed.find((s) => s.status === "in_progress") ??
      refreshed.find((s) => s.status === "not_started");

    if (current && isStageComplete(current, deliverables)) {
      await get().approveStage(projectId, current.id);
    }
  },
}));
