import { describe, expect, it } from "vitest";
import { generateToken, hashToken, isExpired, looksLikeToken, tokenExpiry } from "@/lib/token";
import { creditLine, AGREEMENT_VERSION } from "@/lib/agreement/terms";
import { isEmailAllowed, safeNext } from "@/lib/validation";

describe("advisor tokens", () => {
  it("generates 32 random bytes (43 url-safe chars), never the same twice", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("stores only a stable sha256 hash that differs from the token", () => {
    const t = generateToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
  });

  it("expires after the configured number of days", () => {
    const start = new Date("2026-11-19T00:00:00Z");
    const exp = tokenExpiry(start, 14);
    expect(exp.toISOString()).toBe("2026-12-03T00:00:00.000Z");
    expect(isExpired(exp, new Date("2026-12-02T23:59:59Z"))).toBe(false);
    expect(isExpired(exp, new Date("2026-12-03T00:00:00Z"))).toBe(true);
  });

  it("rejects malformed tokens before any database lookup", () => {
    expect(looksLikeToken("short")).toBe(false);
    expect(looksLikeToken("a/b".repeat(10))).toBe(false);
    expect(looksLikeToken(generateToken())).toBe(true);
  });
});

describe("helpers", () => {
  it("builds the credit line", () => {
    expect(creditLine({ title: "Mangrove", creators: ["A", "B"], advisor: "Dr. C", lineageId: "abc" })).toBe(
      'This work builds on "Mangrove" by A, B, advised by Dr. C. Source: ESTAFET lineage abc.',
    );
    expect(AGREEMENT_VERSION).toBe(1);
  });

  it("only allows same-site redirects", () => {
    expect(safeNext("/dashboard?tab=x")).toBe("/dashboard?tab=x");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });

  it("checks the email domain allow-list", () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "student.unhas.ac.id";
    expect(isEmailAllowed("a@student.unhas.ac.id")).toBe(true);
    expect(isEmailAllowed("a@gmail.com")).toBe(false);
    process.env.ALLOWED_EMAIL_DOMAINS = "";
    expect(isEmailAllowed("a@gmail.com")).toBe(true);
  });
});
