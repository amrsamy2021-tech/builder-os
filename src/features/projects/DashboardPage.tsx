import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/stores/useProjectStore";
import { useWorkflowStore } from "@/stores/useWorkflowStore";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import {
  computeNextAction,
  getOverallProgress,
  getCurrentStage,
} from "@/features/workflow/next-action-engine";
import { commands } from "@/lib/tauri-commands";
import { toast } from "sonner";
import { NextActionPanel } from "@/features/workflow/NextActionPanel";
import { AgentJobsPanel } from "@/features/agents/AgentJobsPanel";
import { getScreenQAStats, getScreenQACases } from "@/lib/screen-hub";
import type { Deliverable } from "@/lib/tauri-commands";
import type { WorkflowStageState } from "@/types/workflow";

const EMPTY_STAGES: WorkflowStageState[] = [];
const EMPTY_DELIVERABLES: Deliverable[] = [];

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { projects, productBrains, loadProductBrain, setActiveProject } = useProjectStore();
  const { stages, fetchStages } = useWorkflowStore();
  const { deliverables, fetchDeliverables } = useDeliverablesStore();

  const project = projects.find((p) => p.id === id);
  const brain = id ? productBrains[id] : null;
  const projectStages = id ? (stages[id] ?? EMPTY_STAGES) : EMPTY_STAGES;
  const projectDeliverables = id ? (deliverables[id] ?? EMPTY_DELIVERABLES) : EMPTY_DELIVERABLES;
  const nextAction = useMemo(
    () => (id && brain ? computeNextAction(projectStages, brain, projectDeliverables) : null),
    [id, brain, projectStages, projectDeliverables],
  );

  useEffect(() => {
    if (!id) return;
    setActiveProject(id);
    loadProductBrain(id);
    fetchStages(id);
    fetchDeliverables(id);
  }, [id, setActiveProject, loadProductBrain, fetchStages, fetchDeliverables]);

  const currentStage = getCurrentStage(projectStages);
  const overallProgress = getOverallProgress(projectStages);
  const screenCount = brain?.screens.length ?? 0;
  const qaStats = brain
    ? brain.screens.reduce(
        (acc, screen) => {
          const stats = getScreenQAStats(getScreenQACases(brain, screen.id));
          return { pass: acc.pass + stats.pass, total: acc.total + stats.total };
        },
        { pass: 0, total: 0 },
      )
    : { pass: 0, total: 0 };

  const openInCursor = async () => {
    if (!project) return;
    try {
      await commands.openInCursor(project.folderPath);
      toast.success("Opened in Cursor");
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (!project) {
    return (
      <div className="p-8">
        <p>Project not found.</p>
        <Button asChild className="mt-4">
          <Link to="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground">{project.folderPath}</p>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm">
          <span>Overall Progress</span>
          <span>{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="mb-2">{currentStage?.name ?? project.currentStage}</Badge>
            <p className="text-sm text-muted-foreground">
              {currentStage?.status ?? "in progress"}
            </p>
            <Button asChild variant="link" className="mt-2 h-auto p-0">
              <Link to={`/projects/${id}/workflow`}>View lifecycle →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Action</CardTitle>
          </CardHeader>
          <CardContent>
            {nextAction ? (
              <>
                <p className="font-medium">{nextAction.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nextAction.description}
                </p>
                <div className="mt-3">
                  <NextActionPanel projectId={id!} nextAction={nextAction} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">All stages complete!</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Screens & QA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {screenCount} screens · {qaStats.pass}/{qaStats.total} tests passing
            </p>
            <Button asChild variant="link" className="mt-2 h-auto p-0">
              <Link to={`/projects/${id}/screens`}>Open Screens →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {id && <AgentJobsPanel projectId={id} />}

      <div className="mt-8 flex gap-3">
        <Button onClick={openInCursor}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in Cursor
        </Button>
        <Button
          variant="outline"
          onClick={() => id && fetchStages(id)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {currentStage && currentStage.blockers.length > 0 && (
        <Card className="mt-6 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Blockers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm">
              {currentStage.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
