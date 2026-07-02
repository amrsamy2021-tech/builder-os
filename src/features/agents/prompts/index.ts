import type { ProductBrain } from "@/types/product-brain";

export function buildAgentPrompt(
  agentType: string,
  productBrain: ProductBrain,
  deliverableType: string,
): string {
  const context = JSON.stringify(productBrain, null, 2);
  const base = `You are a ${agentType} agent for Builder OS. Generate a detailed ${deliverableType} based on the following Product Brain context. Return well-structured markdown.\n\nProduct Brain:\n${context}\n\n`;

  const prompts: Record<string, string> = {
    product_manager: `${base}Generate a comprehensive PRD including: product overview, goals, target users, features, requirements, user stories with acceptance criteria, and MVP scope.`,
    ux_researcher: `${base}Generate personas with goals and pain points, jobs-to-be-done analysis, research questions, and a competitive analysis summary.`,
    ux_designer: `${base}Generate information architecture, user flows with steps and edge cases, and a complete screen list.`,
    ui_designer: `${base}Generate UI direction, design system spec (colors, typography, spacing), component list, and detailed screen specifications.`,
    tech_lead: `${base}Generate system architecture overview, recommended tech stack, folder structure, database schema, and API contracts.`,
    developer: `${base}Generate implementation tasks with objectives, context, files to create/modify, step-by-step instructions, acceptance criteria, and test cases.`,
    qa: `${base}Generate QA test cases per feature with steps, expected results, edge cases, regression tests, and bug report templates.`,
    release: `${base}Generate release checklist, release notes, version number suggestion, and deployment readiness assessment.`,
  };

  return prompts[agentType] ?? `${base}Generate ${deliverableType}.`;
}

export const AGENT_DELIVERABLE_MAP: Record<string, { agent: string; types: string[] }> = {
  product_brief: { agent: "product_manager", types: ["product_brief"] },
  prd: { agent: "product_manager", types: ["prd"] },
  user_stories: { agent: "product_manager", types: ["user_stories"] },
  acceptance_criteria: { agent: "product_manager", types: ["acceptance_criteria"] },
  personas: { agent: "ux_researcher", types: ["personas"] },
  research_summary: { agent: "ux_researcher", types: ["research_summary"] },
  competitive_analysis: { agent: "ux_researcher", types: ["competitive_analysis"] },
  ux_flows: { agent: "ux_designer", types: ["ux_flows"] },
  screen_list: { agent: "ux_designer", types: ["screen_list"] },
  screen_specs: { agent: "ui_designer", types: ["screen_specs"] },
  design_system: { agent: "ui_designer", types: ["design_system"] },
  architecture: { agent: "tech_lead", types: ["architecture"] },
  db_schema: { agent: "tech_lead", types: ["db_schema"] },
  api_contracts: { agent: "tech_lead", types: ["api_contracts"] },
  cursor_tasks: { agent: "developer", types: ["cursor_tasks"] },
  implementation_plan: { agent: "developer", types: ["implementation_plan"] },
  qa_test_cases: { agent: "qa", types: ["qa_test_cases"] },
  release_notes: { agent: "release", types: ["release_notes"] },
  release_checklist: { agent: "release", types: ["release_checklist"] },
};

export const DELIVERABLE_LABELS: Record<string, string> = {
  product_brief: "Product Brief",
  prd: "PRD",
  user_stories: "User Stories",
  acceptance_criteria: "Acceptance Criteria",
  personas: "Personas",
  research_summary: "Research Summary",
  competitive_analysis: "Competitive Analysis",
  ux_flows: "UX Flows",
  screen_list: "Screen List",
  screen_specs: "Screen Specs",
  design_system: "Design System Spec",
  architecture: "Architecture Plan",
  db_schema: "DB Schema",
  api_contracts: "API Contracts",
  cursor_tasks: "Cursor Tasks",
  implementation_plan: "Implementation Plan",
  qa_test_cases: "QA Test Cases",
  release_notes: "Release Notes",
  release_checklist: "Release Checklist",
};
