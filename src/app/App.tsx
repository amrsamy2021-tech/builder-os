import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { GlobalLoadingOverlay } from "@/components/GlobalLoadingOverlay";
import { router } from "./router";

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <GlobalLoadingOverlay />
      <Toaster position="bottom-right" />
    </>
  );
}
