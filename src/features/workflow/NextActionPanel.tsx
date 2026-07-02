import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { runWithLoading } from "@/stores/useLoadingStore";
import { useWorkflowStore } from "@/stores/useWorkflowStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import { useScreensStore } from "@/stores/useScreensStore";
import { useAgentJobsStore } from "@/stores/useAgentJobsStore";
import { buildScreenDevPrompt } from "@/lib/screen-hub";
import type { NextAction } from "@/types/workflow";
import { toast } from "sonner";

interface NextActionPanelProps {
  projectId: string;
  nextAction: NextAction | null;
  size?: "sm" | "default";
}

export function NextActionPanel({
  projectId,
  nextAction,
  size = "sm",
}: NextActionPanelProps) {
  const navigate = useNavigate();
  const { approveStage, syncWorkflowProgress } = useWorkflowStore();
  const { productBrains, projects } = useProjectStore();
  const { deliverables } = useDeliverablesStore();
  const { importFromDeliverables } = useScreensStore();
  const { enqueueJob } = useAgentJobsStore();

  if (!nextAction) return null;

  const handleAction = async () => {
    try {
      switch (nextAction.type) {
        case "ai_generate":
          navigate(
            `/projects/${projectId}/deliverables?generate=${nextAction.deliverableType ?? ""}`,
          );
          break;
        case "import_screens": {
          const brain = productBrains[projectId];
          const list = deliverables[projectId] ?? [];
          if (!brain) break;
          const result = await importFromDeliverables(projectId, brain, list);
          useProjectStore.setState((s) => ({
            productBrains: { ...s.productBrains, [projectId]: result.brain },
          }));
          toast.success(
            `Imported ${result.screensAdded} screens, ${result.qaCasesAdded} test cases`,
          );
          navigate(`/projects/${projectId}/screens`);
          break;
        }
        case "send_to_dev": {
          const brain = productBrains[projectId];
          const project = projects.find((p) => p.id === projectId);
          const screen = brain?.screens.find((s) => s.id === nextAction.screenId);
          if (!brain || !project || !screen) {
            toast.error("Screen not found");
            break;
          }
          await runWithLoading(`Implementing ${screen.name}...`, async () => {
            await useScreensStore.getState().updateScreen(projectId, brain, screen.id, {
              devStatus: "in_progress",
            });
            await enqueueJob({
              projectId,
              folderPath: project.folderPath,
              screenId: screen.id,
              label: `Implement ${screen.name}`,
              prompt: buildScreenDevPrompt(brain, screen),
              mode: brain.preferredAgentMode === "cloud" ? "cloud" : "local",
            });
            const updatedBrain = useProjectStore.getState().productBrains[projectId] ?? brain;
            await useScreensStore.getState().updateScreen(projectId, updatedBrain, screen.id, {
              devStatus: "done",
            });
          });
          toast.success(`${screen.name} sent to dev`);
          navigate(`/projects/${projectId}/screens/${screen.id}`);
          break;
        }
        case "review":
          if (nextAction.id.startsWith("complete-")) {
            await runWithLoading("Completing stage...", async () => {
              const stageId = nextAction.id.replace("complete-", "");
              await approveStage(projectId, stageId);
              await syncWorkflowProgress(projectId);
            });
            toast.success("Stage completed — moving to next step");
          } else if (nextAction.deliverableType) {
            navigate(
              `/projects/${projectId}/deliverables?type=${nextAction.deliverableType}`,
            );
          } else {
            navigate(`/projects/${projectId}/deliverables`);
          }
          break;
        case "user_input":
          navigate(`/projects/${projectId}/product-brain`);
          break;
        case "sync_tool":
          navigate(`/projects/${projectId}/integrations`);
          break;
        default:
          navigate(`/projects/${projectId}/deliverables`);
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Button size={size} onClick={handleAction}>
      Take Action
    </Button>
  );
}
