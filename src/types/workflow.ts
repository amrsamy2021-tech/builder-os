import type { WorkflowStage } from "./product-brain";

export type StageStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "ready_for_review"
  | "approved"
  | "completed";

export type NextActionType =
  | "ai_generate"
  | "sync_tool"
  | "user_input"
  | "run_command"
  | "review";

export type TargetTool =
  | "openai"
  | "cursor"
  | "figma"
  | "github"
  | "notion"
  | "filesystem"
  | "shell";

export interface NextAction {
  id: string;
  title: string;
  description: string;
  type: NextActionType;
  targetTool?: TargetTool;
  requiresApproval: boolean;
  deliverableType?: string;
}

export interface WorkflowStageState {
  id: WorkflowStage;
  name: string;
  status: StageStatus;
  completionPercentage: number;
  requiredInputs: string[];
  deliverables: string[];
  blockers: string[];
  nextActions: NextAction[];
  approvedAt?: string;
}

export const WORKFLOW_STAGES: {
  id: WorkflowStage;
  name: string;
  requiredInputs: string[];
  deliverables: string[];
}[] = [
  {
    id: "idea",
    name: "Idea",
    requiredInputs: ["product idea"],
    deliverables: ["Product Brief"],
  },
  {
    id: "discovery",
    name: "Discovery",
    requiredInputs: ["target users", "business goal"],
    deliverables: ["Personas", "Jobs to be Done"],
  },
  {
    id: "research",
    name: "Research",
    requiredInputs: ["personas"],
    deliverables: ["Research Summary", "Competitive Analysis"],
  },
  {
    id: "prd",
    name: "PRD",
    requiredInputs: ["research summary"],
    deliverables: ["PRD", "User Stories", "Acceptance Criteria"],
  },
  {
    id: "ux",
    name: "UX",
    requiredInputs: ["PRD", "user stories"],
    deliverables: ["UX Flows", "Screen List"],
  },
  {
    id: "ui",
    name: "UI",
    requiredInputs: ["UX flows"],
    deliverables: ["Screen Specs", "Design System Spec"],
  },
  {
    id: "architecture",
    name: "Architecture",
    requiredInputs: ["PRD", "screen specs"],
    deliverables: ["Architecture Plan", "DB Schema", "API Contracts"],
  },
  {
    id: "development",
    name: "Development",
    requiredInputs: ["architecture"],
    deliverables: ["Cursor Tasks", "Implementation Plan"],
  },
  {
    id: "qa",
    name: "QA",
    requiredInputs: ["cursor tasks"],
    deliverables: ["QA Test Cases"],
  },
  {
    id: "release",
    name: "Release",
    requiredInputs: ["QA cases"],
    deliverables: ["Release Notes", "Release Checklist"],
  },
];

export function createInitialWorkflowStages(): WorkflowStageState[] {
  return WORKFLOW_STAGES.map((stage) => ({
    id: stage.id,
    name: stage.name,
    status: stage.id === "idea" ? "in_progress" : "not_started",
    completionPercentage: 0,
    requiredInputs: stage.requiredInputs,
    deliverables: stage.deliverables,
    blockers: [],
    nextActions: [],
  }));
}
