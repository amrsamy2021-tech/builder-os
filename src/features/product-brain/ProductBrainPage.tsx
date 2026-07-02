import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectStore } from "@/stores/useProjectStore";

export function ProductBrainPage() {
  const { id } = useParams<{ id: string }>();
  const { productBrains, loadProductBrain } = useProjectStore();

  const brain = id ? productBrains[id] : null;

  useEffect(() => {
    if (id) loadProductBrain(id);
  }, [id, loadProductBrain]);

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Product Brain</h1>
      <p className="mb-8 text-muted-foreground">
        Single source of truth for your project
      </p>

      {brain ? (
        <ScrollArea className="h-[calc(100vh-200px)] rounded-lg border p-4">
          <pre className="text-xs">{JSON.stringify(brain, null, 2)}</pre>
        </ScrollArea>
      ) : (
        <p className="text-muted-foreground">Loading product brain...</p>
      )}
    </div>
  );
}
