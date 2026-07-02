import type { ProductBrain, QATestCase, QATestStatus, ScreenSpec } from "@/types/product-brain";

export interface QAStats {
  pass: number;
  fail: number;
  pending: number;
  manual: number;
  total: number;
}

export function getScreenById(brain: ProductBrain, screenId: string): ScreenSpec | undefined {
  return brain.screens.find((s) => s.id === screenId);
}

export function getScreenQACases(brain: ProductBrain, screenId: string): QATestCase[] {
  return brain.qaCases
    .filter((c) => c.screenId === screenId)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getScreenQAStats(cases: QATestCase[]): QAStats {
  return cases.reduce(
    (acc, c) => {
      acc.total += 1;
      if (c.status === "pass") acc.pass += 1;
      else if (c.status === "fail") acc.fail += 1;
      else if (c.status === "manual") acc.manual += 1;
      else acc.pending += 1;
      return acc;
    },
    { pass: 0, fail: 0, pending: 0, manual: 0, total: 0 },
  );
}

export function normalizeScreenName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseFigmaUrl(raw: string): {
  fileKey: string;
  nodeId: string;
  figmaUrl: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("figma.com")) return null;

    const pathParts = url.pathname.split("/").filter(Boolean);
    const designIdx = pathParts.findIndex((p) => p === "design" || p === "file");
    const fileKey =
      designIdx >= 0 && pathParts[designIdx + 1] ? pathParts[designIdx + 1] : pathParts[1];
    if (!fileKey) return null;

    const nodeParam = url.searchParams.get("node-id");
    if (!nodeParam) {
      return { fileKey, nodeId: "", figmaUrl: trimmed };
    }

    const nodeId = nodeParam.replace(/-/g, ":");
    return {
      fileKey,
      nodeId,
      figmaUrl: buildFigmaUrl(fileKey, nodeId),
    };
  } catch {
    return null;
  }
}

export function buildFigmaUrl(fileKey: string, nodeId: string): string {
  const nodeParam = nodeId.replace(/:/g, "-");
  return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(nodeParam)}`;
}

export function updateScreenInBrain(
  brain: ProductBrain,
  screenId: string,
  patch: Partial<ScreenSpec>,
): ProductBrain {
  return {
    ...brain,
    screens: brain.screens.map((s) => (s.id === screenId ? { ...s, ...patch } : s)),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertScreenInBrain(brain: ProductBrain, screen: ScreenSpec): ProductBrain {
  const idx = brain.screens.findIndex((s) => s.id === screen.id);
  const screens =
    idx >= 0
      ? brain.screens.map((s, i) => (i === idx ? { ...s, ...screen } : s))
      : [...brain.screens, screen];
  return { ...brain, screens, updatedAt: new Date().toISOString() };
}

export function updateQACaseInBrain(
  brain: ProductBrain,
  caseId: string,
  patch: Partial<QATestCase>,
): ProductBrain {
  return {
    ...brain,
    qaCases: brain.qaCases.map((c) => (c.id === caseId ? { ...c, ...patch } : c)),
    updatedAt: new Date().toISOString(),
  };
}

export function recordQARetest(
  brain: ProductBrain,
  caseId: string,
  status: "pass" | "fail",
  note?: string,
): ProductBrain {
  const testCase = brain.qaCases.find((c) => c.id === caseId);
  if (!testCase) return brain;

  const now = new Date().toISOString();
  const runRecord = { at: now, status, note };
  const runHistory = [...(testCase.runHistory ?? []), runRecord];

  return updateQACaseInBrain(brain, caseId, {
    status: status as QATestStatus,
    lastRunAt: now,
    lastRunBy: "manual",
    runHistory,
  });
}

export function screenToNotionMarkdown(screen: ScreenSpec, projectName: string): string {
  const components =
    screen.components.length > 0
      ? screen.components.map((c) => `- ${c}`).join("\n")
      : "- (none listed)";
  const states =
    screen.states.length > 0 ? screen.states.map((s) => `- ${s}`).join("\n") : "- (none listed)";

  return `# Screen: ${screen.name}

## Project
${projectName}

## Purpose
${screen.purpose || "TBD"}

## Components
${components}

## States
${states}

## Design Status
${screen.designStatus ?? "none"}

## Dev Status
${screen.devStatus ?? "not_started"}
`;
}

export function buildScreenDevPrompt(
  brain: ProductBrain,
  screen: ScreenSpec,
): string {
  const stories = brain.userStories
    .filter((s) => s.title.toLowerCase().includes(screen.name.toLowerCase()))
    .map(
      (s) =>
        `- ${s.title}: As a ${s.asA}, I want ${s.iWant}, so that ${s.soThat}`,
    );

  return `Implement the "${screen.name}" screen for project "${brain.projectName}".

## Screen Purpose
${screen.purpose}

## Components
${screen.components.map((c) => `- ${c}`).join("\n") || "- See screen spec"}

## States to handle
${screen.states.map((s) => `- ${s}`).join("\n") || "- Default state"}

## Related user stories
${stories.length > 0 ? stories.join("\n") : "- See Product Brain user stories"}

## Design reference
${screen.figmaUrl ? `Figma: ${screen.figmaUrl}` : "No Figma link — follow Product Brain design system"}

## PRD reference
${screen.notionPageUrl ? `Notion: ${screen.notionPageUrl}` : "See project PRD in Product Brain"}

## Instructions
- Follow existing project patterns and design system
- Implement all listed states
- Add tests for critical paths
- Do not break existing features`;
}
