import { Outlet, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { WindowDragRegion } from "@/components/WindowDragRegion";

export function AppShell() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <WindowDragRegion className="h-8 shrink-0 border-b bg-background" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar projectId={id} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
