import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";

interface WindowDragRegionProps {
  className?: string;
  children?: React.ReactNode;
}

export function WindowDragRegion({ className, children }: WindowDragRegionProps) {
  const onMouseDown = async (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, [data-no-drag]")) return;
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Ignore if not running inside Tauri
    }
  };

  return (
    <div
      data-tauri-drag-region
      onMouseDown={onMouseDown}
      className={cn("titlebar-drag select-none", className)}
    >
      {children}
    </div>
  );
}
