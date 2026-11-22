# Laporan Gerbang Kualitas Fase R8 (Quality Gate & QA Report)

- **Tanggal:** 22 November 2026
- **Cabang:** `release/r8-quality-gate` (bercabang dari `release/next` `0a8b5f8`)
- **Tag Penjaga:** `final-day-start` (`964d2e9`, tidak berubah; `git diff final-day-start..main --stat` kosong)
- **Status Keseluruhan:** **LULUS (Siap untuk Tahap A Staging pada Fase R9)**

---

## 1. Ringkasan Eksekutif

Fase R8 melakukan pengujian menyeluruh dan audit kualitas akhir terhadap seluruh fitur yang dibangun pada Fase R0 sampai R7 sebelum memasuki peluncuran bertahap (Fase R9). Seluruh tujuh butir gerbang kualitas R8 telah dieksekusi terhadap stack Supabase lokal dan build produksi lokal:

| Kategori Pemeriksaan | Alat / Berkas | Hasil |
|---|---|---|
| Lint, Format & Pemeriksaan Tipe | `eslint .`, `prettier --check`, `tsc --noEmit` | **Lulus (0 galat)** |
| Kepatuhan Bahasa & Glosarium (i18n) | `node scripts/check-i18n.mjs` + `tests/unit/r8-security.test.ts` | **Lulus (2.148 kunci ID & EN, 0 teks hard-coded, 0 istilah terlarang)** |
| Unit Tests & Kelengkapan Matriks Otorisasi | `pnpm test` (16 berkas uji) | **Lulus (199 / 199 pengujian)** |
| Database, RLS, Outbox Email & Uji IDOR Multi-Peran | `pnpm test:db` (9 berkas uji termasuk `r8-authz.test.ts`) | **Lulus (176 / 176 pengujian)** |
| Audit Kerentanan Dependensi | `pnpm audit --audit-level=high` | **Lulus (0 kerentanan diketahui)** |
| End-to-End Playwright (Bahasa Indonesia & Inggris) | `tests/e2e/{id-smoke,core-flow,r4-flows,admin}.spec.ts` | **Lulus (seluruh alur utama, R4, R5, R6)** |
| Audit Tumpang-Tindih (Overlap) & Reduced Motion | `tests/e2e/overlap.spec.ts` (39 rute × 6 viewport + reduced motion) | **Lulus (0 elemen tertutup, 0 luapan horizontal, 0 teks terpotong)** |
| Audit Aksesibilitas (axe-core WCAG 2.1 A/AA & Keyboard) | `tests/e2e/a11y.spec.ts` (ponsel 390px & desktop 900/1280/1440px) | **Lulus (0 pelanggaran serious/critical, navigasi keyboard lulus)** |
| Performa Build Produksi (Mid-Range Phone Throttle) | `pnpm perf` (`scripts/perf-check.ts`, build `.next-prod`) | **Lulus (Home LCP 1,22 dtk / CLS 0,011; Explore LCP 2,46 dtk / CLS 0,000)** |
| Skrip Uji Beban (Load Test) | `tests/load/explore-and-uploads.k6.js` + `tests/load/README.md` | **Siap (200 VU pembaca + 20 VU pengunggah dengan penjaga keamanan)** |

---

## 2. Metodologi & Lingkungan Pengujian

- **Sistem Operasi & Runtime:** Windows, Node.js `v25.1.0`, `pnpm 10.22.0`.
- **Framework & Peramban Uji:** Next.js `16.4.6` (Turbopack), Playwright `1.56.1` (Chromium headless), `@axe-core/playwright 4.11.0`, Vitest `5.1.1`.
- **Isolasi Database:** Seluruh pengujian destruktif, pemulihan, dan E2E dijalankan terhadap stack Docker Supabase lokal (`supabase_db_estafet` di `127.0.0.1:54322`, `supabase_kong_estafet` di `127.0.0.1:54321`) menggunakan `.env.localstack`. Proyek Supabase cloud pemilik yang tercatat di `.env.local` **tidak pernah disentuh** oleh pengujian otomatis.
- **Build Produksi Lokal:** Untuk pengukuran performa (`pnpm perf`) dan verifikasi produksi, aplikasi dibangun dengan `NEXT_DIST_DIR=.next-prod` dan variabel dari `.env.localstack` (diverifikasi `0` referensi URL cloud di dalam bundle `.next-prod`).

---

## 3. Hasil Rinci per Butir Gerbang Kualitas R8

### 3.1 Butir 1 — Pengujian End-to-End (Bahasa Indonesia sebagai Bahasa Utama + Bahasa Inggris)

1. **Konsolidasi Helper E2E:** Helper pendaftaran, masuk akun, pembuatan konteks peramban baru, koneksi service-role database, dan pembersihan baris uji coba disatukan di [`tests/e2e/helpers.ts`](../tests/e2e/helpers.ts) dan dipakai bersama oleh [`tests/e2e/core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts), [`tests/e2e/r4-flows.spec.ts`](../tests/e2e/r4-flows.spec.ts), [`tests/e2e/admin.spec.ts`](../tests/e2e/admin.spec.ts), dan [`tests/e2e/id-smoke.spec.ts`](../tests/e2e/id-smoke.spec.ts).
2. **Pengulangan (*Repeatability*) Tanpa Pembersihan Manual:** `tests/e2e/admin.spec.ts` kini membersihkan sesi uji coba `participant_code = 'E2E1'` sebelum dan sesudah pengujian (`try / finally`), dan `tests/e2e/id-smoke.spec.ts` selalu memastikan status moderasi proyek contoh kembali `ok` pada blok `finally`.
3. **Cakupan Alur Bahasa Indonesia (`tests/e2e/id-smoke.spec.ts`):**
   - Bahasa bawaan `lang="id"` di `/` dan peralihan dua arah ke `/en` dan kembali ke `/`.
   - Halaman publik (`/explore`, `/projects/[slug]`, `/login`, `/signup`, halaman 404) serta kelima halaman hukum (`/terms`, `/privacy`, `/pedoman`, `/atribusi`, `/kontak`) beserta spanduk **"Draf, belum ditinjau pihak berwenang"**.
   - **Alur R4 Bahasa Indonesia:** Pendaftaran akun baru -> `/mulai` -> wizard `/bagikan` -> langkah Berkas (**Isi manual tanpa AI**) -> tambah butir manual di `/tinjau` -> konfirmasi tim & pilih mode **Terbuka dengan perjanjian** (batas 1 tim) di `/tim` -> terbitkan di `/terbit` -> tarik dari publik (**Tarik dari publik**) dan terbitkan kembali (**Terbitkan lagi**) dari `/proyek/[slug]/pengaturan`.
   - **Alur R5 Bahasa Indonesia:** Kirim laporan dari menu proyek -> terima kode referensi `LP-XXXXXXXX` -> lihat status di `/laporan-saya` -> buka `/akun/privasi` -> unduh ekspor data JSON (`/api/account/export`) -> simpan preferensi email -> jadwalkan penghapusan akun (masa tunggu 30 hari tampil di `/dasbor`) -> batalkan penghapusan akun.
   - **Alur R6 Bahasa Indonesia:** Masuk sebagai admin -> verifikasi seluruh 12 halaman `/admin` berbahasa Indonesia -> tahan proyek (**Tahan**) dengan alasan tertulis -> verifikasi pemberitahuan netral **"Proyek ini sedang ditinjau"** bagi pengunjung -> verifikasi halaman keputusan pemilik `/proyek/[slug]/keputusan` menampilkan alasan tanpa identitas pelapor -> pulihkan proyek (**Pulihkan**).

### 3.2 Butir 2 — Audit Tumpang-Tindih (Overlap), Tata Letak & Reduced Motion

- **Cakupan Rute:** [`tests/e2e/overlap.spec.ts`](../tests/e2e/overlap.spec.ts) memeriksa **14 rute publik** (termasuk `/pedoman`, `/atribusi`, `/kontak`), **19 rute pengguna masuk** (termasuk `/laporan-saya`, `/akun/privasi`, `/proyek/[slug]/pengaturan`, `/proyek/[slug]/keputusan`, kelima langkah wizard `/bagikan/[id]/*`, ruang proyek, dan pratinjau pengunjung), serta **12 rute admin** (`/admin` s.d. `/admin/settings`, termasuk `/admin/policies` dan `/admin/announcements`) pada **6 ukuran viewport** (`360×740`, `390×844`, `768×1024`, `1024×768`, `1280×800`, `1536×864`).
- **Pemeriksaan per Halaman & Viewport:**
  1. Titik tengah setiap elemen interaktif yang terlihat (`a`, `button`, `input`, `select`, `textarea`, `[role="button"]`, `[role="tab"]`, `[role="menuitem"]`) mengenai elemen itu sendiri atau labelnya (`document.elementFromPoint`).
  2. Tidak ada luapan horizontal (`document.documentElement.scrollWidth <= clientWidth + 1`).
  3. Tidak ada teks yang terpotong oleh kontainer `overflow: hidden / clip` kecuali yang sengaja memakai `text-overflow: ellipsis` atau `line-clamp`.
  4. Kartu melayang (`.floating`) di hero Beranda tidak pernah menyentuh judul `h1`, paragraf pengantar, atau tombol CTA selama animasi berjalan, dan tepat 3 kartu tampil pada layar ponsel (`<= 390px`).
  5. Laci navigasi ponsel (`Buka menu`) dan menu akun (`Menu akun`) tidak pernah tertutup elemen lain dan menjaga perangkap fokus (*focus trap*).
- **Verifikasi `prefers-reduced-motion: reduce`:** Pengujian khusus memverifikasi bahwa saat `reducedMotion: "reduce"` aktif, seluruh elemen animasi berulang (`.floating` dan `.cloud-drift`) memiliki `getComputedStyle(el).animationName === "none"`.

### 3.3 Butir 3 — Aksesibilitas (axe-core WCAG 2.1 A/AA & Navigasi Keyboard)

- **Hasil axe-core ([`tests/e2e/a11y.spec.ts`](../tests/e2e/a11y.spec.ts)):**
  - `0` pelanggaran tingkat `serious` atau `critical` (tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) pada seluruh halaman admin (lebar `900px`, `1280px`, `1440px`), dialog konfirmasi admin, dialog laporan publik, halaman `/mulai`, `/dasbor`, kartu akses, halaman kebijakan (`/terms`, `/privacy`, `/pedoman`, `/atribusi`, `/kontak`), halaman `/laporan-saya`, `/akun/privasi`, dan `/proyek/[slug]/pengaturan` baik pada viewport ponsel (`390×844`) maupun desktop (`1280×900`).
  - Selama pengujian R8 pada viewport ponsel `390×844`, axe menemukan bahwa kata ke-4 pada baris kedua judul hero Beranda (`text-[#C7E2FF]`) memiliki kontras di bawah ambang ketika bertumpuk dengan awan dekoratif atas (`QA-002`). Warna teks baris kedua diperbaiki menjadi `text-[#EAF4FF]` dan dua awan dekoratif atas disembunyikan pada layar ponsel (`max-sm:hidden`) di [`src/components/features/HomeHero.tsx`](../src/components/features/HomeHero.tsx), sehingga kontras lulus 100% di semua viewport.
- **Navigasi Keyboard:**
  - Tautan **Lewati ke konten** (`#main`) adalah pemberhentian `Tab` pertama di setiap halaman dan menampilkan kotak fokus kontras tinggi (`bg-lime text-black`).
  - Input *honeypot* anti-bot (`input[name="website"]` pada pendaftaran dan dialog laporan) memiliki `tabindex="-1"` dan `aria-hidden="true"`, sehingga pengguna keyboard tidak pernah terjebak di dalamnya.
  - Dialog laporan dan laci navigasi ponsel dapat dibuka dengan `Enter`, memerangkap fokus `Tab` di dalam `[role="dialog"]`, menutup saat `Escape` ditekan, dan mengembalikan fokus ke tombol pemicunya.

### 3.4 Butir 4 — Performa (Build Produksi Lokal)

Diukur menggunakan [`scripts/perf-check.ts`](../scripts/perf-check.ts) (`pnpm perf`) terhadap build produksi lokal (`NEXT_DIST_DIR=.next-prod`, `next start -p 3100`) pada profil ponsel mid-range ter-throttle (viewport `390×844` @ 2x, perlambatan CPU 4x, unduhan 1,6 Mbps, RTT 150 ms, median dari 3 pembacaan tanpa cache):

| Halaman | LCP (Median) | Target LCP | CLS (Median) | Target CLS | JS (Uncompressed) | Total Transfer (Uncompressed) |
|---|---|---|---|---|---|---|
| Beranda (`/`) | **1,22 dtk** | `< 2,50 dtk` | **0,011** | `< 0,050` | 862 KB | 1.218 KB |
| Jelajahi (`/explore`) | **2,46 dtk** | `< 2,50 dtk` | **0,000** | `< 0,050` | 861 KB | 4.565 KB |
| Ringkasan Proyek (`/projects/mangrove-cover-classifier`) | **3,14 dtk** | — | **0,000** | `< 0,050` | 884 KB | 1.222 KB |
| Masuk (`/login`) | **0,95 dtk** | — | **0,000** | `< 0,050` | 857 KB | 1.157 KB |
| Bagikan (`/bagikan`) | **1,12 dtk** | — | **0,000** | `< 0,050` | 857 KB | 1.158 KB |

> **Catatan kejujuran pengukuran:** Angka ukuran JavaScript dan Transfer di atas adalah ukuran *uncompressed* pada koneksi lokal (`localhost:3100`) tanpa kompresi Brotli/Gzip dari CDN. Pada lingkungan produksi ber-CDN (mis. Vercel), transfer jaringan terkompresi sekitar 25–35% dari angka *uncompressed*, namun latensi jaringan nyata ke server cloud akan menambah waktu RTT. Pengukuran ulang wajib dijalankan pada lingkungan staging (Tahap A).

### 3.5 Butir 5 — Tinjauan Keamanan & Pengujian Otorisasi Sistematis

#### A. Matriks Otorisasi & Uji Otomatis
- **Matriks Otorisasi ([`tests/security/authz.matrix.ts`](../tests/security/authz.matrix.ts)):** Mendokumentasikan **105 titik masuk** secara eksplisit: **36 rute halaman**, **12 rute API**, **38 Server Action pengguna** (`src/app/actions/*.ts`), dan **19 Server Action admin** (`src/app/[locale]/admin/actions.ts`).
- **Verifikasi Kelengkapan Otomatis ([`tests/unit/r8-security.test.ts`](../tests/unit/r8-security.test.ts)):** Memindai seluruh berkas di `src/app/actions/*.ts`, `src/app/[locale]/admin/actions.ts`, dan `src/app/api/**/route.ts` untuk memastikan setiap fungsi atau rute yang diekspor terdaftar di dalam `AUTHZ_MATRIX`.
- **Pengujian IDOR & Isolasi Multi-Peran ([`tests/db/r8-authz.test.ts`](../tests/db/r8-authz.test.ts)):** Menguji 10 peran (`guest`, `owner`, `coOwner`, `holder`, `revokedHolder`, `requester`, `stranger`, `unverified`, `suspended`, `admin`) terhadap pembacaan/penulisan lintas akun, pencabutan akses berkas pribadi, pemblokiran pengguna yang belum verifikasi email atau sedang ditangguhkan, isolasi sesi *break-glass* 5 menit antar-admin, serta pembatas laju `check_rate_limit`.

#### B. Hasil Audit Database, RLS, Penyimpanan & `createAdminClient()`

| Pemeriksaan Keamanan | Metode Verifikasi | Hasil |
|---|---|---|
| RLS pada tabel `public` | Query `pg_tables` (`rowsecurity`) | **29 / 29 tabel** memiliki `rowsecurity = true`. Tiga tabel (`announcements`, `email_outbox`, `rate_limit_hits`) sengaja memiliki 0 policy langsung dan hanya diakses melalui fungsi `SECURITY DEFINER` / service role. |
| Fungsi `SECURITY DEFINER` tanpa `search_path` | Query `pg_proc` (`prosecdef = true`) | **0 fungsi** `SECURITY DEFINER` tanpa `search_path`. Seluruh fungsi `SECURITY DEFINER` mengunci `search_path = public, pg_temp`. |
| Bucket penyimpanan (`storage.buckets`) | Query `storage.buckets` + `pg_policies` | Kedua bucket (`project-files`, `extracted-text`) memiliki **`public = false`** dan 0 policy publik; unduhan hanya melalui signed URL 60 detik (atau maks 300 detik untuk break-glass) setelah pemeriksaan izin. |
| Pandangan publik (`public_project_teaser`, `public_teaser_items`) | Query `information_schema.columns` + uji REST `anon` | `public_project_teaser` hanya memuat proyek dengan `status = 'published'` dan `moderation_status = 'ok'`. Kolom `advisor_name` dan `no_advisor` sudah dihapus sejak R5. `public_teaser_items` hanya mengekspor label sumber (`source_label`), tidak pernah kutipan bukti (`evidence`). |
| Audit seluruh pemakaian `createAdminClient()` | Tinjauan kode manual di `src/` | Seluruh pemakaian `createAdminClient()` berada di kode server (`src/app/api/**`, `src/app/actions/**`, `src/lib/**`) dan didahului pemeriksaan otorisasi (kepemilikan proyek, RLS pada `project_files`, `requireAdmin()`, atau `CRON_SECRET` waktu-konstan). |
| *Defense-in-depth* rute ekspor CSV Admin | `src/app/api/admin/{audit,trials}/export/route.ts` | Ditambahkan pemeriksaan eksplisit `supabase.rpc("is_admin")` di dalam kedua handler (`QA-001`) sehingga pemanggilan langsung tanpa proxy tetap mengembalikan `404`. |
| Penonaktifan rute dev di Produksi | `src/app/api/dev/email-preview/route.ts` | Mengembalikan `404` ketika `isProduction()` bernilai `true` (diuji di `tests/unit/r8-security.test.ts`). |

### 3.6 Butir 6 — Skrip Uji Beban (k6)

- Dibuat [`tests/load/explore-and-uploads.k6.js`](../tests/load/explore-and-uploads.k6.js) beserta dokumentasi [`tests/load/README.md`](../tests/load/README.md).
- Mencakup skenario `browse_explore_and_teasers` (200 VU bersamaan selama 2 menit pada halaman publik dan pencarian) dan `concurrent_uploads` (20 VU bersamaan mengunggah berkas Markdown ke `/api/projects/:id/files`).
- Dilengkapi penjaga `-e ALLOW_LOAD_TEST=1` agar tidak pernah tidak sengaja dijalankan terhadap proyek cloud bersama.

### 3.7 Butir 7 — Tinjauan Bahasa Indonesia & Kepatuhan Glosarium

- Seluruh **2.148 kunci** di `messages/id.json` dan `messages/en.json` diperiksa oleh `scripts/check-i18n.mjs` dan `tests/unit/r8-security.test.ts`.
- **0 istilah terlarang:** Tidak ada kemunculan `dosen pembimbing`, `advisor`, `creator`, `adopter`, `pengadopsi`, `remah roti`, `usaha kecil`, `TODO`, `PLACEHOLDER`, `FIXME`, atau `lorem ipsum`.
- **12 templat email transaksional** diuji dalam bahasa Indonesia dan Inggris terhadap payload XSS (`<script>`, `<img onerror>`, `<svg onload>`) dan seluruhnya di-*escape* dengan aman.

---

## 4. Log Masalah yang Ditemukan & Diperbaiki Selama R8

| ID | Tingkat | Lokasi | Temuan | Perbaikan & Verifikasi |
|---|---|---|---|---|
| **QA-001** | Rendah (Defense-in-Depth) | `src/app/api/admin/audit/export/route.ts`, `src/app/api/admin/trials/export/route.ts` | Kedua rute ekspor CSV mengandalkan `src/proxy.ts` untuk memblokir non-admin; jika dipanggil langsung tanpa proxy, query pada view `admin_*_v` mengembalikan CSV kosong dengan status `200`, bukan `404`. | Ditambahkan pemeriksaan `const { data: isAdmin } = await supabase.rpc("is_admin"); if (isAdmin !== true) return NextResponse.json({ error: "Not found" }, { status: 404 });` dan diverifikasi di `tests/unit/r8-security.test.ts`. |
| **QA-002** | Sedang (Aksesibilitas) | `src/components/features/HomeHero.tsx` | Pada viewport ponsel `390×844`, axe-core melaporkan `color-contrast (serious)` pada kata ke-4 baris kedua judul hero (`text-[#C7E2FF]`) karena bertumpuk dengan awan dekoratif atas (`top-[240px]`). | Warna baris kedua judul hero diperbarui menjadi `text-[#EAF4FF]` dan kedua awan dekoratif atas diberi `max-sm:hidden`. Diverifikasi lulus `0` pelanggaran axe pada `390×844` dan `1280×900`. |
| **QA-003** | Rendah (Pengulangan Uji) | `tests/e2e/admin.spec.ts` | Pengujian sesi uji coba memasukkan baris `participant_code = 'E2E1'` tanpa menghapusnya kembali, sehingga eksekusi kedua gagal pada asersi `ESTAFET (n = 5)`. | Ditambahkan `cleanTrialSession("E2E1")` sebelum dan di dalam blok `finally` pada `tests/e2e/admin.spec.ts`. |
| **QA-004** | Rendah (Kebersihan Kode) | `tests/e2e/core-flow.spec.ts`, `tests/e2e/r4-flows.spec.ts`, `tests/e2e/admin.spec.ts` | Fungsi helper `signUp`, `signIn`, dan pembuatan konteks peramban terduplikasi di beberapa berkas spesifikasi E2E. | Disatukan ke dalam [`tests/e2e/helpers.ts`](../tests/e2e/helpers.ts) dengan dukungan parameter `locale: "id" \| "en"`. |
| **QA-005** | Rendah (Peringatan Konsol) | `src/app/[locale]/layout.tsx` | Next.js 16 mencetak peringatan ketika `scroll-behavior: smooth` dipakai di CSS tanpa atribut `data-scroll-behavior="smooth"` pada elemen `<html>`. | Ditambahkan `data-scroll-behavior="smooth"` pada `<html lang={locale} ...>` di `src/app/[locale]/layout.tsx`. |

---

## 5. Keterbatasan & Hal yang Belum Diverifikasi (Menunggu Tahap A/B Pemilik Proyek)

Sesuai aturan kejujuran bukti (`CLAUDE.md` bagian 14.1 dan `docs/handover-r8-r9.md` bagian 2.2), hal-hal berikut **belum dapat diverifikasi di mesin lokal** dan harus diselesaikan oleh pemilik proyek pada Fase R9 menggunakan [`docs/launch-checklist.md`](launch-checklist.md):

1. **Penyedia AI Nyata (`AI_PROVIDER=gemini` / `openai` / `anthropic`):** Seluruh pengujian lokal memakai `LLM_PROVIDER=mock`. Pemanggilan API model AI nyata dengan kunci API nyata harus diuji pemilik pada Tahap A (Staging).
2. **Pengiriman Email Nyata (`EMAIL_PROVIDER=resend` + SPF/DKIM/DMARC):** Seluruh pengujian lokal memakai `EMAIL_PROVIDER=log` atau server SMTP tiruan lokal. Pengiriman ke kotak masuk nyata harus diverifikasi pemilik pada Tahap A.
3. **Cloudflare Turnstile Nyata:** Tanpa kunci Turnstile, aplikasi menggunakan pemeriksaan bot lokal (*honeypot* + waktu isi minimal 3 detik).
4. **Penjadwal Ter-host (Vercel Cron / `pg_cron`) & Cadangan Cloud:** Rute `/api/cron/emails`, `/api/cron/daily`, dan `pnpm restore:drill` sudah teruji secara lokal, namun penjadwal ter-host serta pemulihan dari cadangan proyek Supabase cloud belum dijalankan.
5. **Tinjauan Penutur Asli, Penasihat Hukum & Pembaca Layar Manual:** Teks bahasa Indonesia ditulis dengan bantuan AI (meski sudah lulus audit glosarium R8), halaman hukum masih berstatus draf (*Draf, belum ditinjau pihak berwenang*), dan pengujian pembaca layar nyata (NVDA/VoiceOver oleh manusia) masih direncanakan.
6. **Sesi Uji Coba Pengguna Nyata (`n = 0`):** Belum ada sesi uji coba mahasiswa nyata di `/admin/trials` (`is_demo = false`) sampai Tahap B (Beta Tertutup) dijalankan oleh pemilik.
