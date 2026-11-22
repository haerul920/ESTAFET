"use client";

import * as RT from "@radix-ui/react-tooltip";

/** Wrap the app once. */
export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <RT.Provider delayDuration={250} skipDelayDuration={150}>
    {children}
  </RT.Provider>
);

/** A short hint for a control or a value (for example an absolute time). The child must be focusable. */
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          sideOffset={6}
          collisionPadding={8}
          className="o-menu z-toast max-w-[280px] rounded-xl bg-black px-3 py-1.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(10,26,38,0.3)]"
        >
          {label}
          <RT.Arrow className="fill-black" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
