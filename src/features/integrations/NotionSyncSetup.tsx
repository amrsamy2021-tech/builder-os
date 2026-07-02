import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink } from "lucide-react";

interface NotionSyncSetupProps {
  syncToken: string;
  onSyncTokenChange: (value: string) => void;
  onSave: () => void;
  onTest?: () => void;
  saving?: boolean;
  testing?: boolean;
  syncReady?: boolean;
  compact?: boolean;
}

export function NotionSyncSetup({
  syncToken,
  onSyncTokenChange,
  onSave,
  onTest,
  saving = false,
  testing = false,
  syncReady = false,
  compact = false,
}: NotionSyncSetupProps) {
  return (
    <Card className={compact ? "border-dashed bg-muted/20" : ""}>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Notion page sync (Builder OS)</CardTitle>
          {syncReady && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Sync ready
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs leading-relaxed">
          MCP connects Notion inside Cursor only. To create pages from Builder OS,
          add a Notion <strong>integration token</strong> (one-time, ~2 minutes).
          You can keep MCP connected at the same time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          <li>
            Open{" "}
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              notion.so/my-integrations
            </a>
          </li>
          <li>New integration → name it &quot;Builder OS&quot;</li>
          <li>Copy the <strong>Internal Integration Secret</strong> (starts with ntn_ or secret_)</li>
          <li>In Notion, open your parent page → ⋯ → Connections → add &quot;Builder OS&quot;</li>
          <li>Paste the token below and save</li>
        </ol>

        <div>
          <Label htmlFor="notion-sync-token">Integration token</Label>
          <Input
            id="notion-sync-token"
            type="password"
            value={syncToken}
            onChange={(e) => onSyncTokenChange(e.target.value)}
            placeholder="ntn_... or secret_..."
            className="mt-1"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || !syncToken.trim()}>
            {saving ? "Saving..." : syncReady ? "Update sync token" : "Save sync token"}
          </Button>
          {syncReady && onTest && (
            <Button size="sm" variant="outline" onClick={onTest} disabled={testing}>
              {testing ? "Testing..." : "Test sync"}
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <a href="https://developers.notion.com/docs/create-a-notion-integration" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" />
              Docs
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
