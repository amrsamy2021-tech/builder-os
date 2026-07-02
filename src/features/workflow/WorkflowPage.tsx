import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useWorkflowStore } from "@/stores/useWorkflowStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import { computeNextAction, getCurrentStage } from "@/features/workflow/next-action-engine";
import type { Deliverable } from "@/lib/tauri-commands";
import { NextActionPanel } from "@/features/workflow/NextActionPanel";
import type { StageStatus, WorkflowStageState } from "@/types/workflow";

const EMPTY_STAGES: WorkflowStageState[] = [];
const EMPTY_DELIVERABLES: Deliverable[] = [];

const STATUS_VARIANT: Record<StageStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  not_started: "outline",
  in_progress: "default",
  blocked: "destructive",
  ready_for_review: "warning",
  approved: "success",
  completed: "success",
};

export function WorkflowPage() {
  const { id } = useParams<{ id: string }>();
  const { stages, fetchStages } = useWorkflowStore();
  const { productBrains, loadProductBrain } = useProjectStore();
  const { deliverables, fetchDeliverables } = useDeliverablesStore();

  const projectStages = id ? (stages[id] ?? EMPTY_STAGES) : EMPTY_STAGES;
  const brain = id ? productBrains[id] : null;
  const projectDeliverables = id ? (deliverables[id] ?? EMPTY_DELIVERABLES) : EMPTY_DELIVERABLES;
  const nextAction = useMemo(
    () => (id && brain ? computeNextAction(projectStages, brain, projectDeliverables) : null),
    [id, brain, projectStages, projectDeliverables],
  );
  const current = getCurrentStage(projectStages);

  useEffect(() => {
    if (!id) return;
    fetchStages(id);
    loadProductBrain(id);
    fetchDeliverables(id);
  }, [id, fetchStages, loadProductBrain, fetchDeliverables]);

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Product Cycle</h1>
      <p className="mb-8 text-muted-foreground">
        Your product lifecycle from idea to release
      </p>

      {nextAction && (
        <Card className="mb-8 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Recommended Next Action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{nextAction.title}</p>
            <p className="text-sm text-muted-foreground">{nextAction.description}</p>
            <div className="mt-3">
              <NextActionPanel projectId={id!} nextAction={nextAction} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {projectStages.map((stage) => {
          const isCurrent = current?.id === stage.id;
          return (
            <Card
              key={stage.id}
              className={isCurrent ? "border-primary ring-1 ring-primary/20" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{stage.name}</CardTitle>
                  <Badge variant={STATUS_VARIANT[stage.status]}>{stage.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Completion</span>
                    <span>{stage.completionPercentage}%</span>
                  </div>
                  <Progress value={stage.completionPercentage} className="h-2" />
                </div>

                {stage.blockers.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-destructive">Blockers</p>
                    <ul className="text-xs text-muted-foreground">
                      {stage.blockers.map((b) => (
                        <li key={b}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {stage.deliverables.map((d) => (
                    <Badge key={d} variant="outline" className="text-xs">
                      {d}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
