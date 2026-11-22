"use client";

import { TooltipProvider } from "./Tooltip";
import { ToastProvider } from "./Toast";

/** Tooltips and toasts for the whole app. Mounted once in the locale layout. */
export function UiProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider>{children}</ToastProvider>
    </TooltipProvider>
  );
}
