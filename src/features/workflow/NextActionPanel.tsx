import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { runWithLoading } from "@/stores/useLoadingStore";
import { useWorkflowStore } from "@/stores/useWorkflowStore";
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

  if (!nextAction) return null;

  const handleAction = async () => {
    try {
      switch (nextAction.type) {
        case "ai_generate":
          navigate(
            `/projects/${projectId}/deliverables?generate=${nextAction.deliverableType ?? ""}`,
          );
          break;
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
          navigate(`/projects/${projectId}/brain`);
          break;
        case "sync_tool":
          navigate(`/projects/${projectId}/deliverables`);
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
