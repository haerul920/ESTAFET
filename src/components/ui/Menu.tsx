"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

/** Dropdown menu on Radix: portal, keyboard navigation, collision flipping, focus return. */
export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({
  className,
  children,
  align = "end",
}: {
  className?: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          "o-menu z-dropdown w-60 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-3xl border border-line bg-white p-2 text-ink shadow-[0_20px_50px_rgba(10,60,150,0.2)]",
          className,
        )}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="m-0 truncate px-3 py-2 text-sm font-semibold">{children}</DM.Label>;
}

/** An item. Use `asChild` with a link or button to keep real elements. */
export const MenuItem = ({ className, ...props }: React.ComponentProps<typeof DM.Item>) => (
  <DM.Item
    className={cn(
      "flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3 text-left text-[15px] text-ink no-underline outline-none data-[highlighted]:bg-surface",
      className,
    )}
    {...props}
  />
);
