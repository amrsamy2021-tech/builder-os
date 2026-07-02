import type { WorkflowStageState, NextAction } from "@/types/workflow";
import type { ProductBrain } from "@/types/product-brain";
import type { Deliverable } from "@/lib/tauri-commands";

const DELIVERABLE_TYPE_MAP: Record<string, string> = {
  "Product Brief": "product_brief",
  Personas: "personas",
  "Jobs to be Done": "jtbd",
  "Research Summary": "research_summary",
  "Competitive Analysis": "competitive_analysis",
  PRD: "prd",
  "User Stories": "user_stories",
  "Acceptance Criteria": "acceptance_criteria",
  "UX Flows": "ux_flows",
  "Screen List": "screen_list",
  "Screen Specs": "screen_specs",
  "Design System Spec": "design_system",
  "Architecture Plan": "architecture",
  "DB Schema": "db_schema",
  "API Contracts": "api_contracts",
  "Cursor Tasks": "cursor_tasks",
  "Implementation Plan": "implementation_plan",
  "QA Test Cases": "qa_test_cases",
  "Release Notes": "release_notes",
  "Release Checklist": "release_checklist",
};

function hasInput(productBrain: ProductBrain, input: string): boolean {
  const lower = input.toLowerCase();
  if (lower.includes("idea") && productBrain.idea.length > 0) return true;
  if (lower.includes("target user") && productBrain.targetUsers.length > 0)
    return true;
  if (lower.includes("business goal") && productBrain.businessGoal)
    return true;
  if (lower.includes("persona") && productBrain.targetUsers.length > 0)
    return true;
  if (lower.includes("research") && productBrain.goals.length > 0) return true;
  if (lower.includes("prd") && productBrain.requirements.length > 0) return true;
  if (lower.includes("user stor") && productBrain.userStories.length > 0)
    return true;
  if (lower.includes("ux flow") && productBrain.uxFlows.length > 0) return true;
  if (lower.includes("screen spec") && productBrain.screens.length > 0)
    return true;
  if (lower.includes("architecture") && productBrain.architecture.overview)
    return true;
  if (lower.includes("cursor task") && productBrain.tasks.length > 0)
    return true;
  if (lower.includes("qa") && productBrain.qaCases.length > 0) return true;
  return false;
}

function getDeliverableStatus(
  deliverables: Deliverable[],
  name: string,
): "missing" | "draft" | "approved" | "synced" {
  const type = DELIVERABLE_TYPE_MAP[name];
  if (!type) return "missing";
  const d = deliverables.find((del) => del.type === type);
  if (!d) return "missing";
  return d.status;
}

export function computeNextAction(
  stages: WorkflowStageState[],
  productBrain: ProductBrain,
  deliverables: Deliverable[],
): NextAction | null {
  const currentStage =
    stages.find(
      (s) => s.status === "in_progress" || s.status === "blocked",
    ) ?? stages.find((s) => s.status === "not_started");

  if (!currentStage) return null;

  for (const input of currentStage.requiredInputs) {
    if (!hasInput(productBrain, input)) {
      return {
        id: `input-${input}`,
        title: `Provide ${input}`,
        description: `The ${currentStage.name} stage needs: ${input}`,
        type: "user_input",
        requiresApproval: false,
      };
    }
  }

  for (const deliverable of currentStage.deliverables) {
    const status = getDeliverableStatus(deliverables, deliverable);
    if (status === "missing") {
      const type = DELIVERABLE_TYPE_MAP[deliverable] ?? deliverable;
      return {
        id: `generate-${type}`,
        title: `Generate ${deliverable}`,
        description: `Use AI to generate ${deliverable} for the ${currentStage.name} stage`,
        type: "ai_generate",
        targetTool: "openai",
        requiresApproval: false,
        deliverableType: type,
      };
    }
    if (status === "draft") {
      return {
        id: `review-${deliverable}`,
        title: `Review ${deliverable}`,
        description: `Review and approve the generated ${deliverable}`,
        type: "review",
        requiresApproval: true,
        deliverableType: DELIVERABLE_TYPE_MAP[deliverable],
      };
    }
    if (status === "approved") {
      return {
        id: `sync-${deliverable}`,
        title: `Sync ${deliverable}`,
        description: `Sync approved ${deliverable} to connected tools`,
        type: "sync_tool",
        targetTool: "notion",
        requiresApproval: true,
        deliverableType: DELIVERABLE_TYPE_MAP[deliverable],
      };
    }
  }

  return {
    id: `complete-${currentStage.id}`,
    title: `Complete ${currentStage.name} stage`,
    description: `All deliverables for ${currentStage.name} are ready. Approve to advance.`,
    type: "review",
    requiresApproval: true,
  };
}

export function getOverallProgress(stages: WorkflowStageState[]): number {
  if (stages.length === 0) return 0;
  const total = stages.reduce((sum, s) => sum + s.completionPercentage, 0);
  return Math.round(total / stages.length);
}

export function getCurrentStage(
  stages: WorkflowStageState[],
): WorkflowStageState | null {
  return (
    stages.find((s) => s.status === "in_progress") ??
    stages.find((s) => s.status === "blocked") ??
    stages.find((s) => s.status === "not_started") ??
    null
  );
}
