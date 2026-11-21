import en from "../../../messages/en.json";
import { buildLabels } from "@/lib/labels";
import { formatDate } from "@/lib/format";

/**
 * The admin area stays in English until phase R6, which translates it with the rest of its screens.
 * It still needs enum labels and dates, so it reads them from the English messages.
 */
const lookup = (key: string): string => {
  const value = key
    .split(".")
    .reduce<unknown>((o, part) => (o as Record<string, unknown> | undefined)?.[part], en.labels);
  return typeof value === "string" ? value : key;
};

export const EN = buildLabels(lookup);
export const fmtDate = (iso: string | null | undefined) => formatDate(iso, "en");
