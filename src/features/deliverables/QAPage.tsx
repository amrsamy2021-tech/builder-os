import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/stores/useProjectStore";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import { useAgentStore } from "@/stores/useAgentStore";
import { commands } from "@/lib/tauri-commands";
import { toast } from "sonner";

export function QAPage() {
  const { id } = useParams<{ id: string }>();
  const { productBrains, loadProductBrain, updateProductBrain } = useProjectStore();
  const { deliverables, fetchDeliverables, saveDeliverable } = useDeliverablesStore();
  const { generate } = useAgentStore();
  const [releaseReady, setReleaseReady] = useState(false);

  const brain = id ? productBrains[id] : null;
  const qaDeliverable = id
    ? deliverables[id]?.find((d) => d.type === "qa_test_cases")
    : null;
  const releaseDeliverable = id
    ? deliverables[id]?.find((d) => d.type === "release_checklist")
    : null;

  useEffect(() => {
    if (id) {
      loadProductBrain(id);
      fetchDeliverables(id);
    }
  }, [id, loadProductBrain, fetchDeliverables]);

  const generateQA = async () => {
    if (!id || !brain) return;
    try {
      const content = await generate("qa", brain, "qa_test_cases");
      await saveDeliverable({
        id: crypto.randomUUID(),
        projectId: id,
        type: "qa_test_cases",
        title: "QA Test Cases",
        content,
        status: "draft",
        version: 1,
      });
      toast.success("QA test cases generated");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const generateRelease = async () => {
    if (!id || !brain) return;
    try {
      const content = await generate("release", brain, "release_checklist");
      await saveDeliverable({
        id: crypto.randomUUID(),
        projectId: id,
        type: "release_checklist",
        title: "Release Checklist",
        content,
        status: "draft",
        version: 1,
      });
      toast.success("Release checklist generated");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const markReleaseReady = async () => {
    if (!id || !brain) return;
    await updateProductBrain(id, { ...brain, status: "release_ready" });
    setReleaseReady(true);
    await commands.logActivity(id, "release_ready", {});
    toast.success("Project marked as release ready!");
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">QA & Release</h1>
      <p className="mb-8 text-muted-foreground">
        Test cases, release checklist, and readiness
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">QA Test Cases</CardTitle>
              {qaDeliverable && (
                <Badge variant="secondary">{qaDeliverable.status}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={generateQA} className="mb-4">
              Generate QA Cases
            </Button>
            {qaDeliverable && (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                {qaDeliverable.content}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Release Checklist</CardTitle>
              {releaseDeliverable && (
                <Badge variant="secondary">{releaseDeliverable.status}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={generateRelease} className="mb-4">
              Generate Release Checklist
            </Button>
            {releaseDeliverable && (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                {releaseDeliverable.content}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Release Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          {releaseReady || brain?.status === "release_ready" ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Project is release ready!</span>
            </div>
          ) : (
            <Button onClick={markReleaseReady}>
              Mark Release Ready
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
