import type { WorkflowStageState, NextAction } from "@/types/workflow";
import type { ProductBrain } from "@/types/product-brain";
import type { Deliverable } from "@/lib/tauri-commands";

export const DELIVERABLE_TYPE_MAP: Record<string, string> = {
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

function hasInput(
  productBrain: ProductBrain,
  deliverables: Deliverable[],
  input: string,
): boolean {
  const lower = input.toLowerCase();
  if (lower.includes("idea") && productBrain.idea.length > 0) return true;
  if (lower.includes("target user") && productBrain.targetUsers.length > 0)
    return true;
  if (lower.includes("business goal") && productBrain.businessGoal)
    return true;
  if (lower.includes("persona")) {
    return (
      productBrain.targetUsers.length > 0 ||
      isDeliverableDone(deliverables, "Personas")
    );
  }
  if (lower.includes("research")) {
    return (
      isDeliverableDone(deliverables, "Research Summary") ||
      productBrain.goals.length > 0
    );
  }
  if (lower.includes("prd")) {
    return (
      isDeliverableDone(deliverables, "PRD") ||
      productBrain.requirements.length > 0
    );
  }
  if (lower.includes("user stor")) {
    return (
      isDeliverableDone(deliverables, "User Stories") ||
      productBrain.userStories.length > 0
    );
  }
  if (lower.includes("ux flow")) {
    return (
      isDeliverableDone(deliverables, "UX Flows") ||
      productBrain.uxFlows.length > 0
    );
  }
  if (lower.includes("screen spec")) {
    return (
      isDeliverableDone(deliverables, "Screen Specs") ||
      productBrain.screens.length > 0
    );
  }
  if (lower.includes("screen list")) {
    return (
      isDeliverableDone(deliverables, "Screen List") ||
      productBrain.screens.length > 0
    );
  }
  if (lower.includes("architecture")) {
    return (
      isDeliverableDone(deliverables, "Architecture Plan") ||
      Boolean(productBrain.architecture.overview)
    );
  }
  if (lower.includes("cursor task")) {
    return (
      isDeliverableDone(deliverables, "Cursor Tasks") ||
      productBrain.tasks.length > 0
    );
  }
  if (lower.includes("qa")) {
    return (
      isDeliverableDone(deliverables, "QA Test Cases") ||
      productBrain.qaCases.length > 0
    );
  }
  return false;
}

function isDeliverableDone(
  deliverables: Deliverable[],
  name: string,
): boolean {
  const status = getDeliverableStatus(deliverables, name);
  return status === "approved" || status === "synced";
}

export function getDeliverableStatus(
  deliverables: Deliverable[],
  name: string,
): "missing" | "draft" | "approved" | "synced" {
  const type = DELIVERABLE_TYPE_MAP[name];
  if (!type) return "missing";
  const d = deliverables
    .filter((del) => del.type === type)
    .sort((a, b) => b.version - a.version)[0];
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

  const hasScreenDeliverables =
    isDeliverableDone(deliverables, "Screen List") ||
    isDeliverableDone(deliverables, "Screen Specs");

  if (
    hasScreenDeliverables &&
    productBrain.screens.length === 0 &&
    (currentStage.id === "ux" || currentStage.id === "ui" || currentStage.id === "development")
  ) {
    return {
      id: "import-screens",
      title: "Import screens to Screen Hub",
      description:
        "Screen List or Screen Specs is ready — import into Screens for Notion, Figma, and QA links",
      type: "import_screens",
      requiresApproval: false,
    };
  }

  const nextDevScreen = productBrain.screens.find(
    (s) => !s.devStatus || s.devStatus === "not_started",
  );
  if (
    nextDevScreen &&
    (currentStage.id === "development" || currentStage.id === "ui") &&
    isDeliverableDone(deliverables, "Screen Specs")
  ) {
    return {
      id: `send-to-dev-${nextDevScreen.id}`,
      title: `Send ${nextDevScreen.name} to dev`,
      description: "Run Cursor in the background to implement this screen",
      type: "send_to_dev",
      targetTool: "cursor",
      requiresApproval: false,
      screenId: nextDevScreen.id,
    };
  }

  for (const input of currentStage.requiredInputs) {
    if (!hasInput(productBrain, deliverables, input)) {
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
        description: `Use Cursor AI to generate ${deliverable} for the ${currentStage.name} stage`,
        type: "ai_generate",
        targetTool: "cursor",
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
    if (status === "approved" || status === "synced") {
      continue;
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
