import { commands } from "@/lib/tauri-commands";
import type { ProductBrain } from "@/types/product-brain";
import type { Deliverable } from "@/lib/tauri-commands";

function formatUuid(hex32: string): string {
  const hex = hex32.toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Extract a Notion page UUID from a URL, slug, or bare ID. */
export function parseNotionPageId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const uuidMatch = trimmed.match(
    /([a-f0-9]{8})-([a-f0-9]{4})-([a-f0-9]{4})-([a-f0-9]{4})-([a-f0-9]{12})/i,
  );
  if (uuidMatch) {
    return uuidMatch[0].toLowerCase();
  }

  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  const segment = withoutQuery.split("/").filter(Boolean).pop() ?? withoutQuery;

  const slugEndMatch = segment.match(/(?:^|-)([a-f0-9]{32})$/i);
  if (slugEndMatch?.[1]) {
    return formatUuid(slugEndMatch[1]);
  }

  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return formatUuid(trimmed);
  }

  const hexOnly = segment.replace(/[^a-f0-9]/gi, "");
  if (hexOnly.length >= 32) {
    return formatUuid(hexOnly.slice(-32));
  }

  return null;
}

export function isValidNotionPageId(value?: string): boolean {
  if (!value?.trim()) return false;
  return parseNotionPageId(value) !== null;
}

export function normalizeNotionPageId(raw: string): string {
  return parseNotionPageId(raw) ?? "";
}

export async function ensureNotionProjectPage(
  brain: ProductBrain,
  parentPageId?: string,
): Promise<{ pageId: string; pageUrl?: string; brain: ProductBrain }> {
  if (brain.notionPageId && isValidNotionPageId(brain.notionPageId)) {
    return {
      pageId: normalizeNotionPageId(brain.notionPageId),
      pageUrl: brain.notionPageUrl,
      brain,
    };
  }

  const parent = parentPageId ?? brain.notionParentPageId;
  const parsedParent = parent ? parseNotionPageId(parent) : null;
  if (!parsedParent) {
    throw new Error(
      "No valid Notion parent page set. In Project Integrations, paste a full Notion page URL (from your browser), click Save parent page, then Create Notion pages.",
    );
  }

  const result = await commands.createNotionProject(brain.projectName, parsedParent);
  const pageId = result.projectPageId;
  if (!pageId || !isValidNotionPageId(pageId)) {
    throw new Error("Notion did not return a valid project page ID");
  }

  const updatedBrain: ProductBrain = {
    ...brain,
    notionPageId: normalizeNotionPageId(pageId),
    notionPageUrl: result.projectPageUrl,
    notionParentPageId: parsedParent,
  };

  return {
    pageId: updatedBrain.notionPageId!,
    pageUrl: result.projectPageUrl,
    brain: updatedBrain,
  };
}

export async function syncDeliverableToNotionPage(
  deliverable: Deliverable,
  projectPageId: string,
): Promise<{ pageId: string; pageUrl?: string; message: string }> {
  const projectId = normalizeNotionPageId(projectPageId);
  if (!projectId) {
    throw new Error(
      "Invalid project Notion page. Go to Project Integrations and click Create Notion pages.",
    );
  }

  const result = await commands.syncDeliverableToNotion(
    projectId,
    deliverable.title,
    deliverable.content,
    deliverable.notionPageId,
  );

  return {
    pageId: result.pageId ?? deliverable.notionPageId ?? "",
    pageUrl: result.pageUrl ?? deliverable.notionPageUrl,
    message: result.message ?? "Synced to Notion",
  };
}
