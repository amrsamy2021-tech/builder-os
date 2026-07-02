import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectStore } from "@/stores/useProjectStore";
import { useScreensStore } from "@/stores/useScreensStore";
import { useAgentJobsStore } from "@/stores/useAgentJobsStore";
import {
  buildScreenDevPrompt,
  getScreenById,
  getScreenQACases,
  parseFigmaUrl,
} from "@/lib/screen-hub";
import { ScreenLinkTags } from "./ScreenLinkTags";
import { ScreenTestCasesPanel } from "./ScreenTestCasesPanel";
import { toast } from "sonner";

export function ScreenDetailPage() {
  const { id, screenId } = useParams<{ id: string; screenId: string }>();
  const { projects, productBrains, loadProductBrain } = useProjectStore();
  const { updateScreen, recordRetest, syncScreenNotion } = useScreensStore();
  const { enqueueJob } = useAgentJobsStore();
  const [syncingNotion, setSyncingNotion] = useState(false);
  const [sendingDev, setSendingDev] = useState(false);

  const brain = id ? productBrains[id] : null;
  const project = projects.find((p) => p.id === id);
  const screen = useMemo(
    () => (brain && screenId ? getScreenById(brain, screenId) : undefined),
    [brain, screenId],
  );

  useEffect(() => {
    if (id) loadProductBrain(id);
  }, [id, loadProductBrain]);

  const refreshBrain = (updated: typeof brain) => {
    if (!id || !updated) return;
    useProjectStore.setState((s) => ({
      productBrains: { ...s.productBrains, [id]: updated },
    }));
  };

  const handleFigmaUpdate = async (url: string) => {
    if (!id || !brain || !screen) return;
    const parsed = parseFigmaUrl(url);
    if (!parsed) {
      toast.error("Invalid Figma URL");
      return;
    }
    try {
      const updated = await updateScreen(id, brain, screen.id, {
        figmaUrl: parsed.figmaUrl,
        figmaFileKey: parsed.fileKey,
        figmaNodeId: parsed.nodeId,
        designStatus: "draft",
      });
      refreshBrain(updated);
      toast.success("Figma link saved");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSyncNotion = async () => {
    if (!id || !brain || !screen) return;
    setSyncingNotion(true);
    try {
      const updated = await syncScreenNotion(id, brain, screen);
      refreshBrain(updated);
      toast.success("Screen synced to Notion");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSyncingNotion(false);
    }
  };

  const handleRetest = async (caseId: string, status: "pass" | "fail", note?: string) => {
    if (!id || !brain) return;
    try {
      const updated = await recordRetest(id, brain, caseId, status, note);
      refreshBrain(updated);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleQuickStatus = async (caseId: string, status: "pass" | "fail") => {
    await handleRetest(caseId, status);
  };

  const handleSendToDev = async () => {
    if (!id || !brain || !screen || !project) return;
    setSendingDev(true);
    try {
      const prompt = buildScreenDevPrompt(brain, screen);
      const withProgress = await updateScreen(id, brain, screen.id, {
        devStatus: "in_progress",
      });
      refreshBrain(withProgress);

      await enqueueJob({
        projectId: id,
        folderPath: project.folderPath,
        screenId: screen.id,
        label: `Implement ${screen.name}`,
        prompt,
        mode: brain.preferredAgentMode === "cloud" ? "cloud" : "local",
      });

      const withDone = await updateScreen(id, withProgress, screen.id, { devStatus: "done" });
      refreshBrain(withDone);
      toast.success(`Dev job completed for ${screen.name}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSendingDev(false);
    }
  };

  if (!brain || !screen) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Screen not found.</p>
        {id && (
          <Button asChild className="mt-4" variant="outline">
            <Link to={`/projects/${id}/screens`}>Back to Screens</Link>
          </Button>
        )}
      </div>
    );
  }

  const qaCases = getScreenQACases(brain, screen.id);

  return (
    <div className="p-8">
      <Button asChild variant="ghost" className="mb-4">
        <Link to={`/projects/${id}/screens`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          All screens
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{screen.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {screen.designStatus && screen.designStatus !== "none" && (
              <Badge variant="secondary">Design: {screen.designStatus}</Badge>
            )}
            {screen.devStatus && (
              <Badge variant="outline">Dev: {screen.devStatus.replace("_", " ")}</Badge>
            )}
          </div>
        </div>
        <Button onClick={handleSendToDev} disabled={sendingDev}>
          <Code2 className="mr-2 h-4 w-4" />
          {sendingDev ? "Starting..." : "Send to Dev"}
        </Button>
      </div>

      <div className="mb-6">
        <ScreenLinkTags
          screen={screen}
          onUpdateFigma={handleFigmaUpdate}
          onSyncNotion={handleSyncNotion}
          syncingNotion={syncingNotion}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purpose</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{screen.purpose || "Not set"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Components</CardTitle>
          </CardHeader>
          <CardContent>
            {screen.components.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {screen.components.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None listed</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">States</CardTitle>
          </CardHeader>
          <CardContent>
            {screen.states.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {screen.states.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None listed</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ScreenTestCasesPanel
        cases={qaCases}
        onRetest={handleRetest}
        onQuickStatus={handleQuickStatus}
      />
    </div>
  );
}
