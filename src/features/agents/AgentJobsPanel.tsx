import { useAgentJobsStore } from "@/stores/useAgentJobsStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgentJobsPanelProps {
  projectId: string;
}

export function AgentJobsPanel({ projectId }: AgentJobsPanelProps) {
  const jobs = useAgentJobsStore((s) => s.getProjectJobs(projectId));
  const clearFinished = useAgentJobsStore((s) => s.clearFinished);
  const activeJobId = useAgentJobsStore((s) => s.activeJobId);

  if (jobs.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Agent jobs</CardTitle>
          <Button size="sm" variant="ghost" onClick={clearFinished}>
            Clear finished
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-48">
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{job.label}</span>
                  <Badge
                    variant={
                      job.status === "done"
                        ? "success"
                        : job.status === "failed"
                          ? "destructive"
                          : job.status === "running" || job.id === activeJobId
                            ? "warning"
                            : "secondary"
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
                {job.error && (
                  <p className="mt-1 text-xs text-destructive">{job.error}</p>
                )}
                {job.output && job.status === "done" && (
                  <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {job.output.slice(0, 400)}
                    {job.output.length > 400 ? "…" : ""}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
