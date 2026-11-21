import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import id from "../../messages/id.json";
import { formatDate, formatMonthYear, formatNumber, timeAgo } from "@/lib/format";
import { buildLabels, FACULTIES } from "@/lib/labels";
import { dbErrorMessage, KNOWN_HINTS } from "@/lib/errors";
import { splitLocale } from "@/lib/supabase/middleware";
import { translator } from "./i18n-helpers";

const flat = (o: Record<string, unknown>, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));

describe("messages", () => {
  it("have the same keys in Indonesian and English", () => {
    expect(flat(id).sort()).toEqual(flat(en).sort());
  });
  it("have a message for every database error hint", () => {
    const keys = new Set(flat(id));
    for (const hint of KNOWN_HINTS) expect(keys.has(`errors.hints.${hint}`), hint).toBe(true);
  });
});

describe("formats follow the language and show WITA", () => {
  // 20:00 UTC on 16 Dec is 04:00 on 17 Dec in WITA (UTC+8).
  const iso = "2026-12-16T20:00:00Z";
  it("shows the WITA date", () => {
    expect(formatDate(iso, "en")).toContain("17");
    expect(formatDate(iso, "id")).toContain("17");
  });
  it("uses Indonesian month names and number separators", () => {
    expect(formatMonthYear("2026-12-05T00:00:00Z", "id")).toMatch(/Des/);
    expect(formatMonthYear("2026-12-05T00:00:00Z", "en")).toMatch(/Dec/);
    expect(formatNumber(1234567, "id")).toBe("1.234.567");
    expect(formatNumber(1234567, "en")).toBe("1,234,567");
  });
  it("describes relative time in the language", () => {
    const fiveMinutes = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(timeAgo(fiveMinutes, "en")).toMatch(/5 minutes ago/);
    expect(timeAgo(fiveMinutes, "id")).toMatch(/5 menit yang lalu/);
  });
});

describe("labels", () => {
  it("builds every enum label in both languages, with no missing keys", () => {
    for (const lang of ["id", "en"] as const) {
      const L = buildLabels(translator("labels", lang));
      expect(L.kind.hackathon).toBeTruthy();
      expect(L.projectStatus.unpublished).toBeTruthy();
      expect(L.accessMode.by_request).toBeTruthy();
      for (const f of FACULTIES) expect(L.faculty(f)).toBeTruthy();
    }
    expect(buildLabels(translator("labels", "id")).faculty("Forestry")).toBe("Kehutanan");
  });
  it("shows an unknown faculty as typed", () => {
    expect(buildLabels(translator("labels", "id")).faculty("Teknik Mesin")).toBe("Teknik Mesin");
  });
});

describe("database errors", () => {
  it("maps a hint to a message in the language, and never leaks raw text", () => {
    const tid = translator("errors", "id");
    const ten = translator("errors", "en");
    expect(dbErrorMessage(tid, { message: "The team quota for this project is full", hint: "quota_full" })).toBe("Kuota tim penerus penuh.");
    expect(dbErrorMessage(ten, { hint: "email_unverified" })).toBe("Verify your email address first.");
    expect(dbErrorMessage(tid, { message: "duplicate key value violates unique constraint", hint: null })).toBe(id.errors.generic);
    expect(dbErrorMessage(tid, { code: "42501" })).toBe(id.errors.forbidden);
  });
});

describe("routing helpers", () => {
  it("splits the English prefix and leaves Indonesian paths alone", () => {
    expect(splitLocale("/en/dasbor")).toEqual({ locale: "en", path: "/dasbor" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/dasbor")).toEqual({ locale: "id", path: "/dasbor" });
    expect(splitLocale("/english-project")).toEqual({ locale: "id", path: "/english-project" });
  });
});
