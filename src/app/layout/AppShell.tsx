import { Outlet, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar projectId={id} />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div
            data-tauri-drag-region
            className="titlebar-drag h-7 shrink-0 border-b bg-background"
          />
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
