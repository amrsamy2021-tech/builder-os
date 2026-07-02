import type { ProductBrain, QATestCase, ScreenSpec } from "@/types/product-brain";
import { normalizeScreenName } from "@/lib/screen-hub";
import type { Deliverable } from "@/lib/tauri-commands";

function findDeliverable(
  deliverables: Deliverable[],
  types: string[],
): Deliverable | undefined {
  return deliverables.find((d) => types.includes(d.type));
}

function parseBulletList(lines: string[], startIdx: number): { items: string[]; nextIdx: number } {
  const items: string[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      items.push(line.replace(/^[-*]\s+/, "").replace(/\*\*/g, ""));
      i += 1;
    } else if (line === "") {
      i += 1;
    } else {
      break;
    }
  }
  return { items, nextIdx: i };
}

function parseScreenSections(content: string): Omit<ScreenSpec, "id">[] {
  const screens: Omit<ScreenSpec, "id">[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      const rawName = headingMatch[1]
        .replace(/^Screen:\s*/i, "")
        .replace(/^Screen\s+/i, "")
        .trim();
      if (rawName.length > 0 && !/^(screen list|screens|overview|purpose)$/i.test(rawName)) {
        let purpose = "";
        const components: string[] = [];
        const states: string[] = [];
        i += 1;

        while (i < lines.length) {
          const sub = lines[i].trim();
          if (/^#{1,3}\s+/.test(sub)) break;

          const purposeMatch = sub.match(/^(?:\*\*)?Purpose(?:\*\*)?:?\s*(.*)$/i);
          if (purposeMatch) {
            purpose = purposeMatch[1].trim();
            i += 1;
            continue;
          }

          if (/^(?:\*\*)?Components(?:\*\*)?:?\s*$/i.test(sub)) {
            i += 1;
            const parsed = parseBulletList(lines, i);
            components.push(...parsed.items);
            i = parsed.nextIdx;
            continue;
          }

          if (/^(?:\*\*)?States(?:\*\*)?:?\s*$/i.test(sub)) {
            i += 1;
            const parsed = parseBulletList(lines, i);
            states.push(...parsed.items);
            i = parsed.nextIdx;
            continue;
          }

          if (sub.startsWith("- ") && !purpose) {
            purpose = sub.replace(/^-\s+/, "");
          }
          i += 1;
        }

        screens.push({
          name: rawName,
          purpose,
          components,
          states,
          designStatus: "none",
          devStatus: "not_started",
        });
        continue;
      }
    }
    i += 1;
  }

  return screens;
}

function matchScreenId(screens: ScreenSpec[], hint: string): string | undefined {
  const normalized = normalizeScreenName(hint);
  const exact = screens.find((s) => normalizeScreenName(s.name) === normalized);
  if (exact) return exact.id;

  const partial = screens.find(
    (s) =>
      normalizeScreenName(s.name).includes(normalized) ||
      normalized.includes(normalizeScreenName(s.name)),
  );
  return partial?.id;
}

function parseQACases(content: string, screens: ScreenSpec[]): QATestCase[] {
  const cases: QATestCase[] = [];
  const sections = content.split(/(?=^#{1,3}\s+)/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    const titleLine = lines[0]?.trim() ?? "";
    const titleMatch = titleLine.match(/^#{1,3}\s+(?:Test(?: Case)?:?\s*)?(.+)$/i);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    if (/^(qa test cases|test cases|overview)$/i.test(title)) continue;

    let feature = "";
    const steps: string[] = [];
    let expectedResult = "";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const featureMatch = line.match(/^(?:\*\*)?Feature(?:\*\*)?:?\s*(.+)$/i);
      if (featureMatch) {
        feature = featureMatch[1].trim();
        continue;
      }
      const expectedMatch = line.match(/^(?:\*\*)?Expected(?: Result)?(?:\*\*)?:?\s*(.+)$/i);
      if (expectedMatch) {
        expectedResult = expectedMatch[1].trim();
        continue;
      }
      const stepMatch = line.match(/^\d+\.\s+(.+)$/);
      if (stepMatch) {
        steps.push(stepMatch[1].trim());
        continue;
      }
      if (line.startsWith("- ") && steps.length === 0 && !expectedResult) {
        steps.push(line.replace(/^-\s+/, ""));
      }
    }

    if (!feature) feature = title;

    cases.push({
      id: crypto.randomUUID(),
      feature,
      title,
      steps,
      expectedResult,
      status: "pending",
      screenId: matchScreenId(screens, feature) ?? matchScreenId(screens, title),
    });
  }

  return cases;
}

export interface ImportResult {
  screensAdded: number;
  screensUpdated: number;
  qaCasesAdded: number;
  brain: ProductBrain;
}

export function importScreensFromDeliverables(
  brain: ProductBrain,
  deliverables: Deliverable[],
): ImportResult {
  const screenList = findDeliverable(deliverables, ["screen_list"]);
  const screenSpecs = findDeliverable(deliverables, ["screen_specs"]);
  const content = [screenSpecs?.content, screenList?.content].filter(Boolean).join("\n\n");

  if (!content.trim()) {
    return { screensAdded: 0, screensUpdated: 0, qaCasesAdded: 0, brain };
  }

  const parsed = parseScreenSections(content);
  let screensAdded = 0;
  let screensUpdated = 0;
  const nextScreens = [...brain.screens];

  for (const screen of parsed) {
    const existingIdx = nextScreens.findIndex(
      (s) => normalizeScreenName(s.name) === normalizeScreenName(screen.name),
    );
    if (existingIdx >= 0) {
      nextScreens[existingIdx] = {
        ...nextScreens[existingIdx],
        ...screen,
        id: nextScreens[existingIdx].id,
      };
      screensUpdated += 1;
    } else {
      nextScreens.push({ ...screen, id: crypto.randomUUID() });
      screensAdded += 1;
    }
  }

  return {
    screensAdded,
    screensUpdated,
    qaCasesAdded: 0,
    brain: { ...brain, screens: nextScreens, updatedAt: new Date().toISOString() },
  };
}

export function importQACasesFromDeliverables(
  brain: ProductBrain,
  deliverables: Deliverable[],
): ImportResult {
  const qaDeliverable = findDeliverable(deliverables, ["qa_test_cases"]);
  if (!qaDeliverable?.content.trim()) {
    return { screensAdded: 0, screensUpdated: 0, qaCasesAdded: 0, brain };
  }

  const parsed = parseQACases(qaDeliverable.content, brain.screens);
  let qaCasesAdded = 0;
  const existingTitles = new Set(brain.qaCases.map((c) => normalizeScreenName(c.title)));
  const newCases = [...brain.qaCases];

  for (const testCase of parsed) {
    if (existingTitles.has(normalizeScreenName(testCase.title))) continue;
    newCases.push(testCase);
    qaCasesAdded += 1;
  }

  return {
    screensAdded: 0,
    screensUpdated: 0,
    qaCasesAdded,
    brain: { ...brain, qaCases: newCases, updatedAt: new Date().toISOString() },
  };
}

export function importAllFromDeliverables(
  brain: ProductBrain,
  deliverables: Deliverable[],
): ImportResult {
  const screenResult = importScreensFromDeliverables(brain, deliverables);
  const qaResult = importQACasesFromDeliverables(screenResult.brain, deliverables);
  return {
    screensAdded: screenResult.screensAdded,
    screensUpdated: screenResult.screensUpdated,
    qaCasesAdded: qaResult.qaCasesAdded,
    brain: qaResult.brain,
  };
}
