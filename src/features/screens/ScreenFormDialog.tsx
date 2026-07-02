import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ScreenSpec } from "@/types/product-brain";

interface ScreenFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ScreenSpec;
  onSave: (screen: ScreenSpec) => void;
}

export function ScreenFormDialog({ open, onOpenChange, initial, onSave }: ScreenFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [componentsText, setComponentsText] = useState(initial?.components.join("\n") ?? "");
  const [statesText, setStatesText] = useState(initial?.states.join("\n") ?? "");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      purpose: purpose.trim(),
      components: componentsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      states: statesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      designStatus: initial?.designStatus ?? "none",
      devStatus: initial?.devStatus ?? "not_started",
      notionPageId: initial?.notionPageId,
      notionPageUrl: initial?.notionPageUrl,
      figmaFileKey: initial?.figmaFileKey,
      figmaNodeId: initial?.figmaNodeId,
      figmaUrl: initial?.figmaUrl,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Screen" : "Add Screen"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="screen-name">Name</Label>
            <Input id="screen-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="screen-purpose">Purpose</Label>
            <Textarea
              id="screen-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="screen-components">Components (one per line)</Label>
            <Textarea
              id="screen-components"
              value={componentsText}
              onChange={(e) => setComponentsText(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="screen-states">States (one per line)</Label>
            <Textarea
              id="screen-states"
              value={statesText}
              onChange={(e) => setStatesText(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
