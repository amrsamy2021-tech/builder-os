import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { GlobalLoadingOverlay } from "@/components/GlobalLoadingOverlay";
import { initCursorAgentListeners } from "@/lib/cursor-agent-events";
import { router } from "./router";

export function App() {
  useEffect(() => {
    initCursorAgentListeners().catch(console.error);
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <GlobalLoadingOverlay />
      <Toaster position="bottom-right" />
    </>
  );
}
