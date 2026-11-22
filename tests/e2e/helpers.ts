import "../../scripts/lib/env";
import { expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const PASSWORD = "E2e-Pass-2026!";
export const DEMO_PASSWORD = "Demo-Pass-2026!";

export function adminDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function newUserPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

export async function signIn(page: Page, email: string, opts: { password?: string; locale?: "id" | "en" } = {}) {
  const password = opts.password ?? DEMO_PASSWORD;
  const locale = opts.locale ?? "en";
  if (locale === "id") {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi").fill(password);
    await page.getByRole("button", { name: "Masuk" }).last().click();
  } else {
    await page.goto("/en/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }
  await page.waitForURL(/\/(dasbor|dashboard|admin|mulai)/);
}

export async function signUp(
  page: Page,
  name: string,
  email: string,
  opts: { password?: string; locale?: "id" | "en"; verifyWelcome?: boolean } = {},
) {
  const password = opts.password ?? PASSWORD;
  const locale = opts.locale ?? "en";
  if (locale === "id") {
    await page.goto("/signup");
    // The local bot check wants the form open for at least 3 seconds, as a person would take.
    await page.waitForTimeout(3200);
    await page.getByLabel("Nama lengkap").fill(name);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi").fill(password);
    await page.getByLabel(/Saya menyetujui Syarat dan Kebijakan Privasi/).check();
    await page.getByRole("button", { name: "Buat akun" }).click();
    await page.waitForURL("**/mulai");
    if (opts.verifyWelcome) {
      await expect(page.getByRole("heading", { name: "Apa yang ingin kamu lakukan?" })).toBeVisible();
    }
  } else {
    await page.goto("/en/signup");
    await page.waitForTimeout(3200);
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByLabel(/I accept the Terms and the Privacy Policy/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/mulai");
    if (opts.verifyWelcome) {
      await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
      await expect(page.getByRole("main").getByRole("link", { name: /Share a project/ })).toBeVisible();
      await expect(page.getByRole("main").getByRole("link", { name: /Explore projects/ })).toBeVisible();
    }
  }
}

export async function cleanTrialSession(participantCode: string) {
  await adminDb().from("trial_sessions").delete().eq("participant_code", participantCode);
}
