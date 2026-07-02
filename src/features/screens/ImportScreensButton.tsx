import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScreensStore } from "@/stores/useScreensStore";
import type { ProductBrain } from "@/types/product-brain";
import type { Deliverable } from "@/lib/tauri-commands";
import { toast } from "sonner";

interface ImportScreensButtonProps {
  projectId: string;
  brain: ProductBrain;
  deliverables: Deliverable[];
  onImported: (brain: ProductBrain) => void;
}

export function ImportScreensButton({
  projectId,
  brain,
  deliverables,
  onImported,
}: ImportScreensButtonProps) {
  const { importFromDeliverables } = useScreensStore();
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      const result = await importFromDeliverables(projectId, brain, deliverables);
      onImported(result.brain);
      toast.success(
        `Imported ${result.screensAdded} screens (${result.screensUpdated} updated), ${result.qaCasesAdded} test cases`,
      );
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleImport} disabled={loading}>
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Importing..." : "Import from deliverables"}
    </Button>
  );
}
