import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { signReauth, verifyReauth } from "@/lib/admin/reauth";
import { environmentName, isProduction } from "@/lib/admin/env";
import { likePattern, parseTableParams, rangeFor, withParams } from "@/lib/admin/table";
import { formatWita, fromWitaInput, relativeTime, slaFor, toWitaInput } from "@/lib/admin/time";
import { auditCsv, diffObjects, type AuditEvent } from "@/lib/admin/audit";
import { isEmailAllowedBy, mbToBytes, resolveSettings, SETTING_SCHEMAS } from "@/lib/settings-core";
import { ingestUpload, UploadRejected } from "@/lib/ingest";
import { makePdf } from "@/lib/demo/make-pdf";

describe("re-authentication cookie", () => {
  const t0 = 1_700_000_000_000;
  it("accepts a fresh proof for the same user", () => {
    expect(verifyReauth(signReauth("u1", t0), "u1", 15, t0 + 60_000)).toBe(true);
  });
  it("rejects it after 15 minutes", () => {
    expect(verifyReauth(signReauth("u1", t0), "u1", 15, t0 + 15 * 60_000 + 1)).toBe(false);
  });
  it("rejects another user, a tampered value and garbage", () => {
    const v = signReauth("u1", t0);
    expect(verifyReauth(v, "u2", 15, t0)).toBe(false);
    expect(verifyReauth(v.replace("u1", "u2"), "u2", 15, t0)).toBe(false);
    expect(verifyReauth(v.slice(0, -2) + "xx", "u1", 15, t0)).toBe(false);
    expect(verifyReauth("nope", "u1")).toBe(false);
    expect(verifyReauth(undefined, "u1")).toBe(false);
  });
});

describe("environment badge", () => {
  it("is LOCAL for a local Supabase URL and PRODUCTION (the safe default) for anything else", () => {
    expect(environmentName({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toBe("LOCAL");
    expect(environmentName({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })).toBe("PRODUCTION");
    expect(environmentName({})).toBe("PRODUCTION");
  });
  it("APP_ENV wins, and purge is blocked only in PRODUCTION", () => {
    expect(environmentName({ APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })).toBe(
      "STAGING",
    );
    expect(isProduction({ APP_ENV: "PRODUCTION" })).toBe(true);
    expect(isProduction({ APP_ENV: "LOCAL" })).toBe(false);
  });
});

describe("settings override env defaults", () => {
  const env = { MAX_UPLOAD_MB: "30", SYNTHESIS_DAILY_CAP: "8", ALLOWED_EMAIL_DOMAINS: "student.unhas.ac.id" };
  it("uses env when nothing is stored, and built-in defaults otherwise", () => {
    const s = resolveSettings([], env);
    expect(s.max_upload_mb).toMatchObject({ value: 30, source: "env" });
    expect(s.allowed_email_domains.value).toEqual(["student.unhas.ac.id"]);
    expect(resolveSettings([], {}).max_upload_mb.value).toBe(50);
  });
  it("a stored setting wins and remembers the fallback", () => {
    const s = resolveSettings(
      [
        { key: "max_upload_mb", value: 12 },
        { key: "show_demo_banner", value: false },
      ],
      env,
    );
    expect(s.max_upload_mb).toMatchObject({ value: 12, source: "setting", fallback: 30 });
    expect(s.show_demo_banner.value).toBe(false);
  });
  it("ignores invalid stored values instead of breaking the app", () => {
    const s = resolveSettings(
      [
        { key: "max_upload_mb", value: "lots" },
        { key: "synthesis_daily_cap", value: -4 },
      ],
      env,
    );
    expect(s.max_upload_mb).toMatchObject({ value: 30, source: "env" });
    expect(s.synthesis_daily_cap.value).toBe(8);
  });
  it("validates with Zod", () => {
    expect(SETTING_SCHEMAS.max_upload_mb.safeParse(0).success).toBe(false);
    expect(SETTING_SCHEMAS.max_upload_mb.safeParse(500).success).toBe(false);
    expect(SETTING_SCHEMAS.max_upload_mb.safeParse(50).success).toBe(true);
    expect(SETTING_SCHEMAS.max_upload_mb.safeParse(51).success).toBe(false);
    expect(SETTING_SCHEMAS.allowed_email_domains.safeParse(["not a domain"]).success).toBe(false);
    expect(SETTING_SCHEMAS.contact_email.safeParse("").success).toBe(true);
    expect(SETTING_SCHEMAS.contact_email.safeParse("nope").success).toBe(false);
  });
  it("the domain allow-list comes from settings", () => {
    expect(isEmailAllowedBy("a@student.unhas.ac.id", ["student.unhas.ac.id"])).toBe(true);
    expect(isEmailAllowedBy("a@gmail.com", ["student.unhas.ac.id"])).toBe(false);
    expect(isEmailAllowedBy("a@gmail.com", [])).toBe(true);
  });
  it("the upload limit from settings is what the ingestion enforces", async () => {
    const pdf = makePdf(["hello world page"]);
    await expect(ingestUpload("a.pdf", pdf, { maxBytes: 100 })).rejects.toBeInstanceOf(UploadRejected);
    await expect(ingestUpload("a.pdf", pdf, { maxBytes: mbToBytes(1) })).resolves.toMatchObject({ kind: "pdf" });
  });
});

describe("table params and time", () => {
  it("falls back to safe defaults for bad sort, dir and page", () => {
    const p = parseTableParams(
      { sort: "drop table", dir: "sideways", page: "-3" },
      { sortable: ["title"], defaultSort: "title" },
    );
    expect(p).toMatchObject({ sort: "title", dir: "desc", page: 1 });
    expect(rangeFor({ ...p, page: 3, pageSize: 10 })).toEqual([20, 29]);
  });
  it("withParams replaces, drops empty values and keeps others", () => {
    expect(withParams({ q: "a", page: "2" }, { page: undefined, sort: "title" })).toBe("?q=a&sort=title");
    expect(withParams({}, {})).toBe("");
  });
  it("escapes characters that break a PostgREST filter", () => {
    expect(likePattern("a,b(c)%")).toBe("a b c");
  });
  it("shows times in WITA", () => {
    expect(formatWita("2026-11-20T00:00:00Z")).toContain("08:00");
    expect(formatWita("2026-11-20T00:00:00Z")).toContain("WITA");
    expect(relativeTime("2026-11-20T00:00:00Z", Date.parse("2026-11-20T00:10:00Z"))).toBe("10 mins ago");
    expect(relativeTime("2026-11-18T00:00:00Z", Date.parse("2026-11-20T00:10:00Z"))).toBe("2 days ago");
  });
});

describe("audit viewer helpers", () => {
  it("diffs before and after key by key", () => {
    const d = diffObjects({ a: 1, b: "x", gone: true }, { a: 2, b: "x", fresh: 1 });
    expect(d.find((x) => x.key === "a")?.kind).toBe("changed");
    expect(d.find((x) => x.key === "b")?.kind).toBe("same");
    expect(d.find((x) => x.key === "gone")?.kind).toBe("removed");
    expect(d.find((x) => x.key === "fresh")?.kind).toBe("added");
  });
  it("exports CSV with quoting and formula protection", () => {
    const e: AuditEvent = {
      id: "1",
      actor_name: "A, B",
      action: "project.hidden",
      target_type: "project",
      target_id: null,
      reason: "=cmd bad",
      before: { s: "ok" },
      after: null,
      created_at: "2026-11-20T00:00:00Z",
    };
    const csv = auditCsv([e]);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain("'=cmd bad");
  });
});

describe("admin code never writes tables directly", () => {
  function walk(dir: string): string[] {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  }
  const files = walk(path.resolve(__dirname, "../../src/app/[locale]/admin")).filter((f) => /\.(ts|tsx)$/.test(f));

  it("has admin files to check", () => expect(files.length).toBeGreaterThan(10));

  it("no file under src/app/admin calls a table writer or imports the service-role client", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs
        .readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (/\.(insert|update|delete|upsert)\s*\(/.test(src))
        offenders.push(`${path.relative(process.cwd(), f)}: table writer`);
      if (/createAdminClient|supabase\/admin/.test(src))
        offenders.push(`${path.relative(process.cwd(), f)}: service-role client`);
    }
    expect(offenders).toEqual([]);
  });

  it("every mutation in admin/actions.ts goes through an admin_* function", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../src/app/[locale]/admin/actions.ts"), "utf8");
    const rpcs = [...src.matchAll(/rpc\("([a-z_]+)"/g)].map((m) => m[1]);
    expect(rpcs.length).toBeGreaterThan(10);
    expect(rpcs.every((r) => r.startsWith("admin_"))).toBe(true);
  });
});

describe("WITA date inputs", () => {
  it("reads a datetime-local value as WITA (UTC+8) and writes it back unchanged", () => {
    expect(fromWitaInput("2026-12-01T08:00")).toBe("2026-12-01T00:00:00.000Z");
    expect(toWitaInput("2026-12-01T00:00:00.000Z")).toBe("2026-12-01T08:00");
    expect(toWitaInput(fromWitaInput("2026-03-05T23:30"))).toBe("2026-03-05T23:30");
  });
  it("treats empty or malformed input as no date", () => {
    expect(fromWitaInput("")).toBeNull();
    expect(fromWitaInput(null)).toBeNull();
    expect(fromWitaInput("tomorrow")).toBeNull();
    expect(toWitaInput(null)).toBe("");
  });
});

describe("review target (SLA)", () => {
  const created = "2026-01-01T00:00:00.000Z";
  const at = (days: number) => new Date(created).getTime() + days * 86_400_000;
  it("is ok while more than a day is left, soon in the last day, overdue after the target", () => {
    expect(slaFor(created, 3, at(0.5))).toEqual({ state: "ok", days: 2 });
    expect(slaFor(created, 3, at(2.5)).state).toBe("soon");
    expect(slaFor(created, 3, at(3.5))).toMatchObject({ state: "overdue" });
    expect(slaFor(created, 3, at(3.5)).days).toBeLessThan(0);
  });
});
