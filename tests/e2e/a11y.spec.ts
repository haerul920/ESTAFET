import "../../scripts/lib/env";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Demo-Pass-2026!";

async function login(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
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
  "/en/admin/appeals",
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
  // Wait for the overlay and dialog fade-in to finish: axe would read half-transparent text.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a instanceof CSSAnimation && /^(overlay|dialog)-in$/.test(a.animationName))
        .map((a) => a.finished),
    ),
  );
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await context.close();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/en/projects/mangrove-cover-classifier");
  await guest.getByRole("button", { name: "Report project" }).click();
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

test("axe: Indonesian public, privacy, report and admin pages have no serious issues on mobile (390px) and desktop (1280px)", async ({
  browser,
}) => {
  const problems: string[] = [];
  for (const vp of [
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    for (const path of ["/", "/explore", "/login", "/pedoman", "/atribusi", "/kontak"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      for (const p of await serious(page)) problems.push(`${path} @ ${vp.width}px: ${p}`);
    }
    await login(page, "creator@estafet.demo");
    for (const path of ["/dasbor", "/laporan-saya", "/akun/setelan", "/proyek/mangrove-cover-classifier/pengaturan"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      for (const p of await serious(page)) problems.push(`${path} @ ${vp.width}px: ${p}`);
    }
    await ctx.close();
  }
  expect(problems).toEqual([]);
});

test("keyboard navigation: skip link, visible focus ring, honeypot tabIndex=-1, and Escape closes dialogs and restores focus", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();

  // 1. Skip link is the first Tab stop on Home and reveals a visible focus ring
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Lewati ke konten" });
  await expect(skip).toBeFocused();
  const skipBox = await skip.boundingBox();
  expect(skipBox && skipBox.width > 20 && skipBox.height > 20).toBe(true);

  // 2. Signup honeypot input has tabIndex === -1 so keyboard users never land in it
  await page.goto("/signup");
  const honeypotTabIndex = await page.locator('input[name="website"]').getAttribute("tabindex");
  expect(honeypotTabIndex).toBe("-1");

  // 3. Report dialog opens via keyboard, has honeypot tabIndex === -1, and Escape closes it
  await page.goto("/projects/mangrove-cover-classifier");
  // Wait until the page is interactive.
  await page.waitForLoadState("networkidle");
  const reportBtn = page.getByRole("button", { name: "Laporkan proyek" });
  await reportBtn.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.locator('input[name="website"]').getAttribute("tabindex")).toBe("-1");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // 4. Direct dialog trigger (mobile navigation drawer) traps focus and restores focus to opener on Escape
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  const drawerBtn = page.getByRole("button", { name: "Buka menu" });
  await drawerBtn.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(drawerBtn).toBeFocused();

  await ctx.close();
});
