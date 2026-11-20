import "../../scripts/lib/env";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Demo-Pass-2026!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("University email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|admin)/);
}

async function serious(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

const ADMIN_PAGES = ["/admin", "/admin/projects", "/admin/reports", "/admin/users", "/admin/pipeline", "/admin/consents", "/admin/requests", "/admin/trials", "/admin/audit", "/admin/settings"];

for (const width of [900, 1280, 1440]) {
  test(`axe: admin pages have no serious issues at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await login(page, "admin@estafet.demo");
    const problems: string[] = [];
    for (const path of ADMIN_PAGES) {
      await page.goto(path + (path.includes("trials") || path.includes("projects") || path === "/admin" ? "?demo=1" : ""));
      await page.waitForLoadState("networkidle");
      for (const p of await serious(page)) problems.push(`${path}: ${p}`);
    }
    expect(problems).toEqual([]);
    await context.close();
  });
}

test("axe: the dialogs and the public report form have no serious issues", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await login(page, "admin@estafet.demo");
  await page.goto("/admin/settings");
  await page.locator("#set-max_upload_mb").fill("27");
  await page.locator("[data-setting=max_upload_mb]").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await context.close();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/projects/mangrove-cover-classifier");
  await guest.getByRole("button", { name: "Report this project" }).click();
  await guest.waitForTimeout(1500); // let the fade-in animations finish: axe would read half-transparent text
  expect(await serious(guest)).toEqual([]);
});
