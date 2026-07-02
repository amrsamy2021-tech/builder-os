import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/stores/useProjectStore";
import { useDeliverablesStore } from "@/stores/useDeliverablesStore";
import { useScreensStore } from "@/stores/useScreensStore";
import { getScreenQACases, getScreenQAStats } from "@/lib/screen-hub";
import { ImportScreensButton } from "./ImportScreensButton";
import { ScreenFormDialog } from "./ScreenFormDialog";
import type { ScreenSpec } from "@/types/product-brain";
import { toast } from "sonner";

export function ScreensPage() {
  const { id } = useParams<{ id: string }>();
  const { productBrains, loadProductBrain } = useProjectStore();
  const { deliverables, fetchDeliverables } = useDeliverablesStore();
  const { addScreen } = useScreensStore();
  const [showAdd, setShowAdd] = useState(false);

  const brain = id ? productBrains[id] : null;
  const projectDeliverables = id ? deliverables[id] ?? [] : [];

  useEffect(() => {
    if (id) {
      loadProductBrain(id);
      fetchDeliverables(id);
    }
  }, [id, loadProductBrain, fetchDeliverables]);

  const handleAddScreen = async (screen: ScreenSpec) => {
    if (!id || !brain) return;
    try {
      const updated = await addScreen(id, brain, screen);
      useProjectStore.setState((s) => ({
        productBrains: { ...s.productBrains, [id]: updated },
      }));
      toast.success(`Added screen "${screen.name}"`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (!id || !brain) {
    return <div className="p-8 text-muted-foreground">Loading screens...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Layout className="h-8 w-8" />
            Screens
          </h1>
          <p className="text-muted-foreground">
            Per-screen hub: Notion PRD, Figma, and test cases
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportScreensButton
            projectId={id}
            brain={brain}
            deliverables={projectDeliverables}
            onImported={(updated) =>
              useProjectStore.setState((s) => ({
                productBrains: { ...s.productBrains, [id]: updated },
              }))
            }
          />
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add screen
          </Button>
        </div>
      </div>

      {brain.screens.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No screens yet. Generate Screen List / Screen Specs in Deliverables, then import — or
              add manually.
            </p>
            <Button asChild variant="outline">
              <Link to={`/projects/${id}/deliverables`}>Go to Deliverables</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brain.screens.map((screen) => {
            const cases = getScreenQACases(brain, screen.id);
            const stats = getScreenQAStats(cases);
            return (
              <Link key={screen.id} to={`/projects/${id}/screens/${screen.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{screen.name}</CardTitle>
                      {screen.devStatus && screen.devStatus !== "not_started" && (
                        <Badge variant="secondary">{screen.devStatus.replace("_", " ")}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {screen.purpose || "No purpose set"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {screen.notionPageUrl ? (
                        <Badge variant="outline">Notion</Badge>
                      ) : (
                        <Badge variant="outline" className="opacity-50">
                          No Notion
                        </Badge>
                      )}
                      {screen.figmaUrl ? (
                        <Badge variant="outline">Figma</Badge>
                      ) : (
                        <Badge variant="outline" className="opacity-50">
                          No Figma
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      QA: {stats.pass}/{stats.total} passed
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <ScreenFormDialog open={showAdd} onOpenChange={setShowAdd} onSave={handleAddScreen} />
    </div>
  );
}
