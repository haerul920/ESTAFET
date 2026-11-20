/** Times are stored in UTC and shown in WITA (Asia/Makassar). */
const TZ = "Asia/Makassar";

export function formatWita(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WITA";
}

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const diff = now - new Date(iso).getTime();
  const future = diff < 0;
  const m = Math.floor(Math.abs(diff) / 60000);
  const unit = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;
  let text: string;
  if (m < 1) return "just now";
  if (m < 60) text = unit(m, "min");
  else if (m < 1440) text = unit(Math.floor(m / 60), "hour");
  else text = unit(Math.floor(m / 1440), "day");
  return future ? `in ${text}` : `${text} ago`;
}

/** ISO timestamp for "N hours ago". A function (not inline Date.now) so server pages stay pure-looking. */
export function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
