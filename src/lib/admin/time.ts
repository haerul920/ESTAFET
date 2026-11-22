/** Times are stored in UTC and shown in WITA (Asia/Makassar). */
const TZ = "Asia/Makassar";

export type AdminLocale = "id" | "en";

export function formatWita(iso: string | null | undefined, locale: AdminLocale = "en"): string {
  if (!iso) return "";
  return (
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
      timeZone: TZ,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WITA"
  );
}

const UNITS = {
  en: {
    now: "just now",
    min: ["min", "mins"],
    hour: ["hour", "hours"],
    day: ["day", "days"],
    ago: (t: string) => `${t} ago`,
    in: (t: string) => `in ${t}`,
  },
  id: {
    now: "baru saja",
    min: ["menit", "menit"],
    hour: ["jam", "jam"],
    day: ["hari", "hari"],
    ago: (t: string) => `${t} yang lalu`,
    in: (t: string) => `dalam ${t}`,
  },
} as const;

export function relativeTime(
  iso: string | null | undefined,
  now: number = Date.now(),
  locale: AdminLocale = "en",
): string {
  if (!iso) return "";
  const u = UNITS[locale];
  const diff = now - new Date(iso).getTime();
  const future = diff < 0;
  const m = Math.floor(Math.abs(diff) / 60000);
  const unit = (n: number, [one, many]: readonly [string, string]) => `${n} ${n === 1 ? one : many}`;
  let text: string;
  if (m < 1) return u.now;
  if (m < 60) text = unit(m, u.min);
  else if (m < 1440) text = unit(Math.floor(m / 60), u.hour);
  else text = unit(Math.floor(m / 1440), u.day);
  return future ? u.in(text) : u.ago(text);
}

/** ISO timestamp for "N hours ago". A function (not inline Date.now) so server pages stay pure-looking. */
export function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

const WITA_OFFSET_MS = 8 * 3_600_000;

/** An ISO timestamp as the value of a `datetime-local` input, in WITA (UTC+8, no daylight saving). */
export function toWitaInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + WITA_OFFSET_MS);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

/** The value of a `datetime-local` input, read as WITA, as an ISO timestamp. Returns null for empty or invalid input. */
export function fromWitaInput(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface Sla {
  state: "ok" | "soon" | "overdue";
  /** Whole days left (negative when overdue). */
  days: number;
}

/** Review target for something that arrived at `createdIso`: due after `targetDays`. "soon" means less than a day left. */
export function slaFor(createdIso: string, targetDays: number, now: number = Date.now()): Sla {
  const dueMs = new Date(createdIso).getTime() + targetDays * 86_400_000;
  const leftMs = dueMs - now;
  const days = Math.floor(leftMs / 86_400_000);
  if (leftMs < 0) return { state: "overdue", days };
  return { state: leftMs < 86_400_000 ? "soon" : "ok", days };
}
