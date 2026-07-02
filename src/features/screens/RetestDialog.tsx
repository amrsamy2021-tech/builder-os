import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { QATestCase } from "@/types/product-brain";

interface RetestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: QATestCase | null;
  onResult: (status: "pass" | "fail", note?: string) => void;
}

export function RetestDialog({ open, onOpenChange, testCase, onResult }: RetestDialogProps) {
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState<boolean[]>([]);

  if (!testCase) return null;

  const steps = testCase.steps.length > 0 ? testCase.steps : ["Run the test manually"];

  const toggleStep = (idx: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const submit = (status: "pass" | "fail") => {
    onResult(status, note.trim() || undefined);
    setNote("");
    setChecked([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-test: {testCase.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Steps</p>
            <ul className="space-y-2">
              {steps.map((step, idx) => (
                <li key={idx}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked[idx] ?? false}
                      onChange={() => toggleStep(idx)}
                      className="mt-1"
                    />
                    <span>{step}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Expected result</p>
            <p className="text-sm text-muted-foreground">
              {testCase.expectedResult || "As described in the test case"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Notes (optional)</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => submit("fail")}>
            Mark Fail
          </Button>
          <Button onClick={() => submit("pass")}>Mark Pass</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
