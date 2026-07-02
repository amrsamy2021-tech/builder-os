import { useState } from "react";
import { ExternalLink, Link2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseFigmaUrl } from "@/lib/screen-hub";
import type { ScreenSpec } from "@/types/product-brain";

interface ScreenLinkTagsProps {
  screen: ScreenSpec;
  onUpdateFigma: (url: string) => void;
  onSyncNotion: () => void;
  syncingNotion?: boolean;
}

export function ScreenLinkTags({
  screen,
  onUpdateFigma,
  onSyncNotion,
  syncingNotion,
}: ScreenLinkTagsProps) {
  const [editingFigma, setEditingFigma] = useState(false);
  const [figmaInput, setFigmaInput] = useState(screen.figmaUrl ?? "");

  const saveFigma = () => {
    onUpdateFigma(figmaInput);
    setEditingFigma(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {screen.notionPageUrl ? (
        <a
          href={screen.notionPageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-transparent bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          Notion PRD
        </a>
      ) : (
        <Button size="sm" variant="outline" onClick={onSyncNotion} disabled={syncingNotion}>
          <Link2 className="mr-1 h-3 w-3" />
          {syncingNotion ? "Syncing..." : "Sync to Notion"}
        </Button>
      )}

      {screen.figmaUrl && !editingFigma ? (
        <a
          href={screen.figmaUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-transparent bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
        >
          <Palette className="h-3 w-3" />
          Figma
        </a>
      ) : null}

      {!screen.figmaUrl && !editingFigma ? (
        <Button size="sm" variant="outline" onClick={() => setEditingFigma(true)}>
          <Palette className="mr-1 h-3 w-3" />
          Connect Figma
        </Button>
      ) : null}

      {editingFigma ? (
        <div className="flex w-full flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="figma-url">Figma frame URL</Label>
            <Input
              id="figma-url"
              value={figmaInput}
              onChange={(e) => setFigmaInput(e.target.value)}
              placeholder="https://www.figma.com/design/..."
              className="mt-1"
            />
            {figmaInput && !parseFigmaUrl(figmaInput) && (
              <p className="mt-1 text-xs text-destructive">Paste a valid Figma design URL</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveFigma} disabled={!parseFigmaUrl(figmaInput)}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingFigma(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        screen.figmaUrl && (
          <Button size="sm" variant="ghost" onClick={() => setEditingFigma(true)}>
            Edit Figma link
          </Button>
        )
      )}

      {screen.notionPageUrl && (
        <Button size="sm" variant="ghost" onClick={onSyncNotion} disabled={syncingNotion}>
          Re-sync Notion
        </Button>
      )}
    </div>
  );
}
