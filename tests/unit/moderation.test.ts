import { afterEach, describe, expect, it, vi } from "vitest";
import { localBotCheck, MAX_FILL_MS, MIN_FILL_MS, botSignalsFrom, turnstileEnabled, verifyBot } from "@/lib/botcheck";
import { describeNotification } from "@/lib/db/dashboard";
import type { NotificationRow } from "@/lib/db/types";
import { resolveSettings, SETTING_SCHEMAS } from "@/lib/settings-core";
import { translator } from "./i18n-helpers";

describe("local bot check", () => {
  it("passes a person who waited and left the hidden field empty", () => {
    expect(localBotCheck({ honeypot: "", elapsedMs: MIN_FILL_MS + 1 })).toBe(true);
  });
  it("rejects a filled honeypot", () => {
    expect(localBotCheck({ honeypot: "http://spam.example", elapsedMs: 60_000 })).toBe(false);
  });
  it("rejects a form that was sent faster than a person can fill it", () => {
    expect(localBotCheck({ honeypot: "", elapsedMs: 500 })).toBe(false);
  });
  it("rejects a missing, invalid or stale start time", () => {
    expect(localBotCheck({ honeypot: "", elapsedMs: 0 })).toBe(false);
    expect(localBotCheck({ honeypot: "", elapsedMs: Number.NaN })).toBe(false);
    expect(localBotCheck({ honeypot: "", elapsedMs: MAX_FILL_MS + 1 })).toBe(false);
  });
  it("reads the signals from a form", () => {
    const f = new FormData();
    f.set("website", "x");
    f.set("fill_ms", "123");
    f.set("cf-turnstile-response", "tok");
    expect(botSignalsFrom(f)).toEqual({ honeypot: "x", elapsedMs: 123, token: "tok" });
    expect(botSignalsFrom(new FormData())).toEqual({ honeypot: "", elapsedMs: 0, token: undefined });
  });
});

describe("Turnstile path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("is off without a secret and on with one", () => {
    expect(turnstileEnabled({})).toBe(false);
    expect(turnstileEnabled({ TURNSTILE_SECRET_KEY: "s" })).toBe(true);
  });
  it("fails closed without a token, and when Cloudflare cannot be reached", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await verifyBot({ honeypot: "", elapsedMs: 0 })).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await verifyBot({ honeypot: "", elapsedMs: 0, token: "t" })).toBe(false);
  });
  it("trusts only an explicit success from Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }));
    expect(await verifyBot({ honeypot: "", elapsedMs: 0, token: "t" })).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    expect(await verifyBot({ honeypot: "", elapsedMs: 0, token: "t" })).toBe(false);
  });
});

describe("moderation notifications", () => {
  const t = translator("dashboard");
  const n = (type: string, payload: Record<string, unknown>): NotificationRow => ({
    id: "n",
    user_id: "u",
    type,
    payload,
    read_at: null,
    created_at: "2026-01-01T00:00:00Z",
  });
  it("sends owners to the decision page, with a neutral text for a hold", () => {
    const held = describeNotification(n("moderation", { title: "P", slug: "p", action: "held" }), t);
    expect(held.href).toBe("/proyek/p/keputusan");
    expect(held.text).toContain("held");
    expect(held.detail).not.toMatch(/reporter|who reported/i);
  });
  it("shows the written reason for a hide or removal and links the appeal", () => {
    for (const action of ["hidden", "removed"]) {
      const d = describeNotification(n("moderation", { title: "P", slug: "p", action, reason: "Copied text." }), t);
      expect(d.detail).toContain("Copied text.");
      expect(d.href).toBe("/proyek/p/keputusan");
    }
  });
  it("tells the owner the outcome of an appeal", () => {
    const ok = describeNotification(
      n("appeal_outcome", { title: "P", slug: "p", outcome: "accepted", note: "Fine." }),
      t,
    );
    const no = describeNotification(
      n("appeal_outcome", { title: "P", slug: "p", outcome: "rejected", note: "No." }),
      t,
    );
    expect(ok.text).toContain("accepted");
    expect(no.text).toContain("rejected");
    expect(no.detail).toContain("No.");
  });
  it("sends admins to the right queue", () => {
    expect(describeNotification(n("admin_appeal", { title: "P" }), t).href).toBe("/admin/appeals");
    expect(describeNotification(n("admin_hold", { title: "P", project_id: "x", reason: "copyright" }), t).href).toBe(
      "/admin/projects/x",
    );
    expect(describeNotification(n("admin_hold_overdue", { title: "P", project_id: "x" }), t).href).toBe(
      "/admin/projects/x",
    );
  });
});

describe("moderation settings", () => {
  it("default to 3 reporters and 3 days", () => {
    const s = resolveSettings([], {});
    expect(s.report_hold_threshold.value).toBe(3);
    expect(s.hold_review_days.value).toBe(3);
  });
  it("never allow a single reporter to hold a project", () => {
    expect(SETTING_SCHEMAS.report_hold_threshold.safeParse(1).success).toBe(false);
    expect(SETTING_SCHEMAS.report_hold_threshold.safeParse(2).success).toBe(true);
    expect(SETTING_SCHEMAS.report_hold_threshold.safeParse(21).success).toBe(false);
  });
  it("bound the review target", () => {
    expect(SETTING_SCHEMAS.hold_review_days.safeParse(0).success).toBe(false);
    expect(SETTING_SCHEMAS.hold_review_days.safeParse(7).success).toBe(true);
    expect(SETTING_SCHEMAS.hold_review_days.safeParse(31).success).toBe(false);
  });
  it("let a stored setting override the environment", () => {
    const s = resolveSettings([{ key: "report_hold_threshold", value: 5 }], { REPORT_HOLD_THRESHOLD: "4" });
    expect(s.report_hold_threshold).toMatchObject({ value: 5, source: "setting", fallback: 4 });
  });
});
