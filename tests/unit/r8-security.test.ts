import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTHZ_MATRIX } from "../security/authz.matrix";
import { renderEmail, SAMPLES, TEMPLATES } from "@/lib/email/templates";

const ROOT = process.cwd();

function walkRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walkRoutes(full);
    return name === "route.ts" ? [relative(ROOT, full).replace(/\\/g, "/")] : [];
  });
}

function exportedAsyncFunctions(relPath: string): string[] {
  const src = readFileSync(join(ROOT, relPath), "utf8");
  return [...src.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)].map((m) => m[1]);
}

describe("R8 Item 5: authorization matrix completeness", () => {
  it("documents every exported user Server Action in src/app/actions/*.ts", () => {
    const actionFiles = readdirSync(join(ROOT, "src/app/actions"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `src/app/actions/${f}`);
    const matrixActions = new Set(
      AUTHZ_MATRIX.filter((e) => e.kind === "action").map((e) => `${e.sourceFile}:${e.target}`),
    );
    for (const file of actionFiles) {
      const fns = exportedAsyncFunctions(file);
      expect(fns.length).toBeGreaterThan(0);
      for (const fn of fns) {
        expect(matrixActions.has(`${file}:${fn}`), `Missing in AUTHZ_MATRIX: ${file}:${fn}`).toBe(true);
      }
    }
  });

  it("documents every exported admin Server Action in src/app/[locale]/admin/actions.ts", () => {
    const file = "src/app/[locale]/admin/actions.ts";
    const fns = exportedAsyncFunctions(file);
    const matrixAdmin = new Set(
      AUTHZ_MATRIX.filter((e) => e.kind === "admin_action").map((e) => `${e.sourceFile}:${e.target}`),
    );
    expect(fns.length).toBeGreaterThanOrEqual(16);
    for (const fn of fns) {
      expect(matrixAdmin.has(`${file}:${fn}`), `Missing in AUTHZ_MATRIX: ${file}:${fn}`).toBe(true);
    }
  });

  it("documents every API route handler under src/app/api/**", () => {
    const routeFiles = walkRoutes(join(ROOT, "src/app/api"));
    const matrixRoutes = new Set(AUTHZ_MATRIX.filter((e) => e.kind === "api").map((e) => e.sourceFile));
    expect(routeFiles.length).toBeGreaterThanOrEqual(9);
    for (const file of routeFiles) {
      expect(matrixRoutes.has(file), `Missing API route in AUTHZ_MATRIX: ${file}`).toBe(true);
    }
  });
});

describe("R8 Item 5: API route handler authorization & environment guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("GET /api/dev/email-preview returns 404 in PRODUCTION and 200 in LOCAL", async () => {
    const { GET } = await import("@/app/api/dev/email-preview/route");

    vi.stubEnv("APP_ENV", "PRODUCTION");
    const prodRes = GET(new NextRequest("http://localhost:3100/api/dev/email-preview"));
    expect(prodRes.status).toBe(404);

    vi.stubEnv("APP_ENV", "LOCAL");
    const localRes = GET(new NextRequest("http://localhost:3100/api/dev/email-preview?template=moderation&locale=id"));
    expect(localRes.status).toBe(200);
    expect(await localRes.text()).toContain("ESTAFET");
  });

  it("GET /api/account/export rejects unauthenticated callers with 401", async () => {
    const serverMod = await import("@/lib/supabase/server");
    vi.spyOn(serverMod, "createClient").mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as never);

    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET /api/admin/audit/export rejects non-admins with 404 (defense-in-depth)", async () => {
    const serverMod = await import("@/lib/supabase/server");
    vi.spyOn(serverMod, "createClient").mockResolvedValue({
      rpc: async (fn: string) => ({ data: fn === "is_admin" ? false : null, error: null }),
    } as never);

    const auditRoute = await import("@/app/api/admin/audit/export/route");

    const auditRes = await auditRoute.GET(new Request("http://localhost:3100/api/admin/audit/export"));
    expect(auditRes.status).toBe(404);
  });

  it("GET /api/cron/[job] rejects missing, short, or wrong CRON_SECRET with 401", async () => {
    const cronRoute = await import("@/app/api/cron/[job]/route");

    vi.stubEnv("CRON_SECRET", "too-short");
    const shortRes = await cronRoute.GET(
      new NextRequest("http://localhost:3100/api/cron/daily", {
        headers: { authorization: "Bearer too-short" },
      }),
      { params: Promise.resolve({ job: "daily" }) },
    );
    expect(shortRes.status).toBe(401);

    const validSecret = "a".repeat(40);
    vi.stubEnv("CRON_SECRET", validSecret);

    const noAuth = await cronRoute.GET(new NextRequest("http://localhost:3100/api/cron/daily"), {
      params: Promise.resolve({ job: "daily" }),
    });
    expect(noAuth.status).toBe(401);

    const wrongAuth = await cronRoute.GET(
      new NextRequest("http://localhost:3100/api/cron/daily", {
        headers: { authorization: `Bearer ${"b".repeat(40)}` },
      }),
      { params: Promise.resolve({ job: "daily" }) },
    );
    expect(wrongAuth.status).toBe(401);
  });
});

describe("R8 Item 7: Indonesian content, glossary compliance & XSS escaping", () => {
  const idRaw = readFileSync(join(ROOT, "messages/id.json"), "utf8");
  const enRaw = readFileSync(join(ROOT, "messages/en.json"), "utf8");
  const idObj = JSON.parse(idRaw) as Record<string, unknown>;
  const enObj = JSON.parse(enRaw) as Record<string, unknown>;

  const flatten = (obj: Record<string, unknown>, prefix = ""): [string, string][] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object"
        ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
        : [[`${prefix}${k}`, String(v)]],
    );

  it("messages/id.json has no forbidden legacy terms, awkward literal translations, or placeholders", () => {
    const entries = flatten(idObj);
    // A guard against losing texts by accident. Lowered when admin pages were removed (CLAUDE.md 15.33 to 15.35).
    expect(entries.length).toBeGreaterThanOrEqual(2101);

    const forbidden: [RegExp, string][] = [
      [/dosen\s+pembimbing/i, "Removed in R5 (no advisor flow)"],
      [/\badvisor\b/i, "Removed in R5 (no advisor flow)"],
      [/\bcreator\b/i, "Use pemilik proyek / tim asal"],
      [/\badopter\b/i, "Use tim penerus / penerus"],
      [/\bpengadopsi\b/i, "Use tim penerus / penerus"],
      [/remah\s+roti/i, "Use Jalur navigasi for breadcrumb"],
      [/usaha\s+kecil/i, "Use Beban kerja: Kecil for small effort"],
      [/\bTODO\b/, "No TODO markers in user-facing copy"],
      [/PLACEHOLDER/i, "No PLACEHOLDER markers in user-facing copy"],
      [/FIXME/i, "No FIXME markers in user-facing copy"],
      [/lorem\s+ipsum/i, "No lorem ipsum in user-facing copy"],
    ];

    const violations: string[] = [];
    for (const [key, value] of entries) {
      for (const [re, reason] of forbidden) {
        if (re.test(value)) violations.push(`${key}: matched ${re} (${reason}) -> "${value}"`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("messages/en.json has no leftover advisor terms or TODO/PLACEHOLDER markers", () => {
    const entries = flatten(enObj);
    const forbidden: [RegExp, string][] = [
      [/\badvisor\b/i, "Removed in R5 (no advisor flow)"],
      [/\bTODO\b/, "No TODO markers in user-facing copy"],
      [/PLACEHOLDER/i, "No PLACEHOLDER markers in user-facing copy"],
      [/FIXME/i, "No FIXME markers in user-facing copy"],
    ];

    const violations: string[] = [];
    for (const [key, value] of entries) {
      for (const [re, reason] of forbidden) {
        if (re.test(value)) violations.push(`${key}: matched ${re} (${reason}) -> "${value}"`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("every email template renders cleanly in Indonesian and English and escapes HTML injection payloads", () => {
    for (const tpl of TEMPLATES) {
      for (const locale of ["id", "en"] as const) {
        const rendered = renderEmail(tpl, locale, SAMPLES[tpl], {
          appUrl: "https://estafet.example.id",
          name: "Rani",
          essential: false,
        });
        expect(rendered, `${tpl} (${locale})`).not.toBeNull();
        expect(rendered!.subject.length).toBeGreaterThan(3);
        expect(rendered!.html).not.toMatch(/\{title\}|\{team\}|\{reason\}|\{note\}|\{reference\}/);

        // XSS payload test
        const xss = renderEmail(
          tpl,
          locale,
          {
            title: "<script>alert('xss')</script>",
            team: "<img src=x onerror=alert(1)>",
            reason: "<svg onload=alert(2)>",
            note: "<b>untrusted</b>",
            reference: "LP-12345678",
          },
          {
            appUrl: "https://estafet.example.id",
            name: "<script>evil()</script>",
            essential: true,
          },
        );
        expect(xss!.html).not.toContain("<script>");
        expect(xss!.html).not.toContain("<img src=x");
        expect(xss!.html).not.toContain("<svg onload");
      }
    }
  });
});
