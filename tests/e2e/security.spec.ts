import "../../scripts/lib/env";
import { expect, test } from "@playwright/test";

/**
 * Security headers in a real browser (R7).
 *  - every page carries a Content-Security-Policy with a nonce, plus the fixed headers;
 *  - the nonce changes per request and Next.js puts it on its own scripts;
 *  - the browser reports NO CSP violation while the main pages load and the language switch works.
 */
const PAGES = ["/", "/explore", "/login", "/signup", "/en", "/en/explore", "/pedoman", "/kontak"];

test("pages send a nonce based CSP and the fixed security headers", async ({ request }) => {
  const a = await request.get("/");
  const b = await request.get("/");
  const cspA = a.headers()["content-security-policy"];
  const cspB = b.headers()["content-security-policy"];
  expect(cspA).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'[^;]*'strict-dynamic'/);
  expect(cspA).toContain("frame-ancestors 'none'");
  expect(cspA).toContain("object-src 'none'");
  expect(cspA).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(cspA).not.toBe(cspB);
  const h = a.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("Next.js scripts carry the request's nonce", async ({ request }) => {
  const res = await request.get("/explore");
  const nonce = /'nonce-([^']+)'/.exec(res.headers()["content-security-policy"])![1];
  const html = await res.text();
  const tags = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  expect(tags.length).toBeGreaterThan(0);
  const withNonce = tags.filter((t) => t.includes(`nonce="${nonce}"`));
  // Every script that has inline or src content must carry it.
  expect(withNonce.length).toBe(tags.length);
});

test("no CSP violation on the main pages", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (/content security policy|refused to (load|execute|connect|apply)/i.test(m.text())) problems.push(m.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(problems).toEqual([]);
});
