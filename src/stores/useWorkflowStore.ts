import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import type { WorkflowStageState, NextAction } from "@/types/workflow";
import { computeNextAction } from "@/features/workflow/next-action-engine";
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
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  stages: {},
  nextActions: {},
  loading: false,

  fetchStages: async (projectId) => {
    set({ loading: true });
    try {
      const stages = await commands.getWorkflowStages(projectId);
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
    set((state) => ({
      nextActions: { ...state.nextActions, [projectId]: action },
    }));
    return action;
  },

  approveStage: async (projectId, stageId) => {
    const stages = get().stages[projectId] ?? [];
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    const updated: WorkflowStageState = {
      ...stage,
      status: "completed",
      completionPercentage: 100,
      approvedAt: new Date().toISOString(),
    };
    await get().updateStage(projectId, updated);
    const nextStage = stages.find(
      (s) => s.status === "not_started" && s.id !== stageId,
    );
    if (nextStage) {
      await get().updateStage(projectId, {
        ...nextStage,
        status: "in_progress",
      });
    }
  },
}));
