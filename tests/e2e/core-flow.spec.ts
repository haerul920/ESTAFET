import "../../scripts/lib/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { makePdf } from "../../src/lib/demo/make-pdf";

const PASSWORD = "E2e-Pass-2026!";
const stamp = Date.now();
const creatorEmail = `e2e.creator.${stamp}@example.test`;
const adopterEmail = `e2e.adopter.${stamp}@example.test`;
const title = `E2E Reef Counter ${stamp}`;

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/en/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("University email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel(/I accept the Terms and the Privacy Policy/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  // A new account with nothing yet lands on the first-run screen. It is a hint, not a role.
  await page.waitForURL("**/mulai");
  await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /Share a project/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /Explore projects/ })).toBeVisible();
}

async function newUserPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test("core flow: share, verify, publish, request, approve, accept, access", async ({ browser, page }) => {
  // ---- Creator signs up and fills the basics
  await signUp(page, "E2E Creator", creatorEmail);
  await page.goto("/en/bagikan");
  await page.getByLabel("Project title").fill(title);
  await page
    .getByLabel("Short summary")
    .fill("A synthetic test project that counts coral colonies in reef photos to speed up survey work.");
  await page.getByLabel("Type of work").selectOption("research");
  await page.getByLabel("Faculty or field").selectOption("Marine Science and Fisheries");
  await page.getByLabel("Why did it stop?").selectOption("funding_not_granted");
  await page.getByLabel("Advisor name").fill("Dr. Test Advisor");
  await page.getByLabel("Advisor email").fill("advisor@example.test");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/berkas");

  // ---- Files. Nothing is read by AI before the team agreed: the AI path needs this consent first.
  await expect(page.getByRole("button", { name: "Draft with AI and continue" })).toBeDisabled();
  await page.getByRole("button", { name: "My team and I agree that AI reads the files" }).click();
  await expect(page.getByText("Your consent is recorded.")).toBeVisible();
  // PDF, Markdown, ZIP with a .env inside
  const zip = new JSZip();
  zip.file("README.md", "# Reef counter\nCounts coral.");
  zip.file("package.json", '{"name":"reef"}');
  zip.file(".env", "KEY=1234567890abcdefghij");
  const zipBytes = await zip.generateAsync({ type: "nodebuffer" });
  const pdf = Buffer.from(
    makePdf([
      "The team collected 600 photos from one reef near the pier.",
      "TODO: a second annotator must check label agreement before results mean anything.\nA field protocol for camera distance is still missing.\nFlight permits delayed the second dive by several weeks.",
    ]),
  );
  await page.locator("#file-input").setInputFiles([
    { name: "survey-report.pdf", mimeType: "application/pdf", buffer: pdf },
    { name: "field-notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Notes\n\n## Labeling\nTODO: edge class needs far more labeled images.\n") },
    { name: "code.zip", mimeType: "application/zip", buffer: zipBytes },
  ]);
  await expect(page.getByText("Text extracted from 2 pages.")).toBeVisible();
  await expect(page.getByText(/Parsed 2 sections/)).toBeVisible();
  await expect(page.getByText(/1 sensitive file was skipped and not stored \(\.env\)/)).toBeVisible();

  // a file whose extension lies is rejected
  await page.locator("#file-input").setInputFiles([{ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf at all") }]);
  await expect(page.getByText(/content is not a PDF/)).toBeVisible();

  // ---- Draft in mock mode, then verify every item
  await page.getByRole("button", { name: "Draft with AI and continue" }).click();
  await page.waitForURL("**/tinjau");
  await expect(page.getByText("Simulated AI output (mock mode).")).toBeVisible();
  await expect(page.getByText("Evidence not found").first()).toBeVisible();

  // publishing is blocked while items are pending
  await expect(page.getByRole("button", { name: "Continue to team and access" })).toBeDisabled();

  const keepButtons = page.getByRole("button", { name: "Keep", exact: true });
  const total = await keepButtons.count();
  expect(total).toBeGreaterThan(2);
  for (let i = 0; i < total; i++) {
    // remove the unsupported item, keep the rest
    const card = page.locator("section[aria-label='Drafted items'] > div").nth(i);
    const unsupported = (await card.getByText("Evidence not found").count()) > 0;
    await card.getByRole("button", { name: unsupported ? "Remove" : "Keep", exact: true }).click();
  }
  await expect(page.getByText(`${total} of ${total} reviewed`)).toBeVisible();
  await page.getByRole("link", { name: "Continue to team and access" }).click();
  await page.waitForURL("**/tim");

  // ---- Team and access: the advisor link (approved in a separate, signed-out browser context) and the access rules
  await page.getByRole("button", { name: "Create consent link" }).click();
  const link = await page.getByLabel(/Private link for/).inputValue();
  expect(link).toContain("/consent/");

  const advisor = await newUserPage(browser);
  await advisor.page.goto(link);
  await expect(advisor.page.getByRole("heading", { name: /wants to share a project/ })).toBeVisible();
  await advisor.page.getByRole("button", { name: "Approve publishing" }).click();
  await expect(advisor.page.getByText(/approval is recorded/)).toBeVisible();
  // a second attempt on the same link is refused (single decision)
  await advisor.page.reload();
  await expect(advisor.page.getByText(/This link allows one decision/)).toBeVisible();
  await advisor.context.close();

  await page.reload();
  await page.getByRole("link", { name: "Continue to the preview" }).click();
  await page.waitForURL("**/terbit");

  // ---- Publish (the Terms and Privacy Policy were accepted at sign up, so there is nothing more to tick)
  await page.getByLabel(/The preview above is what I want to make public/).check();
  await expect(page.getByLabel(/I accept the current/)).toHaveCount(0);
  await page.getByRole("button", { name: "Publish teaser" }).click();
  await page.waitForURL(/\/projects\/e2e-reef-counter/);
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Verified next tasks")).toBeVisible();
  // only a source label is public, never the evidence quote from the private file
  await expect(page.getByText("Source: survey-report.pdf, p.2").first()).toBeVisible();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const leak = await page.request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/public_teaser_items?select=evidence`, {
    headers: { apikey: anonKey },
  });
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
  await ap.getByLabel("Teammates' university emails").fill("mate.one@example.test, mate.two@example.test");
  await ap.locator("input[name='task_ids']").first().check();
  await ap.getByLabel("What will you do in your first month?").fill("We will start with the first verified task and report back with a revised evaluation.");
  await ap.getByLabel("What is this for?").selectOption("competition");
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
  await ap.getByLabel("I accept these terms for myself, and I will credit the original team.").check();
  await ap.getByRole("button", { name: "Accept and get access" }).click();
  await expect(ap.getByText("Accepted. Your access is active.")).toBeVisible();

  await ap.goto(`/en/projects/${slug}/workspace`);
  await expect(ap.getByRole("heading", { name: "Private files" })).toBeVisible();
  await expect(ap.getByText("TODO: a second annotator must check")).toBeVisible();

  // download the PDF through a signed URL
  const [download] = await Promise.all([ap.waitForEvent("download"), ap.getByRole("link", { name: "Download survey-report.pdf" }).click()]);
  expect(download.suggestedFilename()).toBe("survey-report.pdf");

  // the agreement PDF is available to both sides
  const res = await ap.request.get(`/api/requests/${requestUrl.split("/").pop()}/agreement`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");

  await adopter.context.close();
});

test("a declined request leaves the project published", async ({ browser }) => {
  // Make the test repeatable: put the seeded demo request back to pending (lineage stays append-only).
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await admin
    .from("continuation_requests")
    .update({ status: "pending", decided_at: null, decided_by: null, decision_note: null })
    .eq("id", "e0000000-0000-4000-8000-000000000001");

  const creator = await newUserPage(browser);
  await creator.page.goto("/en/login");
  await creator.page.getByLabel("University email").fill("creator@estafet.demo");
  await creator.page.getByLabel("Password").fill("Demo-Pass-2026!");
  await creator.page.getByRole("button", { name: "Sign in" }).click();
  await creator.page.waitForURL("**/dasbor");
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
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await admin.from("project_access").delete().eq("project_id", "b0000000-0000-4000-8000-000000000002").eq("profile_id", "c0000000-0000-4000-8000-000000000001");

  const person = await newUserPage(browser);
  const p = person.page;
  await p.goto("/en/login");
  await p.getByLabel("University email").fill("creator@estafet.demo");
  await p.getByLabel("Password").fill("Demo-Pass-2026!");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL("**/dasbor");
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
