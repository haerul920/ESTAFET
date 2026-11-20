/** Screenshots of the admin area for design review. Usage: pnpm exec tsx scripts/screenshots-admin.ts <outDir> */
import "./lib/env";
import { chromium } from "@playwright/test";
import path from "node:path";

const out = process.argv[2] ?? "shots";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${base}/login`);
  await p.getByLabel("University email").fill("admin@estafet.demo");
  await p.getByLabel("Password").fill("Demo-Pass-2026!");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL(/\/(dashboard|admin)/);
  const shots: [string, string][] = [
    ["a1-overview", "/admin?demo=1"],
    ["a2-projects", "/admin/projects?demo=1"],
    ["a3-reports", "/admin/reports"],
    ["a4-trials", "/admin/trials?demo=1"],
    ["a5-settings", "/admin/settings"],
    ["a6-pipeline", "/admin/pipeline"],
  ];
  for (const [name, url] of shots) {
    await p.goto(base + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    console.log("saved", name);
  }
  await p.goto(`${base}/admin/projects?demo=1&q=Mangrove`, { waitUntil: "networkidle" });
  await p.locator("tbody tr").first().getByRole("link").click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(out, "a7-project-detail.png"), fullPage: true });
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await m.goto(`${base}/login`);
  await m.getByLabel("University email").fill("admin@estafet.demo");
  await m.getByLabel("Password").fill("Demo-Pass-2026!");
  await m.getByRole("button", { name: "Sign in" }).click();
  await m.waitForURL(/\/(dashboard|admin)/);
  await m.goto(`${base}/admin/projects?demo=1`, { waitUntil: "networkidle" });
  await m.waitForTimeout(800);
  await m.screenshot({ path: path.join(out, "a8-projects-mobile.png"), fullPage: false });
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
