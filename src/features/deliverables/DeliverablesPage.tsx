import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useAgentStore } from "@/stores/useAgentStore";
import { ApprovalGate } from "@/features/workflow/ApprovalGate";
import {
  AGENT_DELIVERABLE_MAP,
  DELIVERABLE_LABELS,
} from "@/features/agents/prompts";
import { toast } from "sonner";

export function DeliverablesPage() {
  const { id } = useParams<{ id: string }>();
  const { deliverables, fetchDeliverables, saveDeliverable, approveDeliverable } =
    useDeliverablesStore();
  const { productBrains, loadProductBrain } = useProjectStore();
  const { generating, streamingContent, generate } = useAgentStore();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const projectDeliverables = id ? deliverables[id] ?? [] : [];
  const brain = id ? productBrains[id] : null;

  useEffect(() => {
    if (!id) return;
    fetchDeliverables(id);
    loadProductBrain(id);
  }, [id, fetchDeliverables, loadProductBrain]);

  const handleGenerate = async (type: string) => {
    if (!id || !brain) return;
    setSelectedType(type);
    const mapping = AGENT_DELIVERABLE_MAP[type];
    if (!mapping) return;
    try {
      const content = await generate(mapping.agent, brain, type);
      await saveDeliverable({
        id: crypto.randomUUID(),
        projectId: id,
        type,
        title: DELIVERABLE_LABELS[type] ?? type,
        content,
        status: "draft",
        version: 1,
      });
      toast.success(`Generated ${DELIVERABLE_LABELS[type]}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleApprove = (deliverableId: string) => {
    setApprovingId(deliverableId);
    setApprovalOpen(true);
  };

  const selectedDeliverable = projectDeliverables.find((d) => d.id === approvingId);

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Deliverables</h1>
      <p className="mb-8 text-muted-foreground">
        Generate, review, and approve product artifacts
      </p>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(DELIVERABLE_LABELS).map(([type, label]) => {
              const existing = projectDeliverables.find((d) => d.type === type);
              return (
                <Card key={type}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{label}</CardTitle>
                      {existing && (
                        <Badge
                          variant={
                            existing.status === "approved"
                              ? "success"
                              : existing.status === "synced"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {existing.status}
                        </Badge>
                      )}
                    </div>
                    {existing && (
                      <CardDescription>v{existing.version}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleGenerate(type)}
                      disabled={generating}
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      {existing ? "Regenerate" : "Generate"}
                    </Button>
                    {existing && existing.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(existing.id)}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Approve
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="draft" className="mt-6">
          {projectDeliverables
            .filter((d) => d.status === "draft")
            .map((d) => (
              <Card key={d.id} className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">{d.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-48">
                    <pre className="whitespace-pre-wrap text-xs">{d.content}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          {projectDeliverables
            .filter((d) => d.status === "approved" || d.status === "synced")
            .map((d) => (
              <Card key={d.id} className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">{d.title}</CardTitle>
                  <Badge variant="success">{d.status}</Badge>
                </CardHeader>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {generating && selectedType && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Generating {DELIVERABLE_LABELS[selectedType]}...
            </CardTitle>
          </CardHeader>
          {streamingContent && (
            <CardContent>
              <ScrollArea className="max-h-64">
                <pre className="whitespace-pre-wrap text-xs">{streamingContent}</pre>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      <ApprovalGate
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        action={`Approve deliverable: ${selectedDeliverable?.title}`}
        preview={selectedDeliverable?.content ?? ""}
        riskLevel="low"
        onApprove={async () => {
          if (id && approvingId) {
            await approveDeliverable(id, approvingId);
            toast.success("Deliverable approved");
          }
        }}
        onReject={() => setApprovalOpen(false)}
      />
    </div>
  );
}
