import { describe, expect, it } from "vitest";
import { describeDbUrl, planSeed, refFromApiUrl, refFromDbUrl, resolveSeedTarget } from "../../scripts/lib/seed-plan";

const REF = "abcdefghijklmnopqrst";
const OTHER = "zyxwvutsrqponmlkjihg";
const POOLER = `postgresql://postgres.${REF}:s3cret%40pw@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`;

const DEV = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  SUPABASE_SECRET_KEY: "secret",
  APP_ENV: "LOCAL",
  SUPABASE_DB_URL: POOLER,
};
const go = { yes: true, dryRun: false };

describe("seed:dev target", () => {
  it("reads the project ref from the API URL and from both connection string shapes", () => {
    expect(refFromApiUrl(`https://${REF}.supabase.co`)).toBe(REF);
    expect(refFromApiUrl("http://127.0.0.1:54321")).toBeNull();
    expect(refFromDbUrl(POOLER)).toBe(REF);
    expect(refFromDbUrl(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`)).toBe(REF);
    expect(refFromDbUrl("https://example.com")).toBeNull();
    expect(refFromDbUrl("not a url")).toBeNull();
  });

  it("never shows the user or the password of the connection string", () => {
    expect(describeDbUrl(POOLER)).toBe("aws-1-ap-northeast-1.pooler.supabase.com:5432");
  });

  it("accepts a hosted development project with matching URLs and consent", () => {
    const t = resolveSeedTarget(DEV, go);
    expect(t).toMatchObject({ kind: "remote", ref: REF });
    expect(resolveSeedTarget({ ...DEV, APP_ENV: "DEMO" }, go).kind).toBe("remote");
  });

  it("hands a local stack over to db:reset", () => {
    expect(resolveSeedTarget({ ...DEV, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, go).kind).toBe("local");
  });

  it("refuses staging, production and a hosted project without APP_ENV", () => {
    for (const APP_ENV of ["STAGING", "PRODUCTION", undefined]) {
      const t = resolveSeedTarget({ ...DEV, APP_ENV }, go);
      expect(t.kind, String(APP_ENV)).toBe("refused");
    }
    const unset = resolveSeedTarget({ ...DEV, APP_ENV: undefined }, go);
    expect(unset.kind === "refused" && unset.reason).toMatch(/counts as PRODUCTION/);
  });

  it("refuses a connection string for another project, or none at all", () => {
    const other = resolveSeedTarget({ ...DEV, SUPABASE_DB_URL: POOLER.replace(REF, OTHER) }, go);
    expect(other.kind === "refused" && other.reason).toMatch(/another project/);
    const none = resolveSeedTarget({ ...DEV, SUPABASE_DB_URL: "" }, go);
    expect(none.kind === "refused" && none.reason).toMatch(/SUPABASE_DB_URL is not set/);
  });

  it("needs --yes or ALLOW_REMOTE_SEED=true to write, but not for a dry run", () => {
    expect(resolveSeedTarget(DEV, { yes: false, dryRun: false }).kind).toBe("refused");
    expect(resolveSeedTarget(DEV, { yes: false, dryRun: true }).kind).toBe("remote");
    expect(resolveSeedTarget({ ...DEV, ALLOW_REMOTE_SEED: "true" }, { yes: false, dryRun: false }).kind).toBe("remote");
  });

  it("refuses when the keys are missing", () => {
    expect(resolveSeedTarget({ ...DEV, NEXT_PUBLIC_SUPABASE_URL: undefined }, go).kind).toBe("refused");
    expect(resolveSeedTarget({ ...DEV, SUPABASE_SECRET_KEY: undefined }, go).kind).toBe("refused");
  });
});

describe("seed:dev plan", () => {
  it("seeds an empty project fully", () => {
    expect(planSeed({ demoProjects: 0 }, {})).toEqual(["migrations", "demo-sql", "storage"]);
  });

  it("skips the demo SQL when demo projects exist, so a second run adds no duplicates", () => {
    expect(planSeed({ demoProjects: 8 }, {})).toEqual(["migrations", "storage"]);
  });

  it("adds the demo admin only with SEED_DEMO=true", () => {
    expect(planSeed({ demoProjects: 0 }, { SEED_DEMO: "true" })).toContain("demo-admin");
    expect(planSeed({ demoProjects: 0 }, { SEED_DEMO: "false" })).not.toContain("demo-admin");
  });
});
