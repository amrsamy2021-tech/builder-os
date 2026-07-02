import type { WorkflowStageState } from "@/types/workflow";
import type { Deliverable } from "@/lib/tauri-commands";
import {
  DELIVERABLE_TYPE_MAP,
  getDeliverableStatus,
} from "@/features/workflow/next-action-engine";

export function calculateStageCompletion(
  stage: WorkflowStageState,
  deliverables: Deliverable[],
): number {
  const total = stage.deliverables.length;
  if (total === 0) return 100;

  const done = stage.deliverables.filter((name) => {
    const status = getDeliverableStatus(deliverables, name);
    return status === "approved" || status === "synced";
  }).length;

  return Math.round((done / total) * 100);
}

export function isStageComplete(
  stage: WorkflowStageState,
  deliverables: Deliverable[],
): boolean {
  return calculateStageCompletion(stage, deliverables) === 100;
}

export { DELIVERABLE_TYPE_MAP, getDeliverableStatus };
