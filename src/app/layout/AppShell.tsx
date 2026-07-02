import { Outlet, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar projectId={id} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
