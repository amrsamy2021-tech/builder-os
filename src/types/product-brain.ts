export type Platform =
  | "mobile_app"
  | "web_app"
  | "dashboard"
  | "api_backend"
  | "admin_panel";

export type ProjectStatus = "active" | "archived" | "release_ready";

export type WorkflowStage =
  | "idea"
  | "discovery"
  | "research"
  | "prd"
  | "ux"
  | "ui"
  | "architecture"
  | "development"
  | "qa"
  | "release";

export interface ProductGoal {
  id: string;
  title: string;
  description: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  goals: string[];
  painPoints: string[];
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  priority: "must" | "should" | "could";
  status: "planned" | "in_progress" | "done";
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: "functional" | "non_functional";
}

export interface UserStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  githubIssueUrl?: string;
}

export interface UXFlow {
  id: string;
  name: string;
  steps: string[];
  edgeCases: string[];
}

export interface ScreenSpec {
  id: string;
  name: string;
  purpose: string;
  components: string[];
  states: string[];
}

export interface ArchitectureSpec {
  overview: string;
  stack: string[];
  folderStructure: string;
  databaseSchema: string;
  apiContracts: string;
}

export interface IntegrationState {
  tool: string;
  status: "connected" | "disconnected" | "error";
  config: Record<string, string>;
  lastSyncAt?: string;
  urls?: Record<string, string>;
}

export interface BuilderTask {
  id: string;
  title: string;
  objective: string;
  context: string;
  files: string[];
  steps: string[];
  acceptanceCriteria: string[];
  testCases: string[];
}

export interface QATestCase {
  id: string;
  feature: string;
  title: string;
  steps: string[];
  expectedResult: string;
  status: "pending" | "pass" | "fail" | "manual";
}

export interface ReleaseNote {
  id: string;
  version: string;
  date: string;
  features: string[];
  fixes: string[];
  checklist: { item: string; done: boolean }[];
}

export interface ProductBrain {
  id: string;
  projectName: string;
  idea: string;
  platforms: Platform[];
  status: ProjectStatus;
  currentStage: WorkflowStage;
  vision: string;
  goals: ProductGoal[];
  targetUsers: Persona[];
  features: Feature[];
  requirements: Requirement[];
  userStories: UserStory[];
  uxFlows: UXFlow[];
  screens: ScreenSpec[];
  architecture: ArchitectureSpec;
  integrations: IntegrationState[];
  tasks: BuilderTask[];
  qaCases: QATestCase[];
  releases: ReleaseNote[];
  techStack?: string[];
  businessGoal?: string;
  githubRepo?: string;
  figmaFileUrl?: string;
  notionPageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  currentStage: WorkflowStage;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyProductBrain(
  id: string,
  projectName: string,
  idea: string,
): ProductBrain {
  const now = new Date().toISOString();
  return {
    id,
    projectName,
    idea,
    platforms: [],
    status: "active",
    currentStage: "idea",
    vision: "",
    goals: [],
    targetUsers: [],
    features: [],
    requirements: [],
    userStories: [],
    uxFlows: [],
    screens: [],
    architecture: {
      overview: "",
      stack: [],
      folderStructure: "",
      databaseSchema: "",
      apiContracts: "",
    },
    integrations: [],
    tasks: [],
    qaCases: [],
    releases: [],
    createdAt: now,
    updatedAt: now,
  };
}
