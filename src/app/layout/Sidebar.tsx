import { NavLink } from "react-router-dom";
import {
  Brain,
  LayoutDashboard,
  GitBranch,
  FileText,
  Plug,
  Activity,
  Settings,
  FolderOpen,
  Home,
  Layout,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { WindowDragRegion } from "@/components/WindowDragRegion";

const NAV_ITEMS = [
  { to: "/welcome", label: "Home", icon: Home, end: true },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/connect-tools", label: "Connected Tools", icon: Plug },
  { to: "/activity", label: "Activity Log", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

const PROJECT_NAV = [
  { segment: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { segment: "workflow", label: "Product Cycle", icon: GitBranch },
  { segment: "product-brain", label: "Product Brain", icon: Brain },
  { segment: "screens", label: "Screens", icon: Layout },
  { segment: "deliverables", label: "Deliverables", icon: FileText },
  { segment: "integrations", label: "Integrations", icon: Plug },
  { segment: "qa", label: "QA & Release", icon: Activity },
];

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      <WindowDragRegion className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Brain className="h-5 w-5 shrink-0" />
        <span className="font-semibold">Builder OS</span>
      </WindowDragRegion>

      <nav className="flex-1 space-y-1 overflow-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {projectId && (
          <>
            <Separator className="my-3" />
            <p className="mb-2 px-3 text-xs font-medium uppercase text-muted-foreground">
              Project
            </p>
            {PROJECT_NAV.map((item) => (
              <NavLink
                key={item.segment}
                to={`/projects/${projectId}/${item.segment}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
