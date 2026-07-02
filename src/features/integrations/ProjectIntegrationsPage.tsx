import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIntegrationStore } from "@/stores/useIntegrationStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { commands } from "@/lib/tauri-commands";
import { toast } from "sonner";

export function ProjectIntegrationsPage() {
  const { id } = useParams<{ id: string }>();
  const { integrations, fetchIntegrations } = useIntegrationStore();
  const { projects, productBrains, loadProductBrain } = useProjectStore();

  const project = projects.find((p) => p.id === id);
  const brain = id ? productBrains[id] : null;

  useEffect(() => {
    fetchIntegrations();
    if (id) loadProductBrain(id);
  }, [fetchIntegrations, id, loadProductBrain]);

  const generateCursorFiles = async () => {
    if (!project || !brain) return;
    try {
      await commands.writeCursorFiles(project.folderPath, brain);
      toast.success("Cursor files generated");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const syncToNotion = async () => {
    if (!brain?.notionPageId) {
      toast.error("No Notion page configured");
      return;
    }
    try {
      await commands.syncDeliverableToNotion(
        brain.notionPageId,
        "PRD",
        brain.idea,
      );
      toast.success("Synced to Notion");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const fetchFigma = async () => {
    if (!brain?.figmaFileUrl) {
      toast.error("No Figma file configured");
      return;
    }
    try {
      const ctx = await commands.fetchFigmaFile(brain.figmaFileUrl);
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
            <CardContent>
              {integration.tool === "cursor" && (
                <Button size="sm" onClick={generateCursorFiles}>
                  Generate Cursor Files
                </Button>
              )}
              {integration.tool === "notion" && (
                <Button size="sm" onClick={syncToNotion}>
                  Sync to Notion
                </Button>
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
