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
  const cancelJob = useAgentJobsStore((s) => s.cancelJob);
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
        <ScrollArea className="max-h-64">
          <ul className="space-y-2">
            {jobs.map((job) => {
              const displayOutput = job.liveOutput ?? job.output;
              const isRunning = job.status === "running" || job.id === activeJobId;
              return (
                <li key={job.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{job.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          job.status === "done"
                            ? "success"
                            : job.status === "failed"
                              ? "destructive"
                              : job.status === "cancelled"
                                ? "outline"
                                : isRunning
                                  ? "warning"
                                  : "secondary"
                        }
                      >
                        {job.status}
                      </Badge>
                      {isRunning && (
                        <Button size="sm" variant="outline" onClick={() => cancelJob(job.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                  {job.error && job.status !== "cancelled" && (
                    <p className="mt-1 text-xs text-destructive">{job.error}</p>
                  )}
                  {displayOutput && (
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {isRunning
                        ? displayOutput.slice(-1200)
                        : displayOutput.slice(0, 800)}
                      {!isRunning && displayOutput.length > 800 ? "…" : ""}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
