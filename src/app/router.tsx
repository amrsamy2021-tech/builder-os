import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { WelcomePage } from "@/features/projects/WelcomePage";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { ProjectWizardPage } from "@/features/projects/ProjectWizardPage";
import { DashboardPage } from "@/features/projects/DashboardPage";
import { WorkflowPage } from "@/features/workflow/WorkflowPage";
import { ProductBrainPage } from "@/features/product-brain/ProductBrainPage";
import { DeliverablesPage } from "@/features/deliverables/DeliverablesPage";
import { QAPage } from "@/features/deliverables/QAPage";
import { ConnectToolsPage } from "@/features/integrations/ConnectToolsPage";
import { ProjectIntegrationsPage } from "@/features/integrations/ProjectIntegrationsPage";
import { ActivityLogPage } from "@/features/settings/ActivityLogPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/welcome" replace /> },
      { path: "welcome", element: <WelcomePage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/new", element: <ProjectWizardPage /> },
      { path: "projects/:id/dashboard", element: <DashboardPage /> },
      { path: "projects/:id/workflow", element: <WorkflowPage /> },
      { path: "projects/:id/product-brain", element: <ProductBrainPage /> },
      { path: "projects/:id/deliverables", element: <DeliverablesPage /> },
      { path: "projects/:id/integrations", element: <ProjectIntegrationsPage /> },
      { path: "projects/:id/qa", element: <QAPage /> },
      { path: "connect-tools", element: <ConnectToolsPage /> },
      { path: "activity", element: <ActivityLogPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
