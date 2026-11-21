import { INTL_TAG, TIME_ZONE, isLocale, type Locale } from "@/i18n/routing";

/** Dates and times are stored in UTC and shown in WITA (Asia/Makassar), with the formats of the active language. */
function tag(locale: string): string {
  return INTL_TAG[isLocale(locale) ? locale : "id"];
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(iso));
}

export function formatMonthYear(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(tag(locale), { month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(iso));
}

/** Date and time with the zone, used as the absolute value behind a relative time. */
export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(tag(locale)).format(n);
}

/** "5 minutes ago" or "5 menit yang lalu". */
export function timeAgo(iso: string, locale: string): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  return rtf.format(Math.round(diffSeconds / 86_400), "day");
}

export type { Locale };
