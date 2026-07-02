import { commands } from "@/lib/tauri-commands";
import { normalizeNotionPageId } from "@/lib/notion-sync";
import type { ProductBrain, ScreenSpec } from "@/types/product-brain";

export async function syncScreenToNotion(
  _brain: ProductBrain,
  screen: ScreenSpec,
  projectPageId: string,
  content: string,
): Promise<{ pageId: string; pageUrl?: string; message: string }> {
  const projectId = normalizeNotionPageId(projectPageId);
  if (!projectId) {
    throw new Error("Invalid project Notion page. Set up Notion in Project Integrations first.");
  }

  const result = await commands.syncScreenToNotion(
    projectId,
    screen.name,
    content,
    screen.notionPageId,
  );

  return {
    pageId: result.pageId ?? screen.notionPageId ?? "",
    pageUrl: result.pageUrl ?? screen.notionPageUrl,
    message: result.message ?? "Synced to Notion",
  };
}
