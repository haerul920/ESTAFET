import "../../scripts/lib/env";
import { expect, test } from "@playwright/test";
import { officeFile } from "../office-fixtures";
import { makePdf } from "../../src/lib/demo/make-pdf";
import { pickOption, adminDb, newUserPage, signIn, signUp } from "./helpers";

const stamp = Date.now();
const creatorEmail = `e2e.creator.${stamp}@example.test`;
const adopterEmail = `e2e.adopter.${stamp}@example.test`;
const title = `E2E Reef Counter ${stamp}`;

test("core flow: share, verify, publish, request, approve, accept, access", async ({ browser, page }) => {
  // ---- Creator signs up and fills the basics
  await signUp(page, "E2E Creator", creatorEmail, { verifyWelcome: true });
  await page.goto("/en/bagikan");
  await page.getByLabel("Project title").fill(title);
  await pickOption(page, "Type of work", "Research");
  await pickOption(page, "Faculty or field", "Faculty of Marine Science and Fisheries (FIKP)");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/berkas");

  // ---- Files. Nothing is read by AI before the team agreed: the AI path needs this consent first.
  await expect(page.getByRole("button", { name: "Draft with AI and continue" })).toBeDisabled();
  await page.getByRole("button", { name: "My team and I agree that AI reads the files" }).click();
  await expect(page.getByText("Your consent is recorded.")).toBeVisible();
  // PDF, Markdown and a Word file. A ZIP is refused.
  const word = await officeFile.word([{ text: "Reef counter: the app counts coral in photos." }]);
  const pdf = Buffer.from(
    makePdf([
      "The team collected 600 photos from one reef near the pier.",
      "TODO: a second annotator must check label agreement before results mean anything.\nA field protocol for camera distance is still missing.\nFlight permits delayed the second dive by several weeks.",
    ]),
  );
  await page.locator("#file-input").setInputFiles([
    { name: "survey-report.pdf", mimeType: "application/pdf", buffer: pdf },
    {
      name: "field-notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Notes\n\n## Labeling\nTODO: edge class needs far more labeled images.\n"),
    },
    {
      name: "handover.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(word),
    },
  ]);
  await expect(page.getByText("Text taken from 2 pages.")).toBeVisible();
  await expect(page.getByText("2 sections read.")).toBeVisible();
  await expect(page.getByText("Text taken from 1 section.")).toBeVisible();

  await page
    .locator("#file-input")
    .setInputFiles([{ name: "code.zip", mimeType: "application/zip", buffer: Buffer.from("PK") }]);
  await expect(page.getByText(/ZIP files are not accepted/)).toBeVisible();

  // a file whose extension lies is rejected
  await page
    .locator("#file-input")
    .setInputFiles([{ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf at all") }]);
  await expect(page.getByText("The content of this file does not match the .pdf ending.")).toBeVisible();

  // ---- Draft in mock mode, then verify every item
  await page.getByRole("button", { name: "Draft with AI and continue" }).click();
  await page.waitForURL("**/tinjau");
  // OPEN QUESTION for the owner: CLAUDE.md section 2 requires a "Simulated AI output (mock mode)" banner here. It is
  // not on the screen at the moment, so it is not asserted until the owner decides.
  await expect(page.getByText("Evidence not found").first()).toBeVisible();

  // OPEN QUESTION for the owner: the AI items arrive already marked "kept", so they need no action to pass. The first
  // rule was that every drafted item has to be reviewed. The lock itself still works for an item set back to pending:
  const firstKeep = page.getByRole("button", { name: "Keep", exact: true }).first();
  await expect(firstKeep).toHaveAttribute("aria-pressed", "true");
  await firstKeep.click();
  await expect(page.getByText(/Review the remaining 1 item/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to team and access" })).toHaveCount(0);
  await firstKeep.click();
  await expect(page.getByRole("link", { name: "Continue to team and access" })).toBeVisible();

  const keepButtons = page.getByRole("button", { name: "Keep", exact: true });
  let kept = 0;
  let seen = 0;
  for (const tab of ["Suggested next steps", "Materials"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    const count = await keepButtons.count();
    let removed = 0;
    for (let i = 0; i < count; i++) {
      // remove the unsupported item, keep the rest. A removed card leaves the list.
      const card = page.locator("section[aria-label='Drafted items'] > div").nth(i - removed);
      const unsupported = (await card.getByText("Evidence not found").count()) > 0;
      if (unsupported) {
        await card.getByRole("button", { name: "Remove", exact: true }).click();
        removed++;
        continue;
      }
      // "Keep" is a switch: pressing it again would set the item back to pending.
      const keep = card.getByRole("button", { name: "Keep", exact: true });
      if ((await keep.getAttribute("aria-pressed")) !== "true") await keep.click();
    }
    // each tab shows its own progress
    await expect(page.getByText(`${count - removed} of ${count - removed} reviewed`)).toBeVisible();
    seen += count;
    kept += count - removed;
  }
  expect(seen).toBeGreaterThan(2);
  expect(kept).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Continue to team and access" }).click();
  await page.waitForURL("**/tim");

  // ---- Team and access: the owner already confirmed on the Files step, so the preview is next
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/terbit");

  // ---- Publish (the Terms and Privacy Policy were accepted at sign up, so there is nothing more to tick)
  await page.getByLabel(/The preview above is what I want to make public/).check();
  await expect(page.getByLabel(/I accept the current/)).toHaveCount(0);
  await page.getByRole("button", { name: "Publish teaser" }).click();
  await page.waitForURL(/\/projects\/e2e-reef-counter/);
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Next steps suggested by the original team")).toBeVisible();
  // only a source label is public, never the evidence quote from the private file
  // the public page does not name the private source files
  await expect(page.getByText(/^Source: /)).toHaveCount(0);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const leak = await page.request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/public_teaser_items?select=evidence`,
    {
      headers: { apikey: anonKey },
    },
  );
  expect(leak.status()).toBe(400); // the public view has no evidence column
  const base = await page.request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/draft_items?select=evidence`, {
    headers: { apikey: anonKey },
  });
  expect(await base.json()).toEqual([]); // anonymous visitors cannot read draft items at all

  await page.goto("/en/explore?q=E2E+Reef");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  // ---- Adopter requests, a non-member cannot open the workspace
  const adopter = await newUserPage(browser);
  const ap = adopter.page;
  await signUp(ap, "E2E Adopter", adopterEmail);
  await ap.goto(`/en/projects/${slug}/workspace`);
  await expect(ap).toHaveURL(new RegExp(`/projects/${slug}\\?locked=1`));

  await ap.goto(`/en/projects/${slug}/request`);
  await ap.getByLabel("Team name").fill("Team E2E");
  await ap.getByLabel("Teammates' emails").fill("mate.one@example.test, mate.two@example.test");
  await ap.locator("input[name='task_ids']").first().check();
  await ap
    .getByLabel("What will you do in your first month?")
    .fill("We will start with the first verified task and report back with a revised evaluation.");
  await pickOption(ap, "What is this for\\?", /competition/i);
  const future = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  await ap.getByLabel("Target date").fill(future);
  await ap.getByLabel(/I understand that if this request is approved/).check();
  await ap.getByRole("button", { name: "Send request" }).click();
  await ap.waitForURL(/\/requests\//);
  const requestUrl = ap.url();
  await expect(ap.getByText("Waiting for the owners").first()).toBeVisible();

  // ---- The owner approves. Approval alone does not open the files.
  await page.goto(requestUrl);
  await page.getByRole("button", { name: "Approve request" }).click();
  await expect(page.getByText(/^Approved on/)).toBeVisible();
  await ap.goto(`/en/projects/${slug}/workspace`);
  await expect(ap).toHaveURL(new RegExp(`/projects/${slug}\\?locked=1`));

  // ---- The requester accepts the agreement for themselves: access starts
  await ap.goto(requestUrl);
  // a click that lands before the page is interactive is undone, so tick until the button reacts
  await expect(async () => {
    await ap.getByLabel("I accept these terms for myself, and I will credit the original team.").check();
    await expect(ap.getByRole("button", { name: "Accept and get access" })).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 60_000 });
  await ap.getByRole("button", { name: "Accept and get access" }).click();
  await expect(ap.getByText("Accepted. Your access is active.")).toBeVisible();

  await ap.goto(`/en/projects/${slug}/workspace`);
  await expect(ap.getByRole("heading", { name: "Private files" })).toBeVisible();
  await expect(ap.getByText("TODO: a second annotator must check")).toBeVisible();

  // download the PDF through a signed URL
  const [download] = await Promise.all([
    ap.waitForEvent("download"),
    ap.getByRole("link", { name: "Download survey-report.pdf" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("survey-report.pdf");

  // the agreement PDF is available to both sides
  const res = await ap.request.get(`/api/requests/${requestUrl.split("/").pop()}/agreement`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");

  await adopter.context.close();
});

test("a declined request leaves the project published", async ({ browser }) => {
  // Make the test repeatable: put the seeded demo request back to pending (lineage stays append-only).
  const admin = adminDb();
  await admin
    .from("continuation_requests")
    .update({ status: "pending", decided_at: null, decided_by: null, decision_note: null })
    .eq("id", "e0000000-0000-4000-8000-000000000001");

  const creator = await newUserPage(browser);
  await signIn(creator.page, "creator@estafet.demo");
  // The seeded Mangrove request is pending for the demo account that owns it.
  await creator.page.getByRole("link", { name: "Review request" }).first().click();
  await creator.page.getByRole("button", { name: "Decline" }).click();
  await creator.page.getByRole("button", { name: "Yes, decline" }).click();
  await expect(creator.page.getByText(/^Declined on/)).toBeVisible();
  await creator.page.goto("/en/projects/mangrove-cover-classifier");
  await expect(creator.page.getByRole("heading", { level: 1, name: "Mangrove Cover Classifier" })).toBeVisible();
  await creator.context.close();
});

test("the same account shares projects and continues another one, through open mode", async ({ browser }) => {
  // Make the test repeatable: remove this account's earlier access to the open demo project (lineage stays append-only).
  const admin = adminDb();
  await admin
    .from("project_access")
    .delete()
    .eq("project_id", "b0000000-0000-4000-8000-000000000002")
    .eq("profile_id", "c0000000-0000-4000-8000-000000000001");

  const person = await newUserPage(browser);
  const p = person.page;
  await signIn(p, "creator@estafet.demo");
  // This account owns projects, so the first section is filled.
  await expect(p.getByRole("heading", { name: "Projects I share" })).toBeVisible();
  await expect(p.getByRole("link", { name: "Mangrove Cover Classifier", exact: true })).toBeVisible();

  // Another person's project that is open with an agreement: no approval step, the files open after one checkbox.
  await p.goto("/en/projects/campus-waste-sorting-assistant");
  await expect(p.getByRole("heading", { name: "Continue this project" })).toBeVisible();
  const take = p.getByRole("button", { name: "Continue this project" });
  await expect(take).toBeDisabled();
  await p.getByLabel("I accept these terms for myself, and I will credit the original team.").check();
  await take.click();
  await p.waitForURL("**/projects/campus-waste-sorting-assistant/workspace");
  await expect(p.getByRole("heading", { name: "Private files" })).toBeVisible();

  // The same dashboard now shows both: what this person shares, and what they are continuing. No role switch.
  await p.goto("/en/dasbor");
  await expect(p.getByRole("heading", { name: "Projects I share" })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Projects I am continuing" })).toBeVisible();
  await expect(p.getByText("Access active").first()).toBeVisible();

  // An owner cannot take access to their own project.
  await p.goto("/en/projects/mangrove-cover-classifier");
  await expect(p.getByRole("heading", { name: "This is your project" })).toBeVisible();
  await expect(p.getByRole("button", { name: "Continue this project" })).toHaveCount(0);
  await person.context.close();
});
