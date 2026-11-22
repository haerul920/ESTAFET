import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The rate limit helper: what it asks the database, that it hides the identity, and how it behaves when the database fails. */
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }) }));

const limit = { scope: "login-email", identity: "Ani@Example.com", max: 8, windowSeconds: 900 };

beforeEach(() => {
  rpc.mockReset();
  vi.stubEnv("APP_ENV", "PRODUCTION");
  vi.stubEnv("RATE_LIMIT_MULTIPLIER", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("allow", () => {
  it("asks the database with a hashed key, never the identity itself", async () => {
    const { allow } = await import("@/lib/rate-limit");
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await allow(limit)).toBe(true);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("check_rate_limit");
    expect(args.p_key).toMatch(/^login-email:[0-9a-f]{24}$/);
    expect(JSON.stringify(args)).not.toMatch(/ani|example/i);
    expect(args).toMatchObject({ p_max: 8, p_window_seconds: 900 });
  });

  it("the same email in a different case counts as the same person", async () => {
    const { hashKey } = await import("@/lib/rate-limit");
    expect(hashKey("login-email", "Ani@Example.com")).toBe(hashKey("login-email", "ani@example.com"));
    expect(hashKey("login-email", "ani@example.com")).not.toBe(hashKey("signup-ip", "ani@example.com"));
  });

  it("refuses when the database says the limit is used up", async () => {
    const { allow } = await import("@/lib/rate-limit");
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await allow(limit)).toBe(false);
  });

  it("lets the person through (and does not crash) when the database cannot answer", async () => {
    const { allow } = await import("@/lib/rate-limit");
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    expect(await allow(limit)).toBe(true);
    rpc.mockRejectedValue(new Error("network"));
    expect(await allow(limit)).toBe(true);
  });

  it("only a LOCAL server raises the limit for tests", async () => {
    const { allow } = await import("@/lib/rate-limit");
    rpc.mockResolvedValue({ data: true, error: null });
    vi.stubEnv("RATE_LIMIT_MULTIPLIER", "1000");

    vi.stubEnv("APP_ENV", "PRODUCTION");
    await allow(limit);
    expect(rpc.mock.calls.at(-1)![1].p_max).toBe(8);

    vi.stubEnv("APP_ENV", "STAGING");
    await allow(limit);
    expect(rpc.mock.calls.at(-1)![1].p_max).toBe(8);

    vi.stubEnv("APP_ENV", "LOCAL");
    await allow(limit);
    expect(rpc.mock.calls.at(-1)![1].p_max).toBe(8000);
  });

  it("reads the client address from the first forwarded entry", async () => {
    const { clientIp } = await import("@/lib/rate-limit");
    expect(await clientIp()).toBe("203.0.113.9");
  });
});
