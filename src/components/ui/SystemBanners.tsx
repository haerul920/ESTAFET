"use client";

import { useState, useSyncExternalStore } from "react";
import { Info, OctagonAlert, TriangleAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import { iconMotion } from "@/components/ui/motion-presets";

export interface PublicAnnouncement {
  id: string;
  severity: "info" | "warning" | "critical";
  text_id: string;
  text_en: string;
  dismissible: boolean;
}

const KEY = "estafet.dismissed-announcements";
const STYLE = {
  info: "bg-blue-tint text-blue-dark",
  warning: "bg-warn-bg text-warn-ink",
  critical: "bg-[#fdecea] text-danger",
} as const;
const ICON = { info: Info, warning: TriangleAlert, critical: OctagonAlert } as const;

const CHANGED = "estafet:announcements-dismissed";

function parse(raw: string): string[] {
  try {
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * Announcements from the admins, at the top of the page. They sit in the page flow, so they push content down and never
 * cover it. A dismissed one stays dismissed in this browser (local storage; if it is blocked the banner simply comes back).
 */
export function SystemBanners({ items }: { items: PublicAnnouncement[] }) {
  const t = useTranslations("layout");
  const locale = useLocale();
  // The server cannot know what this browser dismissed, so the stored list is read on the client only.
  const stored = useSyncExternalStore(subscribe, readRaw, () => "");
  // Kept in memory too, so a dismissal still works when storage is blocked.
  const [memory, setMemory] = useState<string[]>([]);
  const dismissed = [...parse(stored), ...memory];

  const visible = items.filter((a) => !(a.dismissible && dismissed.includes(a.id)));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visible.map((a) => {
        const Icon = ICON[a.severity];
        return (
          <div
            key={a.id}
            role={a.severity === "critical" ? "alert" : "status"}
            className={cn(
              "flex items-start justify-center gap-2.5 px-4 py-2 text-[14px] font-medium",
              STYLE[a.severity],
            )}
          >
            <Icon size={18} aria-hidden="true" className="mt-0.5 flex-none" />
            <span className="min-w-0 flex-1 text-center max-sm:text-left">
              {locale === "id" ? a.text_id : a.text_en}
            </span>
            {a.dismissible ? (
              <motion.button
                {...iconMotion}
                type="button"
                aria-label={t("dismissAnnouncement")}
                onClick={() => {
                  setMemory((m) => [...m, a.id]);
                  try {
                    window.localStorage.setItem(KEY, JSON.stringify([...parse(readRaw()), a.id].slice(-50)));
                    window.dispatchEvent(new Event(CHANGED));
                  } catch {
                    /* storage blocked: it only stays dismissed until the next page load */
                  }
                }}
                className="icon-press -my-2 flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full hover:bg-white/50"
              >
                <X size={16} aria-hidden="true" />
              </motion.button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
