import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import { jsonLd, localizedUrl, pageAlternates, projectJsonLd } from "@/lib/seo";

describe("addresses", () => {
  it("Indonesian has no prefix and English lives under /en", () => {
    expect(localizedUrl("id", "/explore", "https://estafet.example")).toBe("https://estafet.example/explore");
    expect(localizedUrl("en", "/explore", "https://estafet.example")).toBe("https://estafet.example/en/explore");
    expect(localizedUrl("id", "/", "https://estafet.example")).toBe("https://estafet.example/");
    expect(localizedUrl("en", "/", "https://estafet.example")).toBe("https://estafet.example/en");
  });

  it("each page names itself as canonical and points at the other language", () => {
    vi.stubEnv("APP_URL", "https://estafet.example/");
    const a = pageAlternates("en", "/projects/x");
    expect(a.canonical).toBe("https://estafet.example/en/projects/x");
    expect(a.languages).toEqual({
      id: "https://estafet.example/projects/x",
      en: "https://estafet.example/en/projects/x",
      "x-default": "https://estafet.example/projects/x",
    });
  });
});

describe("structured data", () => {
  const project = {
    slug: "terumbu",
    title: "Terumbu",
    summary: "Ringkasan",
    published_at: "2026-01-02T00:00:00Z",
    year: 2025,
    tech: ["Python", "R"],
  };

  it("describes the project without naming any person", () => {
    vi.stubEnv("APP_URL", "https://estafet.example");
    const d = projectJsonLd(project, "id");
    expect(d).toMatchObject({
      "@type": "CreativeWork",
      name: "Terumbu",
      url: "https://estafet.example/projects/terumbu",
      keywords: "Python, R",
    });
    expect(JSON.stringify(d)).not.toMatch(/creator|author|member/i);
  });

  it("cannot break out of the script tag", () => {
    const out = jsonLd({ name: "</script><script>alert(1)</script>", x: "a&b" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("robots", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("closes staging and demo completely", () => {
    for (const env of ["STAGING", "DEMO", "LOCAL"]) {
      vi.stubEnv("APP_ENV", env);
      expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
    }
  });

  it("opens production, but keeps private areas and the API out, and names the sitemap", () => {
    vi.stubEnv("APP_ENV", "PRODUCTION");
    vi.stubEnv("APP_URL", "https://estafet.example");
    const r = robots();
    const rule = r.rules as { allow: string; disallow: string[] };
    expect(rule.allow).toBe("/");
    for (const p of ["/admin", "/api/", "/dasbor", "/bagikan", "/akun", "/en/admin"])
      expect(rule.disallow).toContain(p);
    expect(r.sitemap).toBe("https://estafet.example/sitemap.xml");
  });
});
