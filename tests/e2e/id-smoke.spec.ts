import "../../scripts/lib/env";
import { expect, test } from "@playwright/test";
import { adminDb, DEMO_PASSWORD, newUserPage, signIn, signUp } from "./helpers";

const stamp = Date.now();
const REASON_ID = "Ditinjau oleh pengujian e2e berbahasa Indonesia dengan alasan yang jelas.";

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

test("key public and legal pages are fully Indonesian, with draft notices and Indonesian formats", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Jelajahi proyek" })).toBeVisible();
  await expect(page.getByText("Tugas terverifikasi terbanyak")).toBeAttached();
  await expect(page.getByText("Explore projects")).toHaveCount(0);

  await page.goto("/projects/mangrove-cover-classifier");
  await expect(page.getByRole("heading", { level: 1, name: "Mangrove Cover Classifier" })).toBeVisible();
  await expect(page.getByText("Proyek riset")).toBeVisible();
  await expect(page.getByText("Posisi saat ini")).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu proyek" })).toBeVisible();

  for (const [path, heading, hasDraftBanner] of [
    ["/terms", "Syarat dan Ketentuan", true],
    ["/privacy", "Kebijakan Privasi", true],
    ["/pedoman", "Pedoman Komunitas", true],
    ["/atribusi", "Perjanjian Atribusi", true],
    ["/kontak", "Kontak", false],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    if (hasDraftBanner) {
      await expect(page.getByText("Draf, belum ditinjau pihak berwenang")).toBeVisible();
    }
  }

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
  await page.goto("/signup");
  await expect(page.getByLabel(/Saya menyetujui Syarat dan Kebijakan Privasi/)).toBeVisible();

  const missing = await page.goto("/halaman-yang-tidak-ada");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman itu tidak ditemukan" })).toBeVisible();
});

test("the signed-in dashboard is Indonesian", async ({ page }) => {
  await signIn(page, "creator@estafet.demo", { locale: "id" });
  await expect(page.getByRole("heading", { name: "Proyek yang kubagikan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proyek yang kulanjutkan" })).toBeVisible();
});

test("R4 Indonesian flow: manual wizard, open access, publish, unpublish and republish in Indonesian", async ({
  browser,
  page,
}) => {
  const title = `E2E Catatan Manual ID ${stamp}`;
  await signUp(page, "Pemilik Manual ID", `e2e.id.manual.${stamp}@example.test`, {
    locale: "id",
    verifyWelcome: true,
  });

  // Step 1: Info dasar
  await page.goto("/bagikan");
  await page.getByLabel("Judul proyek").fill(title);
  await page
    .getByLabel("Ringkasan singkat")
    .fill("Proyek sintetis berbahasa Indonesia yang seluruh catatannya diisi manual tanpa penyedia AI.");
  await page.getByLabel("Jenis pekerjaan").selectOption("hackathon");
  await page.getByLabel("Fakultas atau bidang").selectOption("Engineering");
  await page.getByLabel("Mengapa berhenti?").selectOption("team_graduated");
  await page.getByRole("button", { name: "Simpan dan lanjutkan" }).click();
  await page.waitForURL("**/berkas");

  // Step 2: Isi manual tanpa AI
  await page.getByRole("button", { name: "Isi manual" }).click();
  await page.waitForURL("**/tinjau");

  // Step 3: Tambah item manual
  await expect(page.getByText(/Kamu memilih mengisi manual/)).toBeVisible();
  await page.getByLabel("Judul").fill("Tulis protokol lapangan untuk tim berikutnya");
  await page.getByRole("button", { name: "Tambah item" }).click();
  await expect(page.getByText("1 dari 1 ditinjau")).toBeVisible();
  await page.getByRole("link", { name: "Lanjut ke tim dan akses" }).click();
  await page.waitForURL("**/tim");

  // Step 4: Konfirmasi tim & buka akses dengan perjanjian
  await page.getByRole("button", { name: "Saya konfirmasi" }).click();
  await page.getByRole("radio", { name: /^Terbuka dengan perjanjian/ }).check();
  await page.getByLabel("Berapa tim penerus sekaligus").selectOption("1");
  await page.getByRole("button", { name: "Simpan aturan akses" }).click();
  await expect(page.getByText("Aturan akses disimpan.")).toBeVisible();
  await page.getByRole("link", { name: "Lanjut ke pratinjau" }).click();
  await page.waitForURL("**/terbit");

  // Step 5: Terbitkan ringkasan
  await page.getByLabel(/Pratinjau di atas adalah yang ingin saya jadikan publik/).check();
  await page.getByRole("button", { name: "Terbitkan ringkasan" }).click();
  await page.waitForURL(/\/projects\/e2e-catatan-manual-id/);
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // Pengaturan proyek: Tarik dari publik lalu Terbitkan lagi
  const visitor = await newUserPage(browser);
  await page.goto(`/proyek/${slug}/pengaturan`);
  await expect(page.getByRole("heading", { name: "Pengaturan proyek" })).toBeVisible();
  await page.getByRole("button", { name: "Tarik dari publik" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ya, lanjutkan" }).click();
  await expect(page.getByText("Ditarik", { exact: true }).first()).toBeVisible();
  expect((await visitor.page.goto(`/projects/${slug}`))?.status()).toBe(404);

  await page.getByRole("button", { name: "Terbitkan lagi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ya, lanjutkan" }).click();
  await expect(page.getByText("Terbit", { exact: true }).first()).toBeVisible();
  expect((await visitor.page.goto(`/projects/${slug}`))?.status()).toBe(200);
  await visitor.context.close();
});

test("R5 Indonesian flow: report project, view /laporan-saya, and manage /akun/privasi", async ({ page }) => {
  await signIn(page, "adopter@estafet.demo", { locale: "id" });

  // Laporkan proyek dalam bahasa Indonesia
  await page.goto("/projects/mangrove-cover-classifier");
  await page.getByRole("button", { name: "Menu proyek" }).click();
  await page.getByRole("menuitem", { name: /Laporkan/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /Informasi palsu atau menyesatkan/ }).check();
  await dialog.getByLabel("Apa yang salah?").fill("Uji E2E ID: klaim akurasi perlu dicek terhadap berkas laporan.");
  await page.waitForTimeout(3500);
  await dialog.getByRole("button", { name: "Kirim laporan" }).click();
  await expect(page.getByText(/Kode referensi: LP-[0-9A-F]{8}/)).toBeVisible();

  // Lihat di /laporan-saya
  await page.goto("/laporan-saya");
  await expect(page.getByRole("heading", { level: 1, name: "Laporan saya" })).toBeVisible();
  await expect(page.getByText("Mangrove Cover Classifier").first()).toBeVisible();

  // Privasi akun (/akun/privasi): ekspor JSON, preferensi email, jadwalkan & batalkan penghapusan akun
  await page.goto("/akun/privasi");
  await expect(page.getByRole("heading", { level: 1, name: "Privasi akun" })).toBeVisible();
  const exp = await page.request.get("/api/account/export");
  expect(exp.status()).toBe(200);
  const exported = await exp.json();
  expect(exported.account.email).toBe("adopter@estafet.demo");

  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Pengaturan email disimpan.")).toBeVisible();

  await page.getByRole("button", { name: "Jadwalkan penghapusan akun" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ya, jadwalkan penghapusan" }).click();
  await expect(page.getByRole("button", { name: "Batalkan penghapusan" })).toBeVisible();

  await page.goto("/dasbor");
  await expect(page.getByText(/Akunmu dijadwalkan dihapus pada/)).toBeVisible();

  await page.goto("/akun/privasi");
  await page.getByRole("button", { name: "Batalkan penghapusan" }).click();
  await expect(page.getByRole("button", { name: "Jadwalkan penghapusan akun" })).toBeVisible();
});

test("R6 Indonesian flow: admin pages in Indonesian, hold project -> neutral notice & owner decision page -> restore", async ({
  browser,
}) => {
  const admin = await newUserPage(browser);
  const a = admin.page;
  await signIn(a, "admin@estafet.demo", { locale: "id" });

  const adminPages: [string, string][] = [
    ["/admin", "Ringkasan"],
    ["/admin/projects", "Proyek"],
    ["/admin/reports", "Laporan"],
    ["/admin/appeals", "Banding"],
    ["/admin/users", "Pengguna"],
    ["/admin/policies", "Kebijakan"],
    ["/admin/announcements", "Pengumuman"],
    ["/admin/pipeline", "Pipeline AI"],
    ["/admin/requests", "Permintaan"],
    ["/admin/trials", "Uji coba onboarding"],
    ["/admin/audit", "Catatan audit"],
    ["/admin/settings", "Pengaturan"],
  ];
  for (const [path, heading] of adminPages) {
    expect((await a.goto(path))?.status(), path).toBe(200);
    await expect(a.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }

  // Tahan proyek (Hold) -> pengunjung melihat pemberitahuan netral, pemilik melihat /proyek/[slug]/keputusan -> Pulihkan
  await a.goto("/admin/projects?q=Study+Group&demo=1");
  await a.locator("tbody tr").first().getByRole("link").click();
  await a.getByRole("button", { name: "Tahan", exact: true }).click();
  const holdDialog = a.getByRole("dialog");
  await holdDialog.getByLabel(/Alasan/).fill(REASON_ID);
  await holdDialog.getByRole("button", { name: "Tahan", exact: true }).click();
  const pw = holdDialog.getByLabel("Konfirmasi kata sandimu");
  if (
    await pw.waitFor({ state: "visible", timeout: 2500 }).then(
      () => true,
      () => false,
    )
  ) {
    await pw.fill(DEMO_PASSWORD);
    await holdDialog.getByRole("button", { name: "Konfirmasi dan lanjutkan" }).click();
  }
  await expect(holdDialog).toBeHidden();

  try {
    // Pengunjung melihat pemberitahuan netral berbahasa Indonesia
    const guest = await newUserPage(browser);
    await guest.page.goto("/projects/study-group-matcher");
    await expect(guest.page.getByRole("heading", { name: "Proyek ini sedang ditinjau" })).toBeVisible();
    await expect(guest.page.getByText(/tidak berarti ada aturan yang dilanggar/)).toBeVisible();
    await guest.context.close();

    // Pemilik (alumni@estafet.demo memiliki study-group-matcher) melihat halaman keputusan moderasi tanpa identitas pelapor
    const owner = await newUserPage(browser);
    await signIn(owner.page, "alumni@estafet.demo", { locale: "id" });
    await owner.page.goto("/proyek/study-group-matcher/keputusan");
    await expect(owner.page.getByRole("heading", { level: 1, name: "Keputusan tentang proyekmu" })).toBeVisible();
    await expect(owner.page.getByText("Identitas pelapor tidak pernah dibagikan kepada pemilik proyek.")).toBeVisible();
    await expect(owner.page.getByText(REASON_ID).first()).toBeVisible();
    await owner.context.close();

    // Admin memulihkan proyek dari antarmuka berbahasa Indonesia
    await a.getByRole("button", { name: "Pulihkan", exact: true }).click();
    const restoreDialog = a.getByRole("dialog");
    await restoreDialog.getByLabel(/Alasan/).fill(REASON_ID);
    await restoreDialog.getByRole("button", { name: "Pulihkan", exact: true }).click();
    await expect(restoreDialog).toBeHidden();
  } finally {
    // Pastikan proyek selalu kembali berstatus 'ok' di database meskipun terjadi kegagalan di tengah pengujian
    await adminDb()
      .from("projects")
      .update({ moderation_status: "ok", moderation_reason: null })
      .eq("slug", "study-group-matcher");
    await admin.context.close();
  }
});
