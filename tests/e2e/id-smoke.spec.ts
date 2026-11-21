import "../../scripts/lib/env";
import { expect, test } from "@playwright/test";

/** Indonesian is the default and has no URL prefix. English lives under /en. The other specs run in English. */
test("the default language is Indonesian and the switcher moves to English and back", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lanjutkan dari");
  await expect(page.getByRole("main").or(page.locator("body"))).not.toContainText("Pick up where");

  await page.getByRole("button", { name: "English" }).first().click();
  await page.waitForURL("**/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick up where");

  await page.getByRole("button", { name: "Bahasa Indonesia" }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/en"));
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
});

test("key public pages are fully Indonesian, with Indonesian formats", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Jelajahi proyek" })).toBeVisible();
  await expect(page.getByText("Tugas terverifikasi terbanyak")).toBeAttached();
  await expect(page.getByText("Explore projects")).toHaveCount(0);

  await page.goto("/projects/mangrove-cover-classifier");
  await expect(page.getByRole("heading", { level: 1, name: "Mangrove Cover Classifier" })).toBeVisible();
  await expect(page.getByText("Proyek riset")).toBeVisible();
  await expect(page.getByText("Posisi saat ini")).toBeVisible();
  await expect(page.getByRole("button", { name: "Laporkan proyek ini" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
  await page.goto("/signup");
  await expect(page.getByLabel(/Saya menyetujui Syarat dan Kebijakan Privasi/)).toBeVisible();

  const missing = await page.goto("/halaman-yang-tidak-ada");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman itu tidak ditemukan" })).toBeVisible();
});

test("the signed-in dashboard is Indonesian", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("creator@estafet.demo");
  await page.getByLabel("Kata sandi").fill("Demo-Pass-2026!");
  await page.getByRole("button", { name: "Masuk" }).last().click();
  await page.waitForURL("**/dasbor");
  await expect(page.getByRole("heading", { name: "Proyek yang kubagikan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proyek yang kulanjutkan" })).toBeVisible();
});
