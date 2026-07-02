import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Sparkles, Check, RefreshCw, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useAgentStore } from "@/stores/useAgentStore";
import { useIntegrationStore } from "@/stores/useIntegrationStore";
import { ApprovalGate } from "@/features/workflow/ApprovalGate";
import { DeliverableEditorDialog } from "@/features/deliverables/DeliverableEditorDialog";
import {
  AGENT_DELIVERABLE_MAP,
  DELIVERABLE_LABELS,
} from "@/features/agents/prompts";
import type { Deliverable } from "@/lib/tauri-commands";
import { toast } from "sonner";

export function DeliverablesPage() {
  const { id } = useParams<{ id: string }>();
  const {
    deliverables,
    fetchDeliverables,
    saveDeliverable,
    approveDeliverable,
    updateDeliverableContent,
    syncDeliverableToNotion,
    getByType,
  } = useDeliverablesStore();
  const { productBrains, loadProductBrain, updateProductBrain, projects } = useProjectStore();
  const { fetchIntegrations, notionSyncReady, checkNotionSyncReady } =
    useIntegrationStore();
  const { generating, streamingContent, generate } = useAgentStore();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const projectDeliverables = id ? deliverables[id] ?? [] : [];
  const brain = id ? productBrains[id] : null;
  const canSyncToNotion = notionSyncReady;

  const openEditor = (deliverable: Deliverable) => {
    setEditingDeliverable(deliverable);
    setEditorOpen(true);
  };

  const project = projects.find((p) => p.id === id);

  const handleGenerate = useCallback(async (type: string) => {
    if (!id || !brain) return;
    setSelectedType(type);
    const mapping = AGENT_DELIVERABLE_MAP[type];
    if (!mapping) return;
    try {
      const content = await generate(
        mapping.agent,
        brain,
        type,
        DELIVERABLE_LABELS[type] ?? type,
        undefined,
        project?.folderPath,
      );
      const existing = getByType(id, type);
      const saved = await saveDeliverable({
        id: existing?.id ?? crypto.randomUUID(),
        projectId: id,
        type,
        title: DELIVERABLE_LABELS[type] ?? type,
        content,
        status: "draft",
        version: existing ? existing.version + 1 : 1,
      });
      openEditor(saved);
      toast.success(`Generated ${DELIVERABLE_LABELS[type]}`);
    } catch (e) {
      toast.error(String(e));
    }
  }, [id, brain, generate, getByType, saveDeliverable, project?.folderPath]);

  useEffect(() => {
    if (!id) return;
    fetchDeliverables(id);
    loadProductBrain(id);
    fetchIntegrations();
    checkNotionSyncReady();
  }, [id, fetchDeliverables, loadProductBrain, fetchIntegrations, checkNotionSyncReady]);

  useEffect(() => {
    const generateType = searchParams.get("generate");
    if (generateType && id && brain && !generating) {
      handleGenerate(generateType);
      setSearchParams({}, { replace: true });
    }
    const viewType = searchParams.get("type");
    if (viewType && id) {
      const existing = getByType(id, viewType);
      if (existing) {
        openEditor(existing);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, id, brain, generating, handleGenerate, setSearchParams, getByType]);

  const handleApprove = (deliverableId: string) => {
    setApprovingId(deliverableId);
    setApprovalOpen(true);
  };

  const handleSync = async (deliverable: Deliverable) => {
    if (!id || !brain) return;
    try {
      const updated = await syncDeliverableToNotion(id, deliverable.id, brain, async (b) => {
        await updateProductBrain(id, b);
      });
      if (updated.notionPageId !== brain.notionPageId) {
        await updateProductBrain(id, updated);
      }
      const refreshed = getByType(id, deliverable.type) ?? deliverable;
      setEditingDeliverable(refreshed);
      toast.success("Synced to Notion");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const selectedDeliverable = projectDeliverables.find((d) => d.id === approvingId);

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Deliverables</h1>
      <p className="mb-8 text-muted-foreground">
        Generate, view, edit, approve, and sync product artifacts to Notion
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
              const existing = getByType(id ?? "", type);
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
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleGenerate(type)}
                      disabled={generating}
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      {existing ? "Regenerate" : "Generate"}
                    </Button>
                    {existing && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditor(existing)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View / Edit
                      </Button>
                    )}
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
                    {existing &&
                      canSyncToNotion &&
                      existing.status !== "draft" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSync(existing)}
                        >
                          <Upload className="mr-1 h-3 w-3" />
                          Sync
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => openEditor(d)}
                  >
                    View / Edit
                  </Button>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <Badge variant="success">{d.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditor(d)}>
                    View / Edit
                  </Button>
                  {canSyncToNotion && (
                    <Button size="sm" variant="secondary" onClick={() => handleSync(d)}>
                      Sync to Notion
                    </Button>
                  )}
                </CardContent>
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

      <DeliverableEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        deliverable={editingDeliverable}
        notionConnected={canSyncToNotion}
        notionPageUrl={editingDeliverable?.notionPageUrl ?? brain?.notionPageUrl}
        onSave={async (content) => {
          if (!id || !editingDeliverable) return;
          const saved = await updateDeliverableContent(id, editingDeliverable, content);
          setEditingDeliverable(saved);
          toast.success("Changes saved");
        }}
        onSync={
          editingDeliverable
            ? async () => handleSync(editingDeliverable)
            : undefined
        }
      />

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
