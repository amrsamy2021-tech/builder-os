import { Loader2 } from "lucide-react";
import { useLoadingStore } from "@/stores/useLoadingStore";
import { useAgentStore } from "@/stores/useAgentStore";

export function GlobalLoadingOverlay() {
  const count = useLoadingStore((s) => s.count);
  const message = useLoadingStore((s) => s.message);
  const generating = useAgentStore((s) => s.generating);
  const taskLabel = useAgentStore((s) => s.taskLabel);

  const active = count > 0 || generating;
  if (!active) return null;

  const displayMessage =
    message ||
    (generating && taskLabel ? `Generating ${taskLabel}...` : "Generating with AI...") ||
    "Working...";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/75 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-10 py-8 shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
        </div>
        <p className="max-w-xs text-center text-sm font-medium text-foreground">
          {displayMessage}
        </p>
        <p className="text-xs text-muted-foreground">Please wait</p>
      </div>
    </div>
  );
}
