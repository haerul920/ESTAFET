/** Captures screenshots of the main screens for design review. Usage: pnpm shots <outDir> */
import "./lib/env";
import { chromium } from "@playwright/test";
import path from "node:path";

const out = process.argv[2] ?? "shots";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto(`${base}/login`);
  await page.getByLabel("University email").fill(email);
  await page.getByLabel("Password").fill("Demo-Pass-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function shot(page: import("@playwright/test").Page, name: string, url: string, full = true) {
  await page.goto(url.startsWith("http") ? url : base + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600); // let entrance animations settle
  if (full) {
    // scroll through the page so whileInView animations run
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += 500) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: full });
  console.log("saved", name);
}

async function main() {
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  const p = await desktop.newPage();
  await shot(p, "01-home", "/");
  await shot(p, "02-explore", "/explore");
  await shot(p, "03-teaser", "/projects/mangrove-cover-classifier");
  await shot(p, "04-login", "/login");

  await login(p, "creator@estafet.demo");
  await shot(p, "05-dashboard", "/dashboard");
  await shot(p, "06-verify", "/share/b0000000-0000-4000-8000-000000000007/verify");
  await shot(p, "07-files", "/share/b0000000-0000-4000-8000-000000000007/files");
  await shot(p, "08-consent-step", "/share/b0000000-0000-4000-8000-000000000008/consent");
  await shot(p, "09-basics", "/share/b0000000-0000-4000-8000-000000000008/basics");
  await shot(p, "10-review", "/requests/e0000000-0000-4000-8000-000000000001");

  const q = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await login(q, "adopter@estafet.demo");
  await shot(q, "11-request-form", "/projects/study-group-matcher/request");

  const m = await mobile.newPage();
  await shot(m, "12-consent-mobile", "/consent/demo-advisor-token-solar");
  await shot(m, "13-home-mobile", "/");
  await shot(m, "14-explore-mobile", "/explore");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
