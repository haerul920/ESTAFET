import "../../scripts/lib/env";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * R5 screens (run in English like the other specs). Uses the seeded demo project `campus-waste-sorting-assistant`.
 *  1. The five legal pages render in both languages, carry the draft banner and are linked from the footer.
 *  2. A guest sends a report from the project menu and gets a reference code.
 *  3. A held project shows the neutral notice instead of the teaser, and is restored afterwards.
 *
 * NOT RUN YET: written while Docker was off. Run it with the local stack (`pnpm db:start`, `pnpm db:reset`, `pnpm test:e2e tests/e2e/r5-moderation.spec.ts`).
 * The database rules behind it (threshold, dismissal, appeals, anonymity, export, deletion) are covered by tests/db/r5.test.ts.
 */
const SLUG = "campus-waste-sorting-assistant";

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

const PAGES = [
  { path: "terms", en: "Terms and Conditions", id: "Syarat dan Ketentuan" },
  { path: "privacy", en: "Privacy Policy", id: "Kebijakan Privasi" },
  { path: "pedoman", en: "Community Guidelines", id: "Pedoman Komunitas" },
  { path: "atribusi", en: "Attribution Agreement", id: "Perjanjian Atribusi" },
  { path: "kontak", en: "Contact", id: "Kontak" },
];

test("the legal pages render in both languages, say they are drafts, and are linked from the footer", async ({
  page,
}) => {
  for (const p of PAGES) {
    await page.goto(`/en/${p.path}`);
    await expect(page.getByRole("heading", { level: 1, name: p.en })).toBeVisible();
    await expect(page.getByText("Draft, not yet reviewed by the competent authority")).toBeVisible();

    await page.goto(`/${p.path}`);
    await expect(page.getByRole("heading", { level: 1, name: p.id })).toBeVisible();
    await expect(page.getByText("Draf, belum ditinjau pihak berwenang")).toBeVisible();
  }
  await page.goto("/en");
  const footer = page.getByRole("contentinfo");
  for (const href of ["/en/terms", "/en/privacy", "/en/pedoman", "/en/atribusi", "/en/kontak"]) {
    await expect(footer.locator(`a[href="${href}"]`)).toBeVisible();
  }
});

test("a guest reports a project from the menu and receives a reference code", async ({ page }) => {
  await page.goto(`/en/projects/${SLUG}`);
  await page.getByRole("button", { name: "Project menu" }).click();
  await page.getByRole("menuitem", { name: /Report/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Community Guidelines" })).toBeVisible();
  await dialog.getByRole("radio", { name: /Spam/ }).check();
  await dialog.getByLabel("What is wrong?").fill("This is an end to end test report written by the automated test.");
  // The local bot check rejects a form that is sent faster than a person could fill it.
  await page.waitForTimeout(3500);
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByText(/reference/i)).toBeVisible();
});

test("a held project shows a neutral notice, not the teaser, and returns when restored", async ({ page }) => {
  const db = service();
  const { data: before } = await db.from("projects").select("id, moderation_status").eq("slug", SLUG).single();
  expect(before?.moderation_status).toBe("ok");
  try {
    await db.from("projects").update({ moderation_status: "held" }).eq("slug", SLUG);
    const res = await page.goto(`/en/projects/${SLUG}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "This project is being reviewed" })).toBeVisible();
    await expect(page.getByText("Campus Waste Sorting Assistant")).toHaveCount(0);
  } finally {
    await db.from("projects").update({ moderation_status: "ok" }).eq("slug", SLUG);
  }
  await page.goto(`/en/projects/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1, name: "Campus Waste Sorting Assistant" })).toBeVisible();
});
