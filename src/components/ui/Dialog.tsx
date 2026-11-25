"use client";

import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import { iconMotion } from "@/components/ui/motion-presets";

/*
 * Dialogs and drawers (CLAUDE.md 14.9). Built on Radix: portal, focus trap, focus return, Escape and scroll lock
 * come for free. Overlay and content use the z-index scale only.
 */
export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export function DialogContent({
  title,
  description,
  hideTitle,
  variant = "center",
  showClose = true,
  closeLabel,
  className,
  children,
  onOpenAutoFocus,
}: {
  title: string;
  description?: string;
  /** Keep the title for screen readers but do not show it. */
  hideTitle?: boolean;
  /** `center`: a modal in the middle. `drawer`: a panel from the left edge. */
  variant?: "center" | "drawer";
  showClose?: boolean;
  closeLabel?: string;
  className?: string;
  children: React.ReactNode;
  onOpenAutoFocus?: (e: Event) => void;
}) {
  const t = useTranslations("ui");
  const drawer = variant === "drawer";
  return (
    <RD.Portal>
      <RD.Overlay className={cn("o-overlay fixed inset-0 bg-ink/50", drawer ? "z-drawer" : "z-overlay")} />
      <RD.Content
        onOpenAutoFocus={onOpenAutoFocus}
        aria-describedby={description ? undefined : undefined}
        className={cn(
          drawer
            ? "o-drawer z-drawer fixed inset-y-0 left-0 w-[min(320px,86vw)] overflow-auto bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_0_60px_rgba(10,26,38,0.3)]"
            : "o-dialog z-modal fixed inset-0 m-auto h-fit max-h-[90dvh] w-[min(520px,calc(100vw-2rem))] overflow-auto rounded-3xl bg-white p-6 shadow-[0_30px_80px_rgba(10,26,38,0.35)]",
          className,
        )}
      >
        <RD.Title className={cn("m-0 text-xl font-semibold", hideTitle && "sr-only")}>{title}</RD.Title>
        {description ? <RD.Description className="mb-0 mt-1 text-sm text-text-2">{description}</RD.Description> : null}
        {children}
        {showClose ? (
          <RD.Close asChild>
            <motion.button
              type="button"
              {...iconMotion}
              aria-label={closeLabel ?? t("close")}
              className="icon-press absolute right-3 top-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-surface"
            >
              <X size={20} aria-hidden="true" />
            </motion.button>
          </RD.Close>
        ) : null}
      </RD.Content>
    </RD.Portal>
  );
}
