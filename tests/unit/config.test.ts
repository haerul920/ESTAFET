import { describe, expect, it } from "vitest";
import { assertConfig, checkConfig } from "@/lib/config";
import { scrub } from "@/lib/log";
import { environmentName, shouldNoIndex } from "@/lib/admin/env";

const SAFE_PRODUCTION = {
  APP_ENV: "PRODUCTION",
  APP_URL: "https://estafet.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  LLM_PROVIDER: "gemini",
  LLM_MODEL: "model",
  GEMINI_API_KEY: "key",
  TURNSTILE_SECRET_KEY: "s",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "r",
  EMAIL_FROM: "ESTAFET <halo@estafet.example>",
  CRON_SECRET: "x".repeat(40),
};

describe("production boot", () => {
  it("accepts a safe configuration", () => {
    const r = checkConfig(SAFE_PRODUCTION);
    expect(r.errors).toEqual([]);
    expect(() => assertConfig(SAFE_PRODUCTION)).not.toThrow();
  });

  it("refuses mock AI", () => {
    const r = checkConfig({ ...SAFE_PRODUCTION, LLM_PROVIDER: "mock" });
    expect(r.errors.join("\n")).toMatch(/LLM_PROVIDER=mock is refused/);
    expect(() => assertConfig({ ...SAFE_PRODUCTION, LLM_PROVIDER: "mock" })).toThrow(/Refusing to start in PRODUCTION/);
  });

  it("refuses demo seeding", () => {
    for (const v of ["true", "1", "TRUE"]) {
      expect(() => assertConfig({ ...SAFE_PRODUCTION, SEED_DEMO: v })).toThrow(/SEED_DEMO/);
    }
    expect(() => assertConfig({ ...SAFE_PRODUCTION, SEED_DEMO: "false" })).not.toThrow();
  });

  it("refuses a local database, plain http and a missing cron secret", () => {
    expect(
      checkConfig({ ...SAFE_PRODUCTION, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).errors.join(),
    ).toMatch(/local Supabase/);
    expect(checkConfig({ ...SAFE_PRODUCTION, APP_URL: "http://estafet.example" }).errors.join()).toMatch(/https/);
    expect(checkConfig({ ...SAFE_PRODUCTION, APP_URL: "https://localhost:3000" }).errors.join()).toMatch(/https/);
    expect(checkConfig({ ...SAFE_PRODUCTION, CRON_SECRET: "short" }).errors.join()).toMatch(/CRON_SECRET/);
  });

  it("needs a bot check and a real email provider", () => {
    expect(checkConfig({ ...SAFE_PRODUCTION, TURNSTILE_SECRET_KEY: "" }).errors.join()).toMatch(/Turnstile/);
    expect(checkConfig({ ...SAFE_PRODUCTION, EMAIL_PROVIDER: "log" }).errors.join()).toMatch(/EMAIL_PROVIDER/);
    expect(checkConfig({ ...SAFE_PRODUCTION, EMAIL_PROVIDER: "none" }).errors.join()).toMatch(/EMAIL_PROVIDER/);
  });

  it("needs the keys of the chosen providers", () => {
    expect(checkConfig({ ...SAFE_PRODUCTION, GEMINI_API_KEY: "" }).errors.join()).toMatch(/GEMINI_API_KEY/);
    expect(checkConfig({ ...SAFE_PRODUCTION, RESEND_API_KEY: "" }).errors.join()).toMatch(/RESEND_API_KEY/);
    expect(checkConfig({ ...SAFE_PRODUCTION, EMAIL_PROVIDER: "smtp" }).errors.join()).toMatch(/SMTP_HOST/);
  });

  it("reports malformed numbers by name", () => {
    expect(checkConfig({ ...SAFE_PRODUCTION, MAX_UPLOAD_MB: "abc" }).errors.join()).toMatch(/MAX_UPLOAD_MB/);
    expect(checkConfig({ ...SAFE_PRODUCTION, MAX_UPLOAD_MB: "" }).errors).toEqual([]);
  });
});

describe("other environments", () => {
  it("staging allows mock AI but still needs https, a cron secret and a hosted database", () => {
    const staging = { ...SAFE_PRODUCTION, APP_ENV: "STAGING", LLM_PROVIDER: "mock", EMAIL_PROVIDER: "log" };
    expect(checkConfig(staging).errors).toEqual([]);
    expect(() => assertConfig({ ...staging, CRON_SECRET: "" })).toThrow(/Refusing to start in STAGING/);
  });

  it("local never throws, even with nothing set", () => {
    const r = assertConfig({ APP_ENV: "LOCAL" });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("demo and staging are not indexed, production is", () => {
    expect(shouldNoIndex({ APP_ENV: "STAGING" })).toBe(true);
    expect(shouldNoIndex({ APP_ENV: "DEMO" })).toBe(true);
    expect(shouldNoIndex({ APP_ENV: "PRODUCTION" })).toBe(false);
    expect(environmentName({ APP_ENV: "demo" })).toBe("DEMO");
  });
});

describe("log scrubbing", () => {
  it("drops fields that can hold personal data or file contents", () => {
    const out = scrub({
      route: "/proyek/x",
      email: "a@b.c",
      full_name: "Ani",
      quote: "from a file",
      reason: "private words",
      count: 3,
      error_name: "TypeError",
      nested: { token: "t", ok: true },
    });
    expect(out).toEqual({ route: "/proyek/x", count: 3, error_name: "TypeError", nested: { ok: true } });
  });

  it("shortens long strings", () => {
    const out = scrub({ message: "x".repeat(500) });
    expect(String(out.message).length).toBeLessThan(250);
  });
});

describe("test-only switches", () => {
  it("refuses the rate limit multiplier outside LOCAL", () => {
    expect(checkConfig({ ...SAFE_PRODUCTION, RATE_LIMIT_MULTIPLIER: "1000" }).errors.join()).toMatch(
      /RATE_LIMIT_MULTIPLIER/,
    );
    expect(checkConfig({ APP_ENV: "LOCAL", RATE_LIMIT_MULTIPLIER: "1000" }).errors.join()).not.toMatch(
      /RATE_LIMIT_MULTIPLIER/,
    );
  });
});
