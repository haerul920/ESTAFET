"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

function rememberLocale(next: Locale) {
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
}

/** "ID | EN". Keeps the current page and its query, and remembers the choice in a cookie (next-intl). */
export function LanguageSwitcher({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const t = useTranslations("lang");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function go(next: Locale) {
    if (next === locale) return;
    const qs = params.toString();
    // Remember the choice first, so the page that opens does not bounce back to the old language.
    rememberLocale(next);
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next }));
  }

  return (
    <div role="group" aria-label={t("label")} className={cn("flex items-center gap-1 text-[12.5px] font-semibold", className)}>
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 ? (
            <span aria-hidden="true" className={tone === "light" ? "text-white/60" : "text-text-2"}>
              |
            </span>
          ) : null}
          <button
            type="button"
            lang={l}
            aria-pressed={l === locale}
            disabled={pending}
            onClick={() => go(l)}
            className={cn(
              "mono-label flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full px-2 transition-opacity hover:opacity-80",
              tone === "light" ? "text-white" : "text-ink",
              l === locale ? "underline decoration-2 underline-offset-4" : "opacity-70",
            )}
          >
            <span aria-hidden="true">{l.toUpperCase()}</span>
            <span className="sr-only">{t(l)}</span>
          </button>
        </span>
      ))}
    </div>
  );
}
