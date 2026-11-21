import "../../scripts/lib/env";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Demo-Pass-2026!";

async function login(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dasbor|dashboard|admin|mulai)/);
}

async function serious(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    );
}

const ADMIN_PAGES = [
  "/en/admin",
  "/en/admin/projects",
  "/en/admin/reports",
  "/en/admin/users",
  "/en/admin/pipeline",
  "/en/admin/appeals",
  "/en/admin/requests",
  "/en/admin/trials",
  "/en/admin/audit",
  "/en/admin/settings",
];

for (const width of [900, 1280, 1440]) {
  test(`axe: admin pages have no serious issues at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await login(page, "admin@estafet.demo");
    const problems: string[] = [];
    for (const path of ADMIN_PAGES) {
      await page.goto(
        path + (path.includes("trials") || path.includes("projects") || path === "/en/admin" ? "?demo=1" : ""),
      );
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
  await page.goto("/en/admin/settings");
  await page.locator("#set-max_upload_mb").fill("27");
  await page.locator("[data-setting=max_upload_mb]").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await context.close();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/en/projects/mangrove-cover-classifier");
  await guest.getByRole("button", { name: "Project menu" }).click();
  await guest.getByRole("menuitem", { name: /Report/ }).click();
  await guest.waitForTimeout(1500); // let the fade-in animations finish: axe would read half-transparent text
  expect(await serious(guest)).toEqual([]);
});

test("axe: the first-run screen, dashboard, access cards and policy pages have no serious issues", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await login(page, "alumni@estafet.demo");
  const problems: string[] = [];
  // alumni owns the open demo project, so check the owner card there; creator@ sees the open card as a visitor.
  for (const path of [
    "/mulai",
    "/dasbor",
    "/projects/campus-waste-sorting-assistant",
    "/projects/mangrove-cover-classifier",
    "/terms",
    "/privacy",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200); // let reveal animations finish: axe would read half-transparent text
    for (const p of await serious(page)) problems.push(`${path}: ${p}`);
  }
  await context.close();

  const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const vp = await visitor.newPage();
  await login(vp, "creator@estafet.demo");
  for (const path of ["/projects/campus-waste-sorting-assistant"]) {
    await vp.goto(path);
    await vp.waitForLoadState("networkidle");
    await vp.waitForTimeout(1200);
    for (const p of await serious(vp)) problems.push(`${path} (as a visitor): ${p}`);
  }
  await visitor.close();

  const guest = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  for (const path of ["/signup", "/projects/campus-waste-sorting-assistant"]) {
    await guest.goto(path);
    await guest.waitForLoadState("networkidle");
    await guest.waitForTimeout(1200);
    for (const p of await serious(guest)) problems.push(`${path} (guest): ${p}`);
  }
  expect(problems).toEqual([]);
});
