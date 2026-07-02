import { useState, useEffect } from "react";
import { ExternalLink, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Deliverable } from "@/lib/tauri-commands";

interface DeliverableEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliverable: Deliverable | null;
  notionConnected?: boolean;
  notionPageUrl?: string;
  onSave: (content: string) => Promise<void>;
  onSync?: () => Promise<void>;
}

export function DeliverableEditorDialog({
  open,
  onOpenChange,
  deliverable,
  notionConnected = false,
  notionPageUrl,
  onSave,
  onSync,
}: DeliverableEditorDialogProps) {
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (open && deliverable) {
      setContent(deliverable.content);
      setMode("view");
    }
  }, [open, deliverable]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  if (!deliverable) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
      setMode("view");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!onSync) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  const canSync =
    notionConnected &&
    deliverable.status !== "draft" &&
    content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{deliverable.title}</DialogTitle>
            <Badge
              variant={
                deliverable.status === "approved" || deliverable.status === "synced"
                  ? "success"
                  : "secondary"
              }
            >
              {deliverable.status}
            </Badge>
          </div>
          <DialogDescription>v{deliverable.version}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "view" | "edit")}
          className="min-h-0 flex-1"
        >
          <TabsList>
            <TabsTrigger value="view">View</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="mt-4 max-h-[50vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
              {content || deliverable.content}
            </pre>
          </TabsContent>

          <TabsContent value="edit" className="mt-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[50vh] font-mono text-sm"
              placeholder="Edit deliverable content..."
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {notionPageUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={notionPageUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Open Notion
                </a>
              </Button>
            )}
            {canSync && onSync && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSync}
                disabled={syncing || saving}
              >
                {syncing ? "Syncing..." : deliverable.status === "synced" ? "Re-sync to Notion" : "Sync to Notion"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {mode === "edit" && (
              <Button onClick={handleSave} disabled={saving || syncing}>
                <Save className="mr-1 h-3 w-3" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
