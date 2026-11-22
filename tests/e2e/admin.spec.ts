import "../../scripts/lib/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "Demo-Pass-2026!";
const REASON = "Checked by the e2e test with a clear reason.";

async function login(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dasbor|dashboard|admin|mulai)/);
}

async function fresh(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

/** Fills the reason dialog and confirms. Handles the password check when it appears. */
async function confirmDialog(page: Page, confirmName: string, opts: { reason?: string; phrase?: string } = {}) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(/Reason|Resolution note|Why are you|Note on what|Why this announcement|Why you are ending/)
    .fill(opts.reason ?? REASON);
  if (opts.phrase) await dialog.getByLabel(/Type .* to confirm/).fill(opts.phrase);
  await dialog.getByRole("button", { name: confirmName, exact: true }).click();
  const pw = dialog.getByLabel("Confirm your password");
  if (
    await pw.waitFor({ state: "visible", timeout: 4000 }).then(
      () => true,
      () => false,
    )
  ) {
    await pw.fill(PASSWORD);
    await dialog.getByRole("button", { name: "Confirm and continue" }).click();
  }
  await expect(dialog).toBeHidden();
}

test.describe.configure({ mode: "serial" });

test("moderation: report, hide, disappears, creators notified, restore, audited", async ({ browser }) => {
  // 1. A visitor reports a published demo project (no account).
  const visitor = await fresh(browser);
  await visitor.page.goto("/en/projects/fish-freshness-indicator");
  await visitor.page.getByRole("button", { name: "Project menu" }).click();
  await visitor.page.getByRole("menuitem", { name: /Report/ }).click();
  const reportDialog = visitor.page.getByRole("dialog");
  await reportDialog.getByRole("radio", { name: /False or misleading/ }).check();
  await reportDialog.getByLabel("What is wrong?").fill("E2E: the summary says more than the files support.");
  // The local bot check rejects a form that is sent faster than a person could fill it.
  await visitor.page.waitForTimeout(3500);
  await reportDialog.getByRole("button", { name: "Send report" }).click();
  await expect(visitor.page.getByText(/Reference code: LP-[0-9A-F]{8}/)).toBeVisible();
  await visitor.context.close();

  // 2. The admin opens it and hides the project with a reason.
  const admin = await fresh(browser);
  const a = admin.page;
  await login(a, "admin@estafet.demo");
  await a.goto("/en/admin/reports?status=open");
  await a.locator("tbody tr").first().getByRole("link").click();
  await expect(a.getByRole("complementary", { name: "Report details" })).toBeVisible();
  await expect(a.getByText("E2E: the summary says more than the files support.")).toBeVisible();
  await a.getByRole("button", { name: "Hide project" }).click();
  // the dialog refuses a short reason
  const dialog = a.getByRole("dialog");
  await dialog.getByLabel(/Resolution note/).fill("too short");
  await expect(dialog.getByRole("button", { name: "Hide project", exact: true })).toBeDisabled();
  await confirmDialog(a, "Hide project");

  // 3. It disappears from Explore and the teaser is a 404.
  const guest = await fresh(browser);
  await guest.page.goto("/en/explore?q=Freshness");
  await expect(guest.page.getByText("No projects match these filters")).toBeVisible();
  const res = await guest.page.goto("/en/projects/fish-freshness-indicator");
  expect(res?.status()).toBe(404);
  await guest.context.close();

  // 4. The creators get an in-app notification with the reason.
  const creator = await fresh(browser);
  await login(creator.page, "alumni@estafet.demo");
  await creator.page.goto("/en/dasbor");
  await expect(creator.page.getByText(/Fish Freshness Indicator was hidden from public view/).first()).toBeVisible();
  await expect(creator.page.getByText(REASON).first()).toBeVisible();
  await creator.context.close();

  // 5. The admin restores it from the project page; it reappears.
  await a.goto("/en/admin/projects?q=Freshness&moderation=hidden&demo=1");
  await a.locator("tbody tr").first().getByRole("link").click();
  await a.getByRole("button", { name: "Restore", exact: true }).click();
  await confirmDialog(a, "Restore");
  const again = await fresh(browser);
  await again.page.goto("/en/explore?q=Freshness");
  await expect(again.page.getByRole("link", { name: /Fish Freshness Indicator/ })).toBeVisible();
  expect((await again.page.goto("/en/projects/fish-freshness-indicator"))?.status()).toBe(200);
  await again.context.close();

  // 6. Every step is in the audit log with the reason.
  await a.goto("/en/admin/audit?action=project.");
  await expect(a.getByText("project.hidden").first()).toBeVisible();
  await expect(a.getByText("project.restored").first()).toBeVisible();
  await expect(a.getByText(REASON).first()).toBeVisible();
  await a.goto("/en/admin/audit?action=report.");
  await expect(a.getByText("report.hide").first()).toBeVisible();
  await admin.context.close();
});

test("the admin area is invisible to guests and normal users (404)", async ({ browser }) => {
  const guest = await fresh(browser);
  for (const path of [
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
  ]) {
    expect((await guest.page.goto(path))?.status(), path).toBe(404);
  }
  expect((await guest.page.request.get("/api/admin/trials/export")).status()).toBe(404);
  await guest.context.close();

  const user = await fresh(browser);
  await login(user.page, "creator@estafet.demo");
  for (const path of ["/en/admin", "/en/admin/audit", "/en/admin/settings"]) {
    expect((await user.page.goto(path))?.status(), path).toBe(404);
  }
  expect((await user.page.request.get("/api/admin/audit/export")).status()).toBe(404);
  await user.context.close();
});

test("smoke: every page, a setting, a trial, break glass and suspension, all audited", async ({ browser }) => {
  const admin = await fresh(browser);
  const a = admin.page;
  await login(a, "admin@estafet.demo");

  // Every page opens with its heading and the shell.
  const pages: [string, string][] = [
    ["/en/admin", "Overview"],
    ["/en/admin/projects", "Projects"],
    ["/en/admin/reports", "Reports"],
    ["/en/admin/users", "Users"],
    ["/en/admin/pipeline", "Pipeline"],
    ["/en/admin/requests", "Requests"],
    ["/en/admin/trials", "Onboarding trials"],
    ["/en/admin/audit", "Audit log"],
    ["/en/admin/settings", "Settings"],
  ];
  for (const [path, heading] of pages) {
    expect((await a.goto(path))?.status(), path).toBe(200);
    await expect(a.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(a.getByLabel("Search projects, users and reports")).toBeVisible();
    // The environment pill is a focusable element with a tooltip (Radix), no longer a title attribute.
    await expect(a.locator("header").getByText("LOCAL", { exact: true })).toBeVisible();
    await a.locator("header").getByText("LOCAL", { exact: true }).focus();
    await expect(a.getByRole("tooltip").getByText("Current environment")).toBeVisible();
  }

  // Keyboard: g then p goes to Projects, ? shows the shortcuts.
  await a.goto("/en/admin");
  await a.waitForLoadState("networkidle"); // let the page hydrate so the key handler is attached
  await a.keyboard.press("g");
  await a.keyboard.press("p");
  await expect(a).toHaveURL(/\/admin\/projects/);
  await a.keyboard.press("?");
  await expect(a.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await a.keyboard.press("Escape");

  // A setting change: reason + password check, then it shows as "Set here" and is audited with before and after.
  await a.goto("/en/admin/settings");
  const row = a.locator("#set-max_upload_mb");
  await row.fill("26");
  await a.locator("[data-setting=max_upload_mb]").getByRole("button", { name: "Save" }).click();
  await expect(a.getByRole("dialog").getByText(/changes from/)).toBeVisible();
  await confirmDialog(a, "Save");
  await expect(a.getByText("Maximum upload size saved.").first()).toBeVisible();
  await a.goto("/en/admin/audit?action=setting.");
  await a.locator("tbody tr").first().getByRole("link").click();
  await expect(a.getByRole("complementary", { name: "Audit entry" })).toContainText("max_upload_mb");
  // put it back (the password check is remembered for 15 minutes)
  await a.goto("/en/admin/settings");
  await a.locator("#set-max_upload_mb").fill("25");
  await a.locator("[data-setting=max_upload_mb]").getByRole("button", { name: "Save" }).click();
  await confirmDialog(a, "Save");
  await expect(a.getByText("Maximum upload size saved.").first()).toBeVisible();

  // A trial session (demo-flagged so it never pollutes real metrics).
  await a.goto("/en/admin/trials");
  await a.getByRole("link", { name: "Record session" }).click();
  const form = a.getByRole("form", { name: "Record session" });
  await form.getByLabel("Participant code").fill("E2E1");
  await form.getByLabel("Minutes to understand").fill("22");
  await form.getByLabel("Questions answered correctly").fill("4");
  await form.getByLabel("Start time").fill("2026-11-20T10:00");
  await form.getByLabel("Participant consented to being included").check();
  await form.getByLabel(/This is a demo row/).check();
  await form.getByRole("button", { name: "Save session" }).click();
  await expect(a.getByText("Session recorded.").first()).toBeVisible();
  // Without demo rows there are no real sessions, so the page refuses to draw a conclusion.
  await a.goto("/en/admin/trials");
  await expect(a.getByText(/Too few sessions to conclude \(n = 0/).first()).toBeVisible();
  await expect(a.getByText("E2E1")).toHaveCount(0);
  await a.goto("/en/admin/trials?demo=1");
  await expect(a.getByRole("link", { name: "E2E1" }).first()).toBeVisible();
  await expect(a.getByText("ESTAFET (n = 5)")).toBeVisible(); // 4 seeded demo sessions + the one just recorded
  const csv = await a.request.get("/api/admin/trials/export?demo=1");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("E2E1");

  // Break glass on one private file: typed confirmation, red banner.
  await a.goto("/en/admin/projects?q=Mangrove&demo=1");
  await a.locator("tbody tr").first().getByRole("link").click();
  await a.getByRole("button", { name: "Open private file" }).click();
  await confirmDialog(a, "Open private file", { phrase: "OPEN PRIVATE FILE" });
  await a.waitForURL(/break-glass/);
  await expect(a.getByText("EMERGENCY ACCESS to private files. This view is logged")).toBeVisible();
  await expect(a.getByText(/Expires in \d:\d\d/)).toBeVisible();

  // Suspension: the user cannot sign in, restore lets them back.
  await a.goto("/en/admin/users?q=adopter%40estafet");
  await a.locator("tbody tr").first().getByRole("link").click();
  await a.getByRole("button", { name: "Suspend user" }).click();
  await confirmDialog(a, "Suspend user");
  await expect(a.getByText("suspended").first()).toBeVisible();
  const blocked = await fresh(browser);
  await blocked.page.goto("/en/login");
  await blocked.page.getByLabel("Email", { exact: true }).fill("adopter@estafet.demo");
  await blocked.page.getByLabel("Password").fill(PASSWORD);
  await blocked.page.getByRole("button", { name: "Sign in" }).click();
  await expect(blocked.page.getByText(/Your account is suspended/)).toBeVisible();
  await a.getByRole("button", { name: "Restore access" }).click();
  await confirmDialog(a, "Restore access");
  await blocked.page.getByLabel("Password").fill(PASSWORD); // the form clears the password after a failed attempt
  await blocked.page.getByRole("button", { name: "Sign in" }).click();
  await blocked.page.waitForURL("**/dasbor");
  await blocked.context.close();

  // The audit log has every action above.
  for (const action of ["setting.update", "trial.create", "break_glass.open", "user.suspend", "user.restore"]) {
    await a.goto(`/en/admin/audit?action=${action}`);
    await expect(a.getByText(action).first(), action).toBeVisible();
  }
  await admin.context.close();
});

test("announcements: an admin publishes one, visitors see it in their language, and it can be ended", async ({
  browser,
}) => {
  const admin = await fresh(browser);
  const a = admin.page;
  await login(a, "admin@estafet.demo");
  await a.goto("/en/admin/announcements");
  await a.getByLabel("Text in Indonesian").fill("Pemeliharaan terjadwal malam ini (uji e2e).");
  await a.getByLabel("Text in English").fill("Scheduled maintenance tonight (e2e test).");
  await a.getByRole("button", { name: "Publish announcement", exact: true }).click();
  await confirmDialog(a, "Publish announcement");

  const visitor = await fresh(browser);
  await visitor.page.goto("/en/explore");
  await expect(visitor.page.getByText("Scheduled maintenance tonight (e2e test).")).toBeVisible();
  await visitor.page.goto("/explore");
  await expect(visitor.page.getByText("Pemeliharaan terjadwal malam ini (uji e2e).")).toBeVisible();
  // Dismissing hides it for this browser.
  await visitor.page.getByRole("button", { name: "Tutup pengumuman" }).click();
  await expect(visitor.page.getByText("Pemeliharaan terjadwal malam ini (uji e2e).")).toBeHidden();

  await a.goto("/en/admin/announcements");
  await a.getByRole("button", { name: "End now" }).first().click();
  await confirmDialog(a, "End now");
  await visitor.page.goto("/en/explore");
  await expect(visitor.page.getByText("Scheduled maintenance tonight (e2e test).")).toHaveCount(0);
  await visitor.context.close();
  await admin.context.close();
});
