import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Circle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getScreenQAStats } from "@/lib/screen-hub";
import type { QATestCase } from "@/types/product-brain";
import { RetestDialog } from "./RetestDialog";

type Filter = "all" | "pending" | "fail";

interface ScreenTestCasesPanelProps {
  cases: QATestCase[];
  onRetest: (caseId: string, status: "pass" | "fail", note?: string) => void;
  onQuickStatus: (caseId: string, status: "pass" | "fail") => void;
}

function StatusBadge({ status }: { status: QATestCase["status"] }) {
  if (status === "pass") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Pass
      </Badge>
    );
  }
  if (status === "fail") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Fail
      </Badge>
    );
  }
  if (status === "manual") {
    return <Badge variant="secondary">Manual</Badge>;
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Circle className="h-3 w-3" />
      Not run
    </Badge>
  );
}

export function ScreenTestCasesPanel({
  cases,
  onRetest,
  onQuickStatus,
}: ScreenTestCasesPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [activeCase, setActiveCase] = useState<QATestCase | null>(null);
  const [runAllIdx, setRunAllIdx] = useState<number | null>(null);

  const stats = useMemo(() => getScreenQAStats(cases), [cases]);

  const filtered = useMemo(() => {
    if (filter === "pending") return cases.filter((c) => c.status === "pending");
    if (filter === "fail") return cases.filter((c) => c.status === "fail");
    return cases;
  }, [cases, filter]);

  const pendingCases = cases.filter((c) => c.status === "pending");

  const runAllPending = () => {
    if (pendingCases.length === 0) return;
    setRunAllIdx(0);
    setActiveCase(pendingCases[0]);
  };

  const handleRetestResult = (status: "pass" | "fail", note?: string) => {
    if (!activeCase) return;
    onRetest(activeCase.id, status, note);

    if (runAllIdx !== null) {
      const nextIdx = runAllIdx + 1;
      if (nextIdx < pendingCases.length) {
        setRunAllIdx(nextIdx);
        setActiveCase(pendingCases[nextIdx]);
      } else {
        setRunAllIdx(null);
        setActiveCase(null);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Test cases</CardTitle>
          <p className="text-sm text-muted-foreground">
            {stats.pass} pass · {stats.fail} fail · {stats.pending} not run
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {(["all", "pending", "fail"] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "pending" ? "Not run" : "Failed"}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={runAllPending} disabled={pendingCases.length === 0}>
            Run all pending
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No test cases for this screen. Import from QA deliverables or generate QA cases.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((testCase) => (
              <li
                key={testCase.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{testCase.title}</p>
                  {testCase.lastRunAt && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {new Date(testCase.lastRunAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={testCase.status} />
                  <Button size="sm" variant="outline" onClick={() => setActiveCase(testCase)}>
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Re-test
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onQuickStatus(testCase.id, "pass")}>
                    Pass
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onQuickStatus(testCase.id, "fail")}
                  >
                    Fail
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <RetestDialog
        open={!!activeCase}
        onOpenChange={(open) => {
          if (!open) {
            setActiveCase(null);
            setRunAllIdx(null);
          }
        }}
        testCase={activeCase}
        onResult={handleRetestResult}
      />
    </Card>
  );
}
