import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ApprovalGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
  preview: string;
  riskLevel: "low" | "medium" | "high";
  onApprove: () => Promise<void>;
  onReject: () => void;
  loading?: boolean;
}

export function ApprovalGate({
  open,
  onOpenChange,
  action,
  preview,
  riskLevel,
  onApprove,
  onReject,
  loading,
}: ApprovalGateProps) {
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
      onOpenChange(false);
    } finally {
      setApproving(false);
    }
  };

  const riskVariant =
    riskLevel === "high"
      ? "destructive"
      : riskLevel === "medium"
        ? "warning"
        : "secondary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Approval Required
            <Badge variant={riskVariant}>{riskLevel} risk</Badge>
          </DialogTitle>
          <DialogDescription>{action}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-64 rounded-md border p-4">
          <pre className="whitespace-pre-wrap text-sm">{preview}</pre>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onReject} disabled={approving || loading}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={approving || loading}>
            {approving ? "Approving..." : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
