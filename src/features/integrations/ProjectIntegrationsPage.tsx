import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIntegrationStore } from "@/stores/useIntegrationStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import { commands } from "@/lib/tauri-commands";
import { ensureNotionProjectPage, isValidNotionPageId, normalizeNotionPageId } from "@/lib/notion-sync";
import { runWithLoading } from "@/stores/useLoadingStore";
import { toast } from "sonner";

export function ProjectIntegrationsPage() {
  const { id } = useParams<{ id: string }>();
  const { integrations, fetchIntegrations, notionSyncReady, checkNotionSyncReady } =
    useIntegrationStore();
  const { projects, productBrains, loadProductBrain, updateProductBrain } =
    useProjectStore();
  const { deliverables, fetchDeliverables, syncDeliverableToNotion } =
    useDeliverablesStore();
  const [parentPageId, setParentPageId] = useState("");
  const [creatingNotion, setCreatingNotion] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const project = projects.find((p) => p.id === id);
  const brain = id ? productBrains[id] : null;
  const projectDeliverables = id ? deliverables[id] ?? [] : [];
  const notionConnected =
    integrations.find((i) => i.tool === "notion")?.status === "connected";

  useEffect(() => {
    fetchIntegrations();
    checkNotionSyncReady();
    if (id) {
      loadProductBrain(id);
      fetchDeliverables(id);
    }
  }, [fetchIntegrations, checkNotionSyncReady, id, loadProductBrain, fetchDeliverables]);

  useEffect(() => {
    if (brain?.notionParentPageId) {
      setParentPageId(brain.notionParentPageId);
    }
  }, [brain?.notionParentPageId]);

  const generateCursorFiles = async () => {
    if (!project || !brain) return;
    try {
      await runWithLoading("Generating Cursor files...", () =>
        commands.writeCursorFiles(project.folderPath, brain),
      );
      toast.success("Cursor files generated");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const saveNotionParent = async () => {
    if (!id || !brain || !parentPageId.trim()) {
      toast.error("Paste a full Notion parent page URL from your browser");
      return;
    }
    const parsed = normalizeNotionPageId(parentPageId);
    if (!parsed) {
      toast.error(
        "Could not read a page ID from that link. Open the page in Notion → Copy link → paste the full URL here.",
      );
      return;
    }
    try {
      await updateProductBrain(id, {
        ...brain,
        notionParentPageId: parsed,
        ...(brain.notionPageId && !isValidNotionPageId(brain.notionPageId)
          ? { notionPageId: undefined, notionPageUrl: undefined }
          : {}),
      });
      toast.success("Notion parent page saved");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const createNotionPages = async () => {
    if (!id || !brain) return;
    setCreatingNotion(true);
    try {
      await runWithLoading("Creating Notion project page...", async () => {
        const parent = parentPageId.trim() || brain.notionParentPageId;
        const { pageId, pageUrl, brain: updated } = await ensureNotionProjectPage(
          brain,
          parent,
        );
        await updateProductBrain(id, {
          ...updated,
          notionPageId: pageId,
          notionPageUrl: pageUrl,
          notionParentPageId: parent,
        });
      });
      toast.success("Notion project pages created");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreatingNotion(false);
    }
  };

  const syncAllToNotion = async () => {
    if (!id || !brain) return;
    const toSync = projectDeliverables.filter(
      (d) => d.status === "approved" || d.status === "synced",
    );
    if (toSync.length === 0) {
      toast.error("No approved deliverables to sync");
      return;
    }
    setSyncingAll(true);
    try {
      await runWithLoading(
        `Syncing ${toSync.length} deliverable(s) to Notion...`,
        async () => {
          let currentBrain = brain;
          for (const d of toSync) {
            currentBrain = await syncDeliverableToNotion(
              id,
              d.id,
              currentBrain,
              async (b) => {
                await updateProductBrain(id, b);
                currentBrain = b;
              },
            );
          }
        },
      );
      toast.success(`Synced ${toSync.length} deliverable(s) to Notion`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncingAll(false);
    }
  };

  const fetchFigma = async () => {
    if (!brain?.figmaFileUrl) {
      toast.error("No Figma file configured");
      return;
    }
    try {
      const ctx = await runWithLoading("Fetching Figma context...", () =>
        commands.fetchFigmaFile(brain.figmaFileUrl!),
      );
      toast.success(`Fetched ${ctx.pages.length} pages from Figma`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Project Integrations</h1>
      <p className="mb-8 text-muted-foreground">
        Tool actions for {project?.name}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.tool}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">
                  {integration.tool}
                </CardTitle>
                <Badge
                  variant={
                    integration.status === "connected" ? "success" : "outline"
                  }
                >
                  {integration.status}
                </Badge>
              </div>
              <CardDescription>
                {integration.lastSyncAt
                  ? `Last sync: ${new Date(integration.lastSyncAt).toLocaleString()}`
                  : "Not synced yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {integration.tool === "cursor" && (
                <Button size="sm" onClick={generateCursorFiles}>
                  Generate Cursor Files
                </Button>
              )}

              {integration.tool === "notion" && (
                <div className="space-y-3">
                  {brain?.notionPageId && !isValidNotionPageId(brain.notionPageId) && (
                    <p className="text-xs text-destructive">
                      Stored Notion page ID is invalid (e.g. placeholder text). Save a real parent page URL below, then click Create Notion pages.
                    </p>
                  )}
                  {notionConnected && !notionSyncReady && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      MCP is connected for Cursor. Add your integration token in
                      Connect Tools → Notion to enable page sync here.
                    </p>
                  )}
                  <div>
                    <Label htmlFor="notion-parent">Parent Notion page URL</Label>
                    <Input
                      id="notion-parent"
                      value={parentPageId}
                      onChange={(e) => setParentPageId(e.target.value)}
                      placeholder="https://notion.so/your-workspace/..."
                      className="mt-1"
                    />
                  </div>
                  {brain?.notionPageUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={brain.notionPageUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Open project Notion page
                      </a>
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={saveNotionParent}>
                      Save parent page
                    </Button>
                    <Button
                      size="sm"
                      onClick={createNotionPages}
                      disabled={creatingNotion || !notionSyncReady}
                    >
                      {creatingNotion ? "Creating..." : "Create Notion pages"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={syncAllToNotion}
                      disabled={syncingAll || !notionSyncReady}
                    >
                      {syncingAll ? "Syncing..." : "Sync all approved"}
                    </Button>
                  </div>
                </div>
              )}

              {integration.tool === "figma" && (
                <Button size="sm" onClick={fetchFigma}>
                  Fetch Figma Context
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
