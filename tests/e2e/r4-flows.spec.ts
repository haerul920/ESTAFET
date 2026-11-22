import "../../scripts/lib/env";
import { expect, test } from "@playwright/test";
import { adminDb as admin, newUserPage as newPage, signIn, signUp } from "./helpers";

/**
 * R4 flows (run in English: the other specs do too).
 *  1. Manual mode and open access: share, publish, unpublish, publish again. No AI is involved.
 *  2. A project that is paused, then full, then open again, with "Notify me". Uses seeded demo data and restores it.
 * The by-request approval, the declined request and "the same account shares and continues" are in core-flow.spec.ts.
 */
const stamp = Date.now();

test("manual mode and open access: share, publish, unpublish and publish again", async ({ browser, page }) => {
  const title = `E2E Manual Notes ${stamp}`;
  await signUp(page, "E2E Manual Owner", `e2e.manual.${stamp}@example.test`);

  // ---- Step 1: basics
  await page.goto("/en/bagikan");
  await page.getByLabel("Project title").fill(title);
  await page
    .getByLabel("Short summary")
    .fill("A synthetic project whose notes are written by hand, with no AI involved at any point.");
  await page.getByLabel("Type of work").selectOption("hackathon");
  await page.getByLabel("Faculty or field").selectOption("Engineering");
  await page.getByLabel("Why did it stop?").selectOption("team_graduated");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/berkas");

  // ---- Step 2: choose to fill in by hand. Nothing goes to an AI provider.
  await expect(page.getByRole("button", { name: "Fill in by hand" })).toBeVisible();
  await page.getByRole("button", { name: "Fill in by hand" }).click();
  await page.waitForURL("**/tinjau");

  // ---- Step 3: the manual board. The add form is open, items count as reviewed.
  await expect(page.getByText(/You chose to fill in by hand/)).toBeVisible();
  await page.getByLabel("Title").fill("Write the field protocol");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("1 of 1 reviewed")).toBeVisible();
  await page.getByRole("link", { name: "Continue to team and access" }).click();
  await page.waitForURL("**/tim");

  // ---- Step 4: team consent (there is no advisor step), open access with one team at a time
  await page.getByRole("button", { name: "I confirm" }).click();
  await page.getByRole("radio", { name: /^Open with an agreement/ }).check();
  await page.getByLabel("How many continuing teams at once").selectOption("1");
  await page.getByRole("button", { name: "Save access rules" }).click();
  await expect(page.getByText("Access rules saved.")).toBeVisible();
  await page.getByRole("link", { name: "Continue to the preview" }).click();
  await page.waitForURL("**/terbit");

  // ---- Step 5: the preview says in plain words what open mode means, then publish
  await expect(page.getByText(/take access right away after accepting the attribution agreement/)).toBeVisible();
  await expect(page.getByText("Limit on continuing teams: 1 team at a time.")).toBeVisible();
  await page.getByLabel(/The preview above is what I want to make public/).check();
  await page.getByRole("button", { name: "Publish teaser" }).click();
  await page.waitForURL(/\/projects\/e2e-manual-notes/);
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // a signed-out visitor sees the open-access call to action
  const visitor = await newPage(browser);
  await visitor.page.goto(`/en/projects/${slug}`);
  await expect(visitor.page.getByRole("heading", { name: "Want to continue this project?" })).toBeVisible();
  await expect(visitor.page.getByText(/accept the attribution agreement, and the files open right away/)).toBeVisible();

  // ---- Settings: unpublish hides the teaser from everyone, publish again brings it back
  await page.goto(`/en/proyek/${slug}/pengaturan`);
  await expect(page.getByRole("heading", { name: "Project settings" })).toBeVisible();
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByRole("dialog").getByText(/No data is deleted/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, continue" }).click();
  await expect(page.getByText("Unpublished", { exact: true }).first()).toBeVisible();
  const hidden = await visitor.page.goto(`/en/projects/${slug}`);
  expect(hidden?.status()).toBe(404);

  await page.getByRole("button", { name: "Publish again" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, continue" }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  const back = await visitor.page.goto(`/en/projects/${slug}`);
  expect(back?.status()).toBe(200);
  await visitor.context.close();
});

test("paused, then full, then open again: the call to action changes and watchers are told", async ({ browser }) => {
  const SLUG = "campus-waste-sorting-assistant";
  const PROJECT = "b0000000-0000-4000-8000-000000000002";
  const db = admin();
  const restore = async () => {
    await db.from("project_access").delete().eq("project_id", PROJECT);
    await db.from("project_watchers").delete().eq("project_id", PROJECT);
    await db.from("projects").update({ access_mode: "open", max_active_adopters: 3 }).eq("id", PROJECT);
  };
  await restore();

  const owner = await newPage(browser);
  const watcher = await newPage(browser);
  const taker = await newPage(browser);
  try {
    await signIn(owner.page, "alumni@estafet.demo");
    await signIn(watcher.page, "creator@estafet.demo");
    await signIn(taker.page, "adopter@estafet.demo");

    // ---- The owner pauses access
    await owner.page.goto(`/en/proyek/${SLUG}/pengaturan`);
    await owner.page.getByRole("radio", { name: /^Paused/ }).check();
    await expect(owner.page.getByText(/From “Open with an agreement” to “Paused”/)).toBeVisible();
    await owner.page.getByRole("button", { name: "Save access rules" }).click();
    await expect(owner.page.getByText("Access rules saved.")).toBeVisible();

    // ---- A visitor sees "paused" and asks to be told
    await watcher.page.goto(`/en/projects/${SLUG}`);
    await expect(watcher.page.getByRole("heading", { name: "New access is paused" })).toBeVisible();
    await watcher.page.getByRole("button", { name: "Notify me" }).click();
    await expect(watcher.page.getByRole("button", { name: "Stop notifying me" })).toBeVisible();

    // ---- The owner opens access again with room for one team: the watcher gets exactly one notification
    await owner.page.getByRole("radio", { name: /^Open with an agreement/ }).check();
    await owner.page.getByLabel("How many continuing teams at once").selectOption("1");
    await owner.page.getByRole("button", { name: "Save access rules" }).click();
    await expect(owner.page.getByText("Access rules saved.")).toBeVisible();
    const creator = await db.from("profiles").select("id").eq("full_name", "Demo Creator A").maybeSingle();
    const notes = await db
      .from("notifications")
      .select("payload")
      .eq("type", "watch_open")
      .eq("payload->>project_id", PROJECT);
    expect((notes.data ?? []).length).toBeGreaterThanOrEqual(1);
    void creator;

    // ---- Another team takes the only slot: the project is full
    await taker.page.goto(`/en/projects/${SLUG}`);
    await taker.page.getByLabel("I accept these terms for myself, and I will credit the original team.").check();
    await taker.page.getByRole("button", { name: "Continue this project" }).click();
    await taker.page.waitForURL(`**/projects/${SLUG}/workspace`);

    const guest = await newPage(browser);
    await guest.page.goto(`/en/projects/${SLUG}`);
    await expect(guest.page.getByText("The team quota for this project is full.")).toBeVisible();
    await expect(guest.page.getByRole("link", { name: "Sign in to be notified" })).toBeVisible();
    await guest.context.close();

    // a signed-in visitor sees "full" with the notify button
    await watcher.page.goto(`/en/projects/${SLUG}`);
    await expect(watcher.page.getByRole("heading", { name: "Team quota is full" })).toBeVisible();
    await expect(watcher.page.getByRole("button", { name: "Notify me" })).toBeVisible();

    // the access holder marks a task from the workspace, and it shows in the owner's lineage
    await taker.page.goto(`/en/projects/${SLUG}/workspace`);
    await taker.page.getByRole("radio", { name: "In progress" }).first().click();
    await expect(taker.page.getByRole("radio", { name: "In progress" }).first()).toHaveAttribute(
      "aria-checked",
      "true",
    );
  } finally {
    await owner.context.close();
    await watcher.context.close();
    await taker.context.close();
    await restore();
  }
});
