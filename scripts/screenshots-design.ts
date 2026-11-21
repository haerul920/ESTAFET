/**
 * Saves the design review screenshots for docs/design/: every key page at 390 px (phone) and 1280 px (desktop).
 * Usage: pnpm shots:design   (needs the app and the local database running, demo data seeded)
 * Reduced motion is on so every screenshot shows the settled state.
 */
import "./lib/env";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "docs/design";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PASSWORD = "Demo-Pass-2026!";
const DRAFT = "b0000000-0000-4000-8000-000000000007";

type Role = "guest" | "creator" | "adopter" | "alumni" | "admin";
const EMAIL: Record<Exclude<Role, "guest">, string> = {
  creator: "creator@estafet.demo",
  adopter: "adopter@estafet.demo",
  alumni: "alumni@estafet.demo",
  admin: "admin@estafet.demo",
};

const PAGES: { name: string; path: string; role: Role }[] = [
  { name: "home", path: "/", role: "guest" },
  { name: "home-en", path: "/en", role: "guest" },
  { name: "explore", path: "/explore", role: "guest" },
  { name: "project-teaser", path: "/projects/mangrove-cover-classifier", role: "guest" },
  { name: "login", path: "/login", role: "guest" },
  { name: "signup", path: "/signup", role: "guest" },
  { name: "dashboard", path: "/dasbor", role: "creator" },
  { name: "wizard-info", path: `/bagikan/${DRAFT}/info`, role: "creator" },
  { name: "wizard-team", path: `/bagikan/${DRAFT}/tim`, role: "creator" },
  { name: "wizard-files", path: `/bagikan/${DRAFT}/berkas`, role: "creator" },
  { name: "wizard-review", path: `/bagikan/${DRAFT}/tinjau`, role: "creator" },
  { name: "wizard-preview", path: `/bagikan/${DRAFT}/terbit`, role: "creator" },
  { name: "request-form", path: "/projects/study-group-matcher/request", role: "adopter" },
  { name: "request-review", path: "/requests/e0000000-0000-4000-8000-000000000002", role: "alumni" },
  { name: "workspace", path: "/projects/mangrove-cover-classifier/workspace", role: "creator" },
  { name: "admin-overview", path: "/admin?demo=1", role: "admin" },
  { name: "admin-reports", path: "/admin/reports", role: "admin" },
];

async function login(browser: Browser, role: Exclude<Role, "guest">, width: number) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel("Email kampus").fill(EMAIL[role]);
  await page.getByLabel("Kata sandi").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).last().click();
  await page.waitForURL(/\/(dasbor|admin|mulai)/);
  return { ctx, state: await ctx.storageState() };
}

async function shoot(page: Page, name: string, url: string, width: number) {
  await page.goto(base + url, { waitUntil: "networkidle" });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
  console.log("saved", `${name}-${width}.png`);
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    const sessions = new Map<Role, BrowserContext>();
    for (const role of ["guest", "creator", "adopter", "alumni", "admin"] as Role[]) {
      if (!PAGES.some((p) => p.role === role)) continue;
      if (role === "guest") {
        sessions.set(role, await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: width < 600 ? 2 : 1 }));
      } else {
        const { ctx, state } = await login(browser, role, width);
        await ctx.close();
        sessions.set(role, await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", storageState: state, deviceScaleFactor: width < 600 ? 2 : 1 }));
      }
    }
    for (const p of PAGES) {
      const page = await sessions.get(p.role)!.newPage();
      await shoot(page, p.name, p.path, width);
      await page.close();
    }
    for (const c of sessions.values()) await c.close();
  }
  await browser.close();
}

void main();
