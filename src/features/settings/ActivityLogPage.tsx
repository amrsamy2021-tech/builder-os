import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActivityLogStore } from "@/stores/useActivityLogStore";

export function ActivityLogPage() {
  const { entries, fetch, loading } = useActivityLogStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Activity Log</h1>
      <p className="mb-8 text-muted-foreground">
        All actions performed by Builder OS
      </p>

      {loading && <p className="text-muted-foreground">Loading...</p>}

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {entry.action}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              {entry.details && (
                <CardContent className="pt-0">
                  <pre className="text-xs text-muted-foreground">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))}
          {entries.length === 0 && !loading && (
            <p className="text-muted-foreground">No activity yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
