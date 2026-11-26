import { useState } from "react";
import { RouterProvider } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BootGate } from "./boot-gate";
import { createAppRouter } from "./router";

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <BootGate>
        <RouterProvider router={router} />
      </BootGate>
    </TooltipProvider>
  );
}
