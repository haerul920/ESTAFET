import { defineRouting } from "next-intl/routing";

/**
 * Indonesian is the default and has no URL prefix. English lives under /en (CLAUDE.md 14.7).
 * The choice is remembered in the NEXT_LOCALE cookie. Localized path names (for example /dashboard for English)
 * are deliberately not used yet: see docs/release-plan.md, decision D4, and the R2 report.
 */
export const routing = defineRouting({
  locales: ["id", "en"],
  defaultLocale: "id",
  localePrefix: "as-needed",
  localeCookie: { maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
});

export type Locale = (typeof routing.locales)[number];

export const TIME_ZONE = "Asia/Makassar";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "id" || value === "en";
}

/** BCP 47 tag used for number and date formats. */
export const INTL_TAG: Record<Locale, string> = { id: "id-ID", en: "en-GB" };
