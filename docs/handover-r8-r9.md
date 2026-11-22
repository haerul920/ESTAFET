# Serah terima: melanjutkan fase R8 (gerbang mutu) dan R9 (peluncuran)

Dokumen ini untuk programmer (atau tim, atau asisten AI) yang melanjutkan ESTAFET setelah fase **R7** selesai dan digabung. Tulisannya sengaja panjang dan konkret: baca bagian 1 sampai 5 dulu (30 menit), lalu kerjakan bagian 6 (R8) dan 7 (R9) berurutan.

Bahasa dokumen: Indonesia, dengan istilah teknis dalam bahasa Inggris. Dokumen proyek lain (README, `CLAUDE.md`, `docs/*`) berbahasa Inggris dan tidak diubah.

Tanggal keadaan yang dilukiskan: **22 November 2026**. Jika Anda membacanya jauh setelah itu, cek `git log` dulu: mungkin ada yang sudah berubah.

---

## 1. Ringkasan satu halaman

**Apa itu ESTAFET.** Platform serah terima proyek mahasiswa Universitas Hasanuddin yang berhenti di tengah jalan. Pemilik proyek mengunggah berkas, AI menyusun draf (ringkasan, tujuan, pekerjaan selesai, tugas berikutnya, pelajaran) lengkap dengan bukti kutipan, pemilik meninjau tiap item, lalu menerbitkan ringkasan publik. Tim penerus meminta (atau langsung mengambil) akses, menerima perjanjian atribusi, dan berkas pribadi terbuka. Tim: Beban Server, untuk STACK 2026 (GDGoC ITB), Case 1.

**Stack.** Next.js 16 (App Router, `proxy.ts` sebagai pengganti middleware, React 19, TypeScript ketat), Tailwind 4, Radix UI, next-intl 4 (bawaan `id`, bahasa Inggris di `/en`), Supabase (Postgres, Auth, Storage, RLS), Zod, Vitest, Playwright, pnpm.

**Fase yang sudah selesai dan digabung ke `release/next`:**

| Fase | Isi | Bukti utama |
|---|---|---|
| R0 | Audit dan rencana | `docs/release-plan.md` |
| R1 | Akun tunggal, model akses (`project_access`, mode `open`/`by_request`/`paused`, kuota) | `docs/migrations-r1.md` |
| R2 | Antarmuka bahasa Indonesia + pengalih bahasa | `docs/copy-review.md`, `pnpm i18n:check` |
| R3 | Desain, animasi, lapisan (z-index), audit tumpang tindih | `tests/e2e/overlap.spec.ts` |
| R4 | Wizard `/bagikan`, pengaturan pemilik, alur permintaan | `docs/migrations-r4.md` |
| R5 | Laporan, moderasi, halaman legal, privasi akun | `tests/db/r5.test.ts` |
| R6 | Panel admin v2 (seluruhnya berbahasa Indonesia) | `docs/migrations-r6.md` |
| R7 | Kesiapan produksi: cek konfigurasi, CSP, email, job terjadwal, SEO, runbook | `docs/migrations-r7.md`, `docs/runbook.md` |

**Yang BELUM ada (inti pekerjaan Anda):**

- **R8**: kualitas menyeluruh sebelum ada pengguna sungguhan (e2e lengkap, aksesibilitas, performa, uji otorisasi sistematis, uji beban, tinjauan isi teks, laporan QA).
- **R9**: peluncuran bertahap (staging, beta tertutup, publik). **Setiap tahap butuh konfirmasi eksplisit pemilik proyek.** Jangan melangkah sendiri.
- **Tidak ada satu pun lingkungan hosted** (Supabase cloud untuk staging/produksi, Vercel, penyedia email, monitor uptime, webhook alert). Semua yang dinyatakan "terverifikasi" di repo ini hanya terverifikasi di **stack lokal Docker**. Ini fakta terpenting untuk Anda.

---

## 2. Aturan yang tidak boleh dilanggar

Baca ini dengan serius. Pelanggaran paling mahal ada di sini.

### 2.1 Dokumen yang mengikat (urutan prioritas)

1. `CLAUDE.md` **bagian 15** (amandemen pemilik): **tidak ada peran dosen pembimbing**; **email apa pun boleh mendaftar**. Mengalahkan semua yang lain.
2. `CLAUDE.md` **bagian 14** (edisi rilis): prinsip, mesin status, moderasi, bahasa, motion, lapisan, produksi.
3. `PROMPTS_RELEASE.md`: prompt fase R0 sampai R9. Bagian R8 dan R9 adalah spesifikasi tugas Anda (disalin lengkap di bagian 6 dan 7 di bawah, tapi baca aslinya juga).
4. `CLAUDE.md` bagian 1 sampai 13 dan `PROMPTS.md`, `PROMPTS_ADMIN.md`: berlaku bila tidak bertentangan dengan di atas.

Jika sebuah permintaan bertentangan dengan `CLAUDE.md`, katakan dulu sebelum bertindak (itu aturan di bagian atas `CLAUDE.md`).

### 2.2 Aturan kerja (dari pemilik proyek)

- **Satu branch per fase**, nama `release/rN-...`, digabung ke `release/next` dengan `git merge --no-ff` **hanya saat pemilik minta** ("gabungkan"). Pola yang sudah dipakai: pemilik berkata "gabungkan R6 dan lanjut R7", baru digabung.
- **Jangan `git push`** kecuali diminta. Remote `origin` ada (`haerul920/ESTAFET`); `main` adalah baseline kompetisi, jangan disentuh. Tag `final-day-start` menunjuk ke `964d2e9`, jangan dipindah.
- **Jangan klaim apa pun yang tidak dijalankan.** Setiap baris status di README harus punya kolom "tidak diverifikasi" yang jujur. Ini juga aturan kompetisi STACK (fitur rencana tidak boleh tampil sebagai selesai).
- **Tugas Final Day belum pernah diberikan** pemilik. Tanya sebelum menyelesaikan sesuatu yang mungkin termasuk tugas Final Day.
- **R9: jangan go public tanpa konfirmasi eksplisit tiap tahap.** Jangan menghapus banner "Draf" legal, jangan membuka pendaftaran, jangan menyalakan data nyata sebelum pemilik berkata ya.
- **Setelah tiap fase**: jalankan `pnpm check` dan semua tes, perbarui tabel Status di `README.md`, perbarui `docs/ai-disclosure.md`, lalu lapor apa yang selesai dan apa yang tidak (bagian 8).
- **Data pribadi**: jangan menaruh nama, email, atau isi berkas di log, issue, atau pesan commit.
- **Jangan kirim data pengguna ke layanan luar** tanpa persetujuan (aturan umum lingkungan kerja AI di sini juga berlaku).

### 2.3 Keputusan pemilik yang sudah final (jangan ditanyakan ulang)

Dari `docs/release-plan.md` bagian 7, disetujui pemilik 21 November 2026 ("setuju"):

- Batas tim penerus aktif per proyek bawaan **3** (pemilik bisa 1, 3, atau tak terbatas).
- Nada antarmuka: **"kamu"**.
- Proyek **tanpa dosen** diperbolehkan, dan kemudian dosen dihapus seluruhnya (CLAUDE.md 15.1). Tidak ada pernyataan "tanpa dosen", tidak ada pemeriksaan acak.
- Pembatasan domain email: dibuka untuk semua (15.2). `ALLOWED_EMAIL_DOMAINS` hanya pembatas opsional di admin, kosong secara bawaan. (Catatan lama "allowlist `.ac.id` saat beta" di memori proyek **sudah digantikan** amandemen 15.2; bila pemilik ingin beta dibatasi, itu keputusan baru, tanya.)
- Hosting: Vercel + Supabase wilayah Singapura (belum dibuat).
- `framer-motion` dipertahankan.
- Identitas pengendali data **belum diputuskan**: teks legal membawa penanda.
- Hubungan "pemilik proyek" dan "tim penerus" adalah per proyek, bukan jenis akun.

### 2.4 Keputusan yang masih terbuka (jangan diputuskan sendiri)

Cari penanda `[TEAM TO CONFIRM` di repo. Saat ini:

| Di mana | Apa |
|---|---|
| `docs/runbook.md` | Tabel kontak (pemilik, on-call, moderator, kontak kampus), siapa memutuskan pelaporan insiden ke otoritas |
| `docs/security.md` | Alamat dan waktu respons untuk laporan kerentanan |
| `docs/ai-disclosure.md` | Siapa yang meninjau apa |
| `docs/privacy-data-map.md` | Masa simpan laporan, log, audit; dasar hukum; perjanjian pemroses; analitik |
| Teks legal (`messages/*.json`, namespace `legal.*`) | Identitas penyelenggara/pengendali data, kontak, pendaftaran PSE Lingkup Privat |
| `docs/operations-checklist.md` | Rencana backup, tujuan alert, keputusan Sentry |

---

## 3. Memulai di mesin Anda

### 3.1 Prasyarat

Node 22, pnpm 10 (`corepack enable`), Docker Desktop (untuk stack Supabase lokal), Git. Windows 11 dipakai selama pengembangan; semuanya juga jalan di Linux/macOS (CI memakai Ubuntu).

### 3.2 Pertama kali

```bash
pnpm install
pnpm db:start                 # Supabase lokal di Docker (tanpa imgproxy, vector, dll.)
pnpm exec supabase status -o env   # salin nilai ke .env.localstack (lihat di bawah)
pnpm db:reset                 # reset DB lokal, isi data demo, unggah berkas demo, buat admin demo
pnpm dev:local                # server dev di port 3100 terhadap stack LOKAL
```

Dua berkas env, **sengaja**:

- `.env.localstack`: selalu menunjuk stack lokal. Dibaca duluan oleh semua skrip tes dan seed.
- `.env.local`: target "normal" pemilik, **mungkin menunjuk proyek Supabase cloud milik pemilik**. Skrip seed dan tes DB menolak URL non-lokal kecuali `ALLOW_REMOTE_SEED=true`. **Jangan pernah menjalankan tes atau seed terhadap proyek cloud.** Tes membuat dan menghapus pengguna.

Isi `.env.localstack` minimal:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY dari supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
LLM_PROVIDER=mock
APP_ENV=LOCAL
SEED_DEMO=true
```

Akun demo (hanya lokal/demo): `creator@estafet.demo`, `adopter@estafet.demo`, `alumni@estafet.demo`, `admin@estafet.demo`, kata sandi semuanya `Demo-Pass-2026!`.

### 3.3 Perintah yang akan sering dipakai

| Perintah | Fungsi |
|---|---|
| `pnpm check` | lint + format:check + typecheck + i18n:check + tes unit |
| `pnpm test` | tes unit (Vitest), ±190 tes, beberapa detik |
| `pnpm test:db` | tes aturan database terhadap stack lokal, 168 tes, ±1-2 menit |
| `pnpm exec playwright test <berkas>` | e2e; otomatis menyalakan `pnpm dev:local` di 3100 (atau memakai yang sudah hidup) |
| `pnpm i18n:check` | pesan Indonesia dan Inggris harus sama kuncinya, tidak ada kunci tak terpakai, tidak ada teks keras di komponen |
| `pnpm config:check [--file .env.x]` | cek konfigurasi seperti server saat boot |
| `pnpm restore:drill` | latihan restore DB lokal (dump, restore ke DB sementara, bandingkan baris) |
| `node scripts/build-cloud-sql.mjs` | bangun ulang `supabase/cloud-sql/` dari `supabase/migrations/` (WAJIB setelah menambah migrasi) |
| `pnpm deletions:process` | selesaikan penghapusan akun yang lewat masa tenggang (manual; produksi lewat job harian) |
| `pnpm shots`, `pnpm perf` | tangkapan layar dan cek performa sederhana (lihat `docs/performance.md`) |

### 3.4 Jebakan lingkungan yang sudah memakan waktu (baca!)

1. **Kompilasi pertama Playwright sangat lambat** (1 sampai 1,5 menit per halaman baru di dev server). Test e2e yang gagal dengan "Timeout" atau "page closed" di awal sering hanya itu. Jalankan ulang satu test dulu sebelum menyimpulkan ada bug. Untuk mengukur lebih adil, jalankan terhadap build produksi (bagian 3.5).
2. **Polusi data di DB lokal** membuat test bergantung data gagal: laporan sisa, pengaturan `max_upload_mb`, dan terutama baris `trial_sessions` berkode `E2E1` yang ditinggalkan `admin.spec` (test "smoke" mengharapkan tepat 5 sesi ESTAFET: 4 seed + 1 yang baru direkam). Bersihkan dengan psql lokal:
   `docker exec supabase_db_estafet psql -U postgres -c "delete from trial_sessions where participant_code='E2E1'"`.
   Batas laju laporan (5 per jam) juga bisa menghalangi test r5 yang diulang; hapus baris `rate_limit_hits` lokal bila perlu.
3. **Batas laju pada tes browser.** Server `pnpm dev:local` otomatis memasang `RATE_LIMIT_MULTIPLIER=1000` (hanya dihormati bila `APP_ENV=LOCAL`; konfigurasi produksi menolaknya). Jangan menyalakannya di server yang dipakai orang.
4. **Cek bot lokal butuh form terbuka minimal 3 detik.** Helper `signUp` di spec e2e menunggu 3,2 detik. Spec baru yang mendaftar akun harus melakukan hal yang sama.
5. **Docker/Windows**: `docker exec ... /tmp/x` di Git Bash mengubah path; pakai `MSYS_NO_PATHCONV=1`. Heredoc dengan tanda kutip campuran gagal di Bash; tulis skrip ke berkas dulu. Backslash bisa hilang satu tingkat lewat beberapa alat; untuk string berisi `<` gunakan `chr(92)` di Python.
6. **Pemilik biasanya menjalankan `next dev` sendiri di port 3000 di folder yang sama.** Jangan dimatikan. Tes memakai port 3100 dan `NEXT_DIST_DIR` berbeda bila perlu (`.next-e2e`, `.next-prod`; pola `/.next-*/` sudah di `.gitignore`). Jangan hapus `.next`.
7. **`next build` mengubah `tsconfig.json`** (menambah `.next-prod/types`). Kembalikan dengan `git checkout tsconfig.json` sebelum commit.
8. **`node --env-file` tidak bisa dipakai untuk `next build`** (Next meneruskannya ke worker lewat NODE_OPTIONS, yang menolaknya). Muat env dengan dotenv di skrip pembungkus (lihat pola `scripts/dev-local.mjs`).
9. **Edit bersamaan dengan Playwright jalan** memicu kompilasi ulang dan bisa membuat test gagal acak. Jangan edit `src/` saat e2e berjalan.
10. Memori kosong di mesin pengembang (±2,4 GB bebas) cukup untuk satu spec; jangan menjalankan `pnpm test:db` bersamaan dengan e2e besar.
11. Stack lokal Supabase **mengonfirmasi email otomatis**. Gerbang "email terverifikasi" hanya bisa diuji dengan mengosongkan `email_confirmed_at` lewat DB (lihat `tests/db/helpers.ts`, `clearEmailConfirmation`).
12. Mesin pengembang juga memuat kontainer proyek lain (`posko_ukm_jasuda_db`). Jangan disentuh.

### 3.5 Menjalankan build produksi secara lokal (dipakai saat R7)

Pola yang sudah terbukti (skrip pembungkus di luar repo; salin polanya):

```js
// build-local.cjs
const { config } = require("dotenv");
config({ path: ".env.localstack", quiet: true });
process.env.NEXT_DIST_DIR = ".next-prod";
require("node:child_process").spawn("pnpm", ["exec", "next", "build"], { stdio: "inherit", shell: true, env: process.env });
```

Lalu hal yang sama dengan `next start -p 3100` (set juga `CRON_SECRET` 32+ karakter untuk uji cron). Hasil R7: build lolos, header dan CSP benar tanpa `unsafe-eval`, spec `security` dan `ops` lolos terhadap build produksi.

---

## 4. Peta kode

```
src/
  proxy.ts                      lapis bahasa (next-intl) -> sesi Supabase -> akses admin; menaruh CSP bernonce dan x-robots-tag
  instrumentation.ts            register(): cek konfigurasi saat boot; onRequestError: log error terstruktur
  app/
    [locale]/                   semua halaman (id tanpa prefiks, en di /en). Rute: lihat bagian 6.5
    actions/*.ts                Server Actions pengguna (login, signup, laporan, akses, permintaan, pemilik, akun, ...)
    [locale]/admin/actions.ts   Server Actions admin (semua lewat fungsi SQL admin_* yang menulis audit)
    api/                        route handler: berkas (unggah/unduh), synthesize, agreement PDF, export akun, health,
                                cron/[job], dev/email-preview, admin/* (audit, break-glass, search, trials)
    robots.ts, sitemap.ts       SEO (robots dibaca saat runtime)
  components/ui|features|admin  komponen; admin sepenuhnya memakai namespace pesan admin.*
  lib/
    config.ts, boot.ts          aturan konfigurasi dan keluar proses bila tidak aman
    admin/env.ts                nama lingkungan: LOCAL, DEMO, STAGING, PRODUCTION
    security-headers.ts         CSP dan header tetap
    rate-limit.ts               allow(), clientIp(), hashKey(); gagal-terbuka bila DB mati
    botcheck.ts                 honeypot + waktu isi + Turnstile (belum diuji ke Cloudflare)
    log.ts                      log JSON tanpa data pribadi, alert() + webhook
    email/                      templates.ts (12 templat id/en), provider.ts (smtp/resend/log), dispatch.ts
    ingest/                     magic bytes, PDF, Markdown, ZIP-tree, secrets-scan, scan.ts (hook malware)
    llm/                        adapter gemini/anthropic/mock + validasi Zod + retry sekali
    synthesis.ts                alur sintesis + batas harian (per orang, per proyek, global)
    seo.ts                      canonical, alternates, JSON-LD
    supabase/                   server/client/admin/middleware/keys (+ sessionCookieOptions)
    account/deletion.ts         pemrosesan penghapusan akun setelah 30 hari
  i18n/                         routing, request, navigation
messages/id.json, en.json       SEMUA teks antarmuka (±2150 kunci)
supabase/migrations/            sumber kebenaran skema (urut waktu)
supabase/cloud-sql/             DIHASILKAN dari migrations (jangan edit manual) untuk ditempel ke SQL Editor
tests/unit | db | e2e           lihat bagian 5
scripts/                        seed, check-i18n, build-cloud-sql, restore-drill, check-config, process-deletions, dll.
docs/                           dokumentasi (daftar di bagian 9)
.github/workflows/ci.yml        CI (belum pernah dijalankan di GitHub)
vercel.json                     jadwal cron
```

**Prinsip arsitektur yang harus dipahami sebelum menyentuh kode:**

1. **Database adalah otoritas.** RLS aktif di semua tabel. Aturan bisnis ada di fungsi SQL `SECURITY DEFINER` yang memeriksa siapa pemanggilnya, bukan di komponen. Fungsi admin (`admin_*`) menulis perubahan **dan** baris audit dalam satu transaksi, dan wajib alasan ≥ 15 karakter untuk tindakan yang mengubah visibilitas.
2. **Service role hanya di kode server** setelah pemeriksaan otorisasi eksplisit. Ada tes unit yang melarang kode service-role berada di `src/app/**/admin`; kodenya ada di `src/lib/admin/*`.
3. **Setiap perubahan database = berkas migrasi baru** di `supabase/migrations/` (hanya menambah), lalu `node scripts/build-cloud-sql.mjs`, lalu dokumen `docs/migrations-rN.md`, lalu tes DB. Tambahan nilai enum harus di berkas migrasi **terpisah** dari yang memakainya (nilai enum baru baru bisa dipakai setelah commit), dan di cloud-sql tiap berkas dijalankan sendiri.
4. **Hint kesalahan SQL** (`raise exception ... hint = 'xyz'`) dipetakan ke pesan `errors.hints.xyz` di kedua bahasa; tes unit memeriksa semua hint punya pesan.
5. **Pesan antarmuka** hanya di `messages/*.json`. Kunci dinamis (disusun saat runtime) harus didaftarkan di `DYNAMIC_PREFIXES` pada `scripts/check-i18n.mjs`, kalau tidak dilaporkan "unused".
6. **Pesan error Server Action** admin memakai `msg()`/`dbMsg()` (`admin/actions.ts`); pesan skema Zod di pengaturan dan uji coba berupa **kode** yang diterjemahkan oleh aksi.
7. **Log tidak boleh memuat data pribadi.** Hanya id, hitungan, kode. `scrub()` di `log.ts` menjatuhkan kunci bernama email/name/token/text/reason/body, tapi jangan bergantung padanya.
8. **Next.js di sini bukan yang Anda hafal** (`AGENTS.md`): `proxy.ts` menggantikan `middleware.ts`, dan ada perubahan API lain. Baca `node_modules/next/dist/docs/` sebelum memakai API yang tidak yakin.

---

## 5. Inventaris tes saat ini

| Lapisan | Berkas | Jumlah | Catatan |
|---|---|---|---|
| Unit (Vitest) | `tests/unit/*.test.ts` | 189 | moderasi, penghapusan, admin, i18n, pemilik, config, email, seo, scan, rate-limit, layering, ingest, llm, evidence, kunci supabase |
| Database (Vitest, stack lokal) | `tests/db/*.test.ts` | 168 | `rules`, `access`, `admin`, `r4`, `r5`, `r6`, `r7`, `r7-dispatch` (+ `purge.destructive`, hanya manual: `pnpm test:db:purge`, **merusak**, lalu `pnpm db:reset`) |
| e2e (Playwright) | `tests/e2e/*.spec.ts` | ±55 | `core-flow` (3), `r4-flows`, `r5-moderation` (3), `admin` (4), `a11y` (5), `overlap` (±30 rute x viewport), `id-smoke`, `security` (3), `ops` (7) |

Terakhir dijalankan di stack lokal pada 22 November 2026: unit 189 lolos; DB 168 lolos; e2e: security, ops, core-flow, r5, a11y, admin, r4-flows, overlap lolos (dua kegagalan di satu putaran besar disebabkan baris sisa dan kompilasi lambat, lolos saat diulang). **CI GitHub belum pernah dijalankan** (lihat 6.9).

---

## 6. FASE R8: gerbang mutu

### 6.1 Tujuan dan kriteria selesai (dari `PROMPTS_RELEASE.md`)

> Phase R8: full quality pass before any user touches it.

Kriteria penerimaan: **tidak ada isu berat terbuka**; semua isu sedang diperbaiki atau terdaftar dengan pemilik dan tanggal; `docs/qa-report.md` ter-commit. Laporkan sesuai bagian 8.

Buat branch: `git checkout release/next && git checkout -b release/r8-quality-gate`.

Strategi kerja yang disarankan: kerjakan dalam urutan **5 (otorisasi) → 1 (e2e) → 2 (overlap/visual) → 3 (a11y) → 4 (performa) → 7 (isi teks) → 6 (beban) → laporan**. Alasan: otorisasi adalah risiko terbesar dan perbaikannya bisa mengubah perilaku yang diuji e2e; uji beban butuh staging jadi paling akhir.

Catat setiap temuan di `docs/qa-report.md` sejak awal dengan format: ID (QA-001), area, tingkat (Tinggi/Sedang/Rendah), langkah mereproduksi, dampak, status, pemilik, tanggal. Tinggi = data bocor, akses salah, situs mati, kehilangan data. Sedang = fitur rusak untuk banyak orang, galat a11y serius. Rendah = kosmetik atau satu orang.

### 6.2 Item 5: Tinjauan keamanan dan uji otorisasi (kerjakan duluan)

**Yang sudah ada:** RLS di semua tabel; `tests/db/admin.test.ts` (batas admin: pengunjung dan pengguna biasa ditolak semua fungsi/view `admin_*`); `rules.test.ts`/`access.test.ts`/`r4.test.ts`/`r5.test.ts` (aturan akses, kuota, kedaluwarsa, cabut, anonimitas pelapor, ekspor, penghapusan); batas laju dan `check_rate_limit`; ringkasan kontrol di `docs/security.md`.

**Yang belum ada (tugas Anda):** uji sistematis per rute dan per Server Action: "pengguna A tidak bisa menyentuh data pengguna B", sebagai tamu, ditangguhkan, belum terverifikasi, akses dicabut; IDOR pada tiap id; otorisasi unduhan berkas; batas laju.

**Cara mengerjakan:**

1. Buat `tests/security/authz.matrix.ts` yang mendaftar **setiap** entri (bagian 6.5 menyajikan inventaris) dengan kolom: pemanggil yang diizinkan, pemanggil yang harus ditolak, dan bentuk penolakan yang diharapkan (401/403/404/redirect login/hint).
2. Buat peran uji lewat `makeUser()` (di `tests/db/helpers.ts`): `owner`, `coOwner`, `holder` (punya akses aktif), `requester` (permintaan pending), `stranger` (login tanpa hubungan), `unverified` (kosongkan `email_confirmed_at`, lihat `clearEmailConfirmation`), `suspended`, `revokedHolder`, `admin`, dan `guest` (klien anon).
3. Untuk **fungsi SQL dan tabel** gunakan klien Supabase tiap peran (Vitest DB, seperti `admin.test.ts`). Untuk **route handler** gunakan `request` Playwright dengan sesi masuk (atau `fetch` dengan cookie sesi dari `signInWithPassword` di Node). Untuk **Server Action** panggil fungsi SQL di baliknya sebagai peran tersebut (aksi hanyalah pembungkus); cukup uji bahwa aksi memanggil `requireUser` bila perlu (tinjau kode).
4. IDOR: untuk tiap id di URL atau argumen (`project_id`, `request_id`, `file_id`, `access_id`, `appeal_id`, `report_id`, `notification`), uji pemakaian id milik orang lain. Contoh wajib: unduh `files/[fileId]/download` dengan `id` proyek A tapi `fileId` proyek B (route memfilter `.eq("project_id", id)`: pastikan tetap ditolak); `requests/[id]/agreement` dengan permintaan orang lain; `api/admin/break-glass/[access]` oleh admin lain atau setelah kedaluwarsa (5 menit, satu berkas); `account/export` hanya data sendiri.
5. Orang ditangguhkan: harus ditolak menulis (trigger DB), ditolak di route handler (`getCurrentUser()?.suspended`), dan tidak bisa masuk.
6. Akses dicabut: harus ditolak mengunduh dan membuka workspace, dan tidak bisa mengambil akses lagi sampai diizinkan (hint `access_revoked`).
7. **Batas laju**: uji `check_rate_limit` langsung (jendela, batas, kunci berbeda) dan jalur pemakainya (login 20/15 mnt per alamat dan 8/15 mnt per email, daftar 5/jam, kirim ulang verifikasi 3/jam, unggah 30/jam, laporan 5/jam alamat dan 10/hari akun). Catatan: server uji menaikkan batas dengan `RATE_LIMIT_MULTIPLIER`; untuk uji e2e batas laju matikan pengali (jalankan server uji tanpa variabel itu pada port lain) atau uji lewat DB.
8. Endpoint token/cron: `/api/cron/*` harus 401 tanpa `Authorization: Bearer <CRON_SECRET>` (sudah dites di `ops.spec.ts`); `/api/dev/email-preview` harus 404 di PRODUCTION (belum dites di PRODUCTION; tambahkan tes unit dengan `isProduction` atau jalankan build produksi dengan `APP_ENV=PRODUCTION` dan konfigurasi aman palsu... perhatikan konfigurasi produksi menolak URL lokal, jadi cukup tes unit atas fungsi route dengan `vi.stubEnv`).
9. Tinjauan manual yang wajib ditulis di QA report: (a) semua pemakaian `createAdminClient()` (grep) dan bukti pemeriksaan otorisasi sebelum tiap pemakaian; (b) semua fungsi SQL `SECURITY DEFINER` memanggil `set search_path`; (c) tabel tanpa kebijakan RLS memang disengaja (announcements, email_outbox, dll.); (d) bucket Storage `project-files` dan `extracted-text` privat dan tak ada kebijakan baca anonim; (e) view publik (`public_project_teaser`, `public_teaser_items`, `public_project_lineage`) tidak membocorkan kolom sensitif. **Catatan sudah diketahui:** `public_project_teaser` masih memuat kolom `advisor_name` dan `no_advisor` warisan; periksa apakah masih terisi/terekspos dan, bila ya, hapus dari view lewat migrasi baru (peran dosen sudah dihapus, CLAUDE.md 15.1).
10. Pindai header dengan alat eksternal terhadap **staging** (securityheaders.com atau sejenisnya) dan catat nilainya. HSTS hanya muncul di build produksi **bila build melihat `APP_ENV`≠LOCAL** (`next.config.ts` menentukan saat build).
11. Gunakan skill `security-review` (Claude Code) pada branch untuk tinjauan tambahan, dan jalankan `pnpm audit --audit-level=high`.

**Selesai bila:** matriks otorisasi berjalan hijau di CI (tes DB), tidak ada rute/aksi tanpa baris di matriks, temuan tercatat.

### 6.3 Item 1: Tes end-to-end

**Tugas (dari prompt):** semua alur R4 dan R5 dan alur admin R6, **dalam bahasa Indonesia**, plus subset smoke dalam Inggris.

**Keadaan:** spec yang ada hampir semuanya berjalan dalam **bahasa Inggris** (`/en/...`) karena penulisnya mencari label Inggris. Itu berarti **alur Indonesia belum diuji ujung ke ujung** kecuali `id-smoke.spec.ts` (kecil) dan audit tumpang tindih.

**Cara mengerjakan:**

1. Buat pola helper bersama `tests/e2e/helpers.ts`: `signUp(page, name, email, locale)` (tunggu 3,2 dtk untuk bot check), `signIn`, `asAdmin`, `makeProject(...)` lewat service role untuk mempercepat. Saat ini `signUp` terduplikasi di `core-flow.spec.ts` dan `r4-flows.spec.ts`; satukan.
2. Tulis ulang atau gandakan alur kunci dengan label Indonesia (ambil dari `messages/id.json`, **jangan** menebak; gunakan kunci yang sama dengan komponen). Alur yang harus ada, minimal:
   - Daftar, layar pertama `/mulai`, bagikan proyek (5 langkah `/bagikan`: info, berkas, tinjau draf AI, tim dan akses, pratinjau dan terbit), jalur "Isi manual tanpa AI".
   - Terbit, tarik, terbitkan ulang, arsip.
   - Mode `open`: ambil akses; mode `by_request`: ajukan, putuskan, terima perjanjian, buka berkas; mode `paused`; kuota penuh dan "Beri tahu saya".
   - Permintaan: kirim, tanya, balas, setujui, tolak, tarik, kedaluwarsa (lewat `expire_requests` atau mengubah `expires_at` di DB).
   - Co-owner: undang, terima/tolak; transfer kepemilikan.
   - Cabut akses dengan alasan.
   - Laporan: tamu mengirim dari menu proyek, kode referensi, `/laporan-saya`, penahanan otomatis (tiga pelapor berbeda), pemberitahuan netral untuk pengunjung, keputusan dan banding oleh pemilik.
   - Halaman legal, persetujuan ulang kebijakan versi baru (`/kebijakan/setujui`), ekspor data akun, jadwal dan batal penghapusan akun.
   - Admin (dalam bahasa Indonesia): moderasi laporan, tahan/sembunyikan/pulihkan, banding, pengumuman, kebijakan, pengguna (tangguhkan, paksa keluar, kirim ulang verifikasi), pengaturan, break glass, uji coba, audit. Spec admin saat ini dijalankan dalam Inggris; tambahkan putaran Indonesia (atau parameterisasi spec dengan dua lokal).
   - Email: pemicu notifikasi lalu `dispatchEmails` ke SMTP palsu (sudah ada helper `tests/helpers/smtp-sink.ts`); verifikasi bahasa email mengikuti profil.
3. Tes **tidak boleh bergantung pada data sisa**. Setiap spec harus membuat datanya sendiri dengan akhiran unik (`Date.now()`) dan membersihkan, atau memakai prefiks yang dibersihkan sebelum jalan. Perbaiki ketergantungan `admin.spec` pada jumlah sesi uji coba (bagian 3.4 butir 2).
4. Subset Inggris: beranda, jelajah, halaman proyek, login/daftar, satu alur izin akses, satu laporan. Itu sudah sebagian ada.
5. Jalankan seluruh set terhadap **build produksi** juga (bagian 3.5) untuk mengurangi kegagalan karena kompilasi dev.
6. CI hanya menjalankan overlap audit untuk e2e. Putuskan (dan dokumentasikan) apakah e2e penuh masuk CI; saran: tambah job `e2e` terpisah (lama) yang berjalan di `release/**` dan sebelum merge.

**Selesai bila:** semua alur di atas hijau dalam bahasa Indonesia, subset Inggris hijau, tidak ada ketergantungan data sisa, dan dijalankan dua kali berturut-turut tanpa pembersihan manual.

### 6.4 Item 2: Audit tumpang tindih dan tangkapan layar visual

**Yang ada:** `tests/e2e/overlap.spec.ts` memeriksa (a) pusat tiap elemen interaktif terlihat benar-benar mengenai elemen itu, (b) tidak ada overflow horizontal, (c) teks terpotong ditandai, (d) kartu mengambang hero tidak memotong h1 atau CTA, untuk rute kunci di 6 viewport: 360x740, 390x844, 768x1024, 1024x768, 1280x800, 1536x864. Rute admin diuji dalam bahasa Indonesia (teks lebih panjang).

**Tugas:**

1. Pastikan **setiap rute kunci** ada di daftar (bandingkan dengan inventaris 6.5; yang belum: `/kebijakan/setujui`, `/laporan-saya`, `/akun/privasi`, `/mulai`, `/proyek/[slug]/keputusan`, halaman hold netral, dll. Periksa dan tambahkan).
2. Jalankan dua bahasa untuk semua rute publik dan alur pengguna (bahasa Inggris sering lebih pendek, Indonesia lebih panjang: yang memicu pemotongan adalah Indonesia).
3. **Tangkapan layar visual**: skrip `pnpm shots` ada (`scripts/screenshots.ts`, `screenshots-design.ts`). Hasilkan gambar untuk semua rute kunci di 6 viewport, tinjau dengan mata (atau Anda dapat membuka gambar), dan simpan yang penting sebagai bukti di `docs/design/` atau lampiran QA. Perbandingan piksel otomatis belum ada; kalau ingin regresi visual, tambahkan `expect(page).toHaveScreenshot()` dengan toleransi (butuh baseline yang disepakati).
4. Perbaiki **semua** temuan (kriteria R8: "Fix all findings"). Aturan lapisan: skala z-index token saja (`base 0, raised 10, sticky 20, nav 30, dropdown 40, drawer 50, overlay 60, modal 70, toast 80, system-banner 90`), tidak ada z-index ad hoc (ada tes unit `layering.test.ts`).
5. Uji gerak: `prefers-reduced-motion: reduce` mematikan melayang, drift, parallax, count-up, stagger, word reveal. Tidak ada tes otomatis khusus; tambahkan satu spec dengan `page.emulateMedia({ reducedMotion: "reduce" })` yang memeriksa `animation-name: none` pada elemen kunci, dan CLS < 0,05 (lihat item 4).

### 6.5 Inventaris rute dan aksi (untuk item 1, 2, 5)

**Halaman** (semua di bawah `[locale]`; Indonesia tanpa prefiks, Inggris `/en`):

| Rute | Siapa | Catatan |
|---|---|---|
| `/`, `/explore`, `/projects/[slug]`, `/terms`, `/privacy`, `/pedoman`, `/atribusi`, `/kontak` | semua | `/projects/[slug]` menampilkan pemberitahuan netral bila proyek ditahan |
| `/login`, `/signup` | tamu (yang sudah masuk dialihkan ke `/dasbor`) | cek bot di daftar |
| `/mulai` | masuk | layar pertama, bukan peran |
| `/dasbor` | masuk | "Proyek saya", "Proyek yang saya lanjutkan" |
| `/bagikan`, `/bagikan/[id]/[step]` | masuk, email terverifikasi untuk membagikan | wizard 5 langkah |
| `/proyek/[slug]/pengaturan` | pemilik | akses, tim, permintaan masuk, transfer |
| `/proyek/[slug]/keputusan` | pemilik | keputusan moderasi dan banding |
| `/projects/[slug]/request` | masuk, bukan pemilik | mengajukan permintaan |
| `/projects/[slug]/workspace` | pemilik dan pemegang akses | berkas pribadi |
| `/requests/[id]` | pemilik proyek dan tim peminta | putuskan, perjanjian, utas |
| `/laporan-saya`, `/akun/privasi`, `/kebijakan/setujui`, `/suspended` | masuk | |
| `/admin/*` (14 halaman) | hanya admin; selain itu **404** | proxy dan RLS |

**Route handler:**

| Rute | Auth | Catatan |
|---|---|---|
| `POST /api/projects/[id]/files` | pemilik, tidak ditangguhkan, 30/jam | magic bytes, ZIP, secret scan, hook scan |
| `GET /api/projects/[id]/files/[fileId]/download` | RLS lewat klien pengguna | URL bertanda tangan 60 dtk, `download` |
| `POST /api/projects/[id]/synthesize` | pemilik + persetujuan tim | batas harian orang/proyek/global |
| `GET /api/requests/[id]/agreement` | pihak terkait | PDF perjanjian |
| `GET /api/account/export` | diri sendiri | JSON |
| `GET /api/admin/audit/export`, `/trials/export`, `/search`, `/break-glass/[access]` | admin | break glass 5 menit |
| `GET\|POST /api/cron/[job]` | bearer `CRON_SECRET` | `emails`, `daily` |
| `GET /api/health` | publik | 200/503 |
| `GET /api/dev/email-preview` | bukan produksi | 404 di produksi |

**Server Actions pengguna** (`src/app/actions/*.ts`): `takeAccess`, `revokeAccess`; `requestAccountDeletion`, `cancelAccountDeletion`, `saveEmailPreferences`, `acceptPoliciesAndContinue`; `login`, `signup`, `resendVerification`, `signOut`; `watchProject`, `postRequestMessage`, `setItemProgress`; `appealDecision`; `setFillMode`, `autosaveBasics`, `saveAccessSettings`, `unpublishProject`, `republishProject`, `archiveProject`, `proposeOwnership`, `respondOwnership`, `cancelOwnership`; `saveBasics`, `inviteCoOwner`, `respondToInvite`, `acceptPolicies`, `removeTeamMember`, `confirmTeamConsent`, `deleteFile`, `publishProject`, `applyDraftSummary`; `submitReport`; `submitRequest`, `decideRequest`, `askQuestion`, `acceptAgreement`, `withdrawRequest`, `markNotificationsRead`.

**Server Actions admin** (`admin/actions.ts`): `reauthenticate`, `setProjectModeration`, `handleReport`, `resolveAppeal`, `bulkDismissSpam`, `saveAnnouncement`, `endAnnouncement`, `publishPolicy`, `forceSignOut`, `resendUserVerification`, `suspendUser`, `restoreUser`, `openBreakGlass`, `addNote`, `cancelRun`, `retryRun`, `updateSetting`, `purgeDemoData`, `saveTrial`. Tindakan berisiko (tangguhkan, hapus, break glass, pengaturan, purge, kebijakan) butuh autentikasi ulang dalam 15 menit dan alasan ≥ 15 karakter.

### 6.6 Item 3: Aksesibilitas

**Yang ada:** `tests/e2e/a11y.spec.ts` menjalankan axe (`@axe-core/playwright`) pada halaman admin (900/1280/1440 px), dialog, formulir laporan publik, layar pertama, dasbor, kartu akses, dan halaman kebijakan: tanpa isu serius (hasil 22 November 2026: 5 dari 5 lolos).

**Tugas:**

1. Perluas axe ke **setiap halaman** di inventaris 6.5 dalam dua bahasa, pada viewport telepon dan desktop, termasuk keadaan (dialog terbuka, galat formulir, toast). Aturan: nol pelanggaran `serious` dan `critical`; catat `moderate` dan `minor`.
2. **Jalan-jalan hanya dengan keyboard** (dokumentasikan hasilnya, skenario tertulis di `docs/qa-report.md`): wizard bagikan penuh; alur akses (ambil akses dan ajukan permintaan); alur laporan (menu proyek, dialog, kirim, fokus kembali ke pemicu); dialog (jebakan fokus, Esc, fokus kembali); menu bahasa. Otomatiskan sebagian dengan Playwright (`page.keyboard.press("Tab")` dan memeriksa urutan fokus dan cincin fokus terlihat).
3. **Label pembaca layar dalam bahasa Indonesia**: periksa `aria-label`, `aria-labelledby`, `lang`, nama tombol ikon, status `aria-live` toast, `aria-current="step"` di stepper, nama tabel (caption) dan kontras. Gunakan NVDA (Windows, gratis) atau VoiceOver untuk **satu** putaran manual pada alur laporan dan wizard; hasil manual **tidak bisa** diotomatiskan, tulis jujur siapa yang melakukannya dan kapan.
4. **Lighthouse aksesibilitas ≥ 95** pada Beranda, Jelajah, halaman proyek, wizard, login. Jalankan dari Chrome DevTools atau `npx lighthouse` terhadap build produksi (bagian 3.5) dan rekam skor.
5. Target sentuh ≥ 44 px, kontras WCAG AA, `prefers-reduced-motion`: sudah menjadi aturan desain (CLAUDE.md 9 dan 14.8); verifikasi dengan audit.
6. Catatan khusus: honeypot cek bot (`BotFields`) memakai `aria-hidden` dan `tabIndex={-1}`; pastikan tidak masuk urutan tab pembaca layar. Spesifikasi (CLAUDE.md 9) melarang emoji sebagai ikon; semua ikon Lucide.

### 6.7 Item 4: Performa

**Yang ada:** `docs/performance.md` dan `pnpm perf` (`scripts/perf-check.ts`), hasil lama dari fase sebelumnya. **Belum ada angka Lighthouse** dan tidak ada profil ponsel menengah ter-throttle.

**Tugas:**

1. Gunakan **build produksi** (bukan dev) terhadap data realistis (stack lokal dengan seed demo atau staging).
2. Lighthouse (mobile preset, throttling bawaan 4G lambat dan CPU 4x) untuk Beranda, Jelajah, halaman proyek, wizard (langkah berkas dan tinjau). Rekam LCP, CLS, TBT/INP, ukuran JS. Target spesifikasi: **LCP < 2,5 detik pada ponsel menengah** untuk Beranda dan Jelajah, **CLS < 0,05**, anggaran JS didokumentasikan.
3. Tempat yang patut dicurigai: `framer-motion` (14.x, besar) dan jumlah klien-komponen di beranda; font (`next/font/google`, tiga keluarga: periksa subset dan preload); gambar OG tidak mempengaruhi LCP; `Dasbor` dan `Jelajah` memanggil banyak query; `listTeasers` tidak memakai paginasi (periksa saat data banyak).
4. Perbaiki regresi; ulangi pengukuran; simpan angka sebelum dan sesudah di `docs/performance.md` dan ringkasannya di QA report. **Jangan menulis angka yang tidak diukur.**
5. Catatan CLS: animasi hanya boleh `transform` dan `opacity`; pengumuman admin tampil di dalam alur (mendorong konten), bukan overlay, sehingga mempengaruhi CLS bila muncul setelah render: ukur dengan satu pengumuman aktif.

### 6.8 Item 6: Uji beban

**Tugas (prompt):** simulasikan puncak realistis (misalnya **200 browser bersamaan di Jelajah dan 20 unggahan**) di **staging**; rekam hasil dan bottleneck.

**Prasyarat yang bukan kode:** staging harus ada (bagian 7.1 tahap A). Jangan uji beban ke produksi atau ke proyek Supabase milik pemilik yang berisi data nyata.

**Cara mengerjakan:**

1. Alat: k6 (disarankan, skrip JS, mudah dijalankan dari mesin lokal atau CI) atau Artillery. Simpan skrip di `tests/load/` (belum ada) dan tambahkan dokumen cara pakai.
2. Skenario: (a) 200 pengguna virtual membuka `/explore` dan beberapa `/projects/[slug]` selama 5 menit (tanpa login); (b) 20 unggahan bersamaan ke `POST /api/projects/[id]/files` oleh 20 akun pemilik yang dibuat khusus (PDF kecil dan sedang), dengan batas laju unggah (30/jam) dihitung; (c) beberapa login dan pendaftaran bersamaan (perhatikan batas laju: uji di staging dengan batas normal untuk melihat penolakan 429 yang benar, dan dengan alamat berbeda).
3. Metrik: p50/p95/p99 latensi, tingkat galat, throughput, penggunaan koneksi DB (dasbor Supabase), waktu respons `/api/health`, CPU/memori fungsi di Vercel, 429 yang muncul. Cari bottleneck: query `public_project_teaser` (view dengan subquery hitung per baris), koneksi Postgres (gunakan pooler Supavisor untuk serverless), `createAdminClient()` per permintaan, ukuran bundel.
4. Catat hasil, bottleneck, dan tindakan di QA report. Jangan menjanjikan kapasitas yang tidak diukur. Fungsi `Server Action bodySizeLimit` 30 MB dan `MAX_UPLOAD_MB` 25 MB memengaruhi uji unggah.

### 6.9 Item 7: Tinjauan isi (konten)

**Tugas:** baca **setiap string Indonesia dalam konteks**, perbaiki frasa janggal, cocokkan dengan glosarium, pastikan tidak ada placeholder atau sisa Inggris. Hasil masuk `docs/qa-report.md`.

**Sudah ada:** `docs/copy-review.md` (ulasan mandiri R2, 47 koreksi, **belum dibaca penutur asli**), teks admin R6 (draf AI), 12 email R7 (draf AI), teks legal (draf AI, **belum ditinjau pihak berwenang**).

**Cara mengerjakan:**

1. Minta **penutur asli** (mahasiswa Unhas atau dosen bahasa) membaca string kunci; Anda tidak bisa menjadi satu-satunya peninjau. Tulis nama peninjau dan tanggal di QA report. Jika tidak ada penutur asli, tulis jujur bahwa tinjauan hanya mandiri.
2. Urutan baca: (1) 30 string terpenting di `docs/copy-review.md`; (2) alur pengguna dalam urutan nyata dengan aplikasi terbuka (daftar, bagikan, terbit, akses, laporan, banding); (3) email (`/api/dev/email-preview`, dua bahasa); (4) halaman admin; (5) pesan galat (`errors.*`, `errors.hints.*`); (6) legal.
3. Glosarium wajib (CLAUDE.md 14.7): Pemilik proyek, Tim penerus, Ringkasan publik, Bagikan proyek, Jelajahi, Dasbor, Tinjau draf AI, Bukti cocok/tidak ditemukan, Perjanjian atribusi, Ajukan untuk melanjutkan, Lanjutkan proyek ini, Ruang proyek, Jejak estafet, Laporkan, Tahan/Sembunyikan/Hapus/Pulihkan, Banding, Terbitkan/Tarik/Arsipkan, Data contoh. Nama diri tetap: ESTAFET, STACK, PDF, Markdown, ZIP. Tulis skrip kecil yang mencari istilah terlarang (misalnya "creator", "adopter", "dosen pembimbing", "advisor") di `messages/id.json` dan kegagalan bila ada (peran dosen sudah dihapus; kata itu tidak boleh ada kecuali dalam konteks penjelasan yang disengaja).
4. Cari sisa Inggris dengan heuristik (kata umum seperti "the", "and", "Save") di `messages/id.json`. `pnpm i18n:check` hanya menjamin paritas kunci dan tak ada teks keras di komponen, **bukan** kualitas terjemahan.
5. Placeholder: cari `[PLACEHOLDER`, `TODO`, `lorem`, `TEAM TO CONFIRM` di teks yang tampil ke pengguna.
6. Halaman legal masih bertanda "Draf, belum ditinjau pihak berwenang" dan `noindex`. **Itu benar sampai pemilik mengonfirmasi** (tahap R9 A). Jangan dihapus di R8.

### 6.10 Laporan QA: `docs/qa-report.md`

Struktur: ringkasan eksekutif (go/no-go berdasarkan temuan); metode dan lingkungan (versi, tanggal, stack lokal atau staging, apa yang **tidak** diuji); tabel hasil per item R8 (1 sampai 7) dengan angka nyata (jumlah tes, skor Lighthouse, p95); **daftar isu** (ID, tingkat, status, pemilik, tanggal); keterbatasan (apa yang bukan bagian pengujian); lampiran (bukti: tangkapan layar, log tes). Sesuai aturan: **tidak ada metrik yang tidak diukur**, sampel kecil diberi label.

### 6.11 Hal yang kemungkinan besar Anda temukan (hipotesis, belum diverifikasi)

Ini daftar curiga yang saya sadari saat menulis R7, **bukan temuan terkonfirmasi**:

- Hidrasi: ada satu kasus (`CountUp`) yang saya perbaiki di R7; jalankan `next dev` dan buka konsol di tiap halaman untuk mencari peringatan hidrasi lain.
- Peringatan konsol Next: "Detected `scroll-behavior: smooth` on `<html>`" (tambahkan `data-scroll-behavior="smooth"` bila ingin menghilangkan).
- `Functions are not valid as a React child` muncul sekali di log dev (komponen yang mengembalikan fungsi; telusuri).
- `style-src 'unsafe-inline'` di CSP (diketahui, didokumentasikan).
- Pertumbuhan `rate_limit_hits`: dibersihkan oleh `check_rate_limit` (> 1 hari) dan `housekeeping()` (> 2 hari).
- `request_expiring`/`request_expired` notifikasi tidak diubah menjadi email (hanya 12 jenis; lihat `docs/email.md`).
- Pelaporan CSP (`report-to`) belum ada.
- Pemeriksaan kata sandi bocor (haveibeenpwned) belum ada.
- Sentry belum dipasang; hanya log JSON + `onRequestError`.

### 6.12 CI: hal yang harus dibereskan saat R8

`.github/workflows/ci.yml` **belum pernah berjalan di GitHub**; ia mencerminkan perintah yang lolos secara lokal. Saat remote dihubungkan: dorong branch (setelah pemilik izinkan), perbaiki kegagalan CI pertama, dan jangan menganggap CI hijau sebelum benar-benar hijau. Job yang ada: `check` (lint, format, typecheck, i18n, unit), `audit` (`pnpm audit --audit-level=high`), `secrets` (gitleaks, riwayat penuh), `build` (build produksi dengan nilai palsu + tes proses keluar kode 1 pada konfigurasi tidak aman), `database` (stack Supabase lokal + `pnpm test:db` + dry-run migrasi), `overlap-audit` (Playwright, memblokir merge). Catatan: action gitleaks mungkin butuh lisensi untuk repo organisasi (repo pribadi gratis).

---

## 7. FASE R9: peluncuran bertahap

### 7.1 Aturan emas

> Phase R9: staged launch. **Do not go public until I explicitly confirm each stage.**

- Setiap tahap **diakhiri dengan checklist go/no-go** yang **dijawab pemilik**. Anda menyiapkan checklist; pemilik yang menjawab.
- **Jangan pernah mengklaim metrik yang tidak Anda ukur.** Beri label sampel kecil. (Contoh: angka survei 10 mahasiswa di `docs/survey.md` diberi label "indikatif", dan "paham dalam 30 menit" adalah **target, belum hasil**.)
- Jangan menyalakan apa pun yang berdampak ke pengguna nyata (pendaftaran terbuka, penghapusan banner Draf, data nyata) tanpa "ya" tertulis dari pemilik untuk tahap itu.
- Buat branch `release/r9-launch`, tapi banyak pekerjaan R9 adalah **operasi** (konfigurasi, DNS, dashboard), bukan kode. Catat setiap operasi dengan tanggal dan pelaku di `docs/operations-checklist.md`.

### 7.2 Tahap A: persetujuan staging

**Prasyarat teknis (harus Anda buat; belum ada):**

1. **Proyek Supabase staging** baru (wilayah Singapura). Jalankan berkas `supabase/cloud-sql/01..11_*.sql` **satu per satu** di SQL Editor (README di folder itu). Jangan jalankan `99_OPTIONAL_demo_data.sql` di staging. Promosikan admin pertama: `select public.promote_admin('email@...');`.
2. **Supabase Auth**: **Confirm email ON** (di lokal otomatis terkonfirmasi, di hosted harus dinyalakan agar gerbang "terverifikasi" bermakna), URL situs dan redirect, SMTP kustom, tempel `docs/email-templates/confirm-signup.html`.
3. **Proyek Vercel** untuk staging dengan variabel dari `docs/environments.md`, `APP_ENV=STAGING`, `CRON_SECRET` acak 32+ karakter. Jalankan `pnpm config:check --file <env staging>`. Deploy. Pastikan `/api/health` menjawab `{"status":"ok","database":"up"}`. Ingat: Vercel mengevaluasi `next.config.ts` saat **build**, jadi `APP_ENV` harus tersedia di build untuk header HSTS.
4. **Penyedia email**: buat akun (Resend atau SMTP), verifikasi domain pengirim, publikasikan SPF, DKIM, DMARC (`docs/email.md`), kirim email uji ke Gmail dan baca "Show original" (SPF/DKIM/DMARC harus PASS).
5. **Jadwal**: Vercel Cron (`vercel.json`; job sub-harian butuh paket berbayar) atau `pg_cron` (SQL di `docs/runbook.md`). Uji dengan `curl` + secret.
6. **Turnstile**: buat situs di Cloudflare, isi `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY`, uji daftar dan laporan tamu. **Jalur ini belum pernah diuji ke Cloudflare.** Periksa bahwa CSP (`script-src` dengan `strict-dynamic`, `frame-src`, `connect-src` untuk `challenges.cloudflare.com`) tidak memblokir widget; perhatikan skrip widget dimuat lewat `next/script`.
7. **Backup**: aktifkan di dashboard Supabase (paket menentukan retensi; pilih dan catat), jadwalkan salinan berkas Storage (backup database **tidak** mencakup berkas), dan `pg_dump` mingguan terenkripsi di luar akun hosting. **Latihan restore di staging** (langkah di `docs/runbook.md`). `pnpm restore:drill` baru dibuktikan di lokal.
8. **Monitoring**: monitor uptime ke `/api/health` tiap menit, drain log, `ALERT_WEBHOOK_URL`, aturan "lonjakan error". Putuskan apakah memasang Sentry (SDK `@sentry/nextjs`; butuh proyek Sentry).
9. **Pemindaian header** eksternal terhadap staging; catat nilai. Uji batas laju manual (enam login salah, enam pendaftaran).

Lalu jalankan **seluruh daftar QA** (hasil R8) di staging, termasuk beban (6.8).

**Hal yang hanya pemilik yang bisa menyatakan (jangan diasumsikan):**

- Teks legal sudah ditinjau pihak berwenang kampus. **Hapus banner "Draf" hanya setelah pemilik berkata demikian.** Lokasi teknis: kunci `legal.*.draftTitle`/`draftText` (cari `draftTitle` di `messages/*.json`), komponen `src/components/features/LegalDocument.tsx`, dan `legalMetadata()` di berkas yang sama yang memasang `robots: { index: false }` pada halaman legal (hapus noindex di sini juga bila pemilik setuju halaman legal diindeks, dan tambahkan ke `src/app/sitemap.ts`). Jika versi kebijakan berubah, terbitkan versi baru lewat `/admin/policies` (memaksa persetujuan ulang), jangan edit diam-diam.
- Pertanyaan **pendaftaran PSE Lingkup Privat** (Permen Kominfo 5/2020, lewat OSS) dan **identitas pengendali data** sudah selesai. Teks legal membawa penanda sampai itu ada. Ini bukan nasihat hukum dan harus dikonfirmasi ke bagian hukum kampus.
- Pilihan paket backup, retensi data (`docs/privacy-data-map.md`, pertanyaan terbuka), kontak keamanan dan tabel kontak runbook.

**Checklist go/no-go Tahap A (untuk dijawab pemilik)**, sediakan di `docs/launch-checklist.md` (buat): staging berjalan dan sehat; semua item `docs/operations-checklist.md` bagian staging tercentang dengan tanggal; QA report tanpa isu Tinggi; legal ditinjau kampus (ya/tidak); PSE dan pengendali data (selesai/belum); backup dan restore diuji di staging (tanggal); monitor dan alert terpasang (tanggal); keputusan Sentry; pemilik berkata "lanjut ke beta".

### 7.3 Tahap B: beta tertutup

Tujuan: **20 sampai 50 pengguna**.

**Teknis yang perlu dibangun atau diputuskan:**

1. **Proyek Supabase produksi** terpisah dan Vercel produksi (`APP_ENV=PRODUCTION`): boot menolak konfigurasi tidak aman (sudah diuji lokal pada build produksi). Aktifkan LLM sungguhan (`LLM_PROVIDER=gemini|anthropic`, `LLM_MODEL`, kunci) dan uji **sekali dengan kunci nyata** (jalur live belum pernah diuji dengan kunci sungguhan, termasuk prompt bahasa Indonesia). Tetapkan `SYNTHESIS_GLOBAL_DAILY_CAP` sesuai anggaran.
2. **Membatasi pendaftaran** sesuai keputusan pemilik ("daftar undangan atau domain yang diizinkan"): 
   - Domain: pengaturan `allowed_email_domains` sudah ada di `/admin/settings` (ingat amandemen 15.2: bawaan kosong = semua email; membatasi untuk beta adalah keputusan baru pemilik, bukan bawaan).
   - **Daftar undangan: belum ada.** Bila dipilih, rancang: tabel `beta_invites(email_hash, used_at)` + cek di `signup` (server) + fungsi admin untuk menambah undangan dengan audit; atau gunakan kode undangan. Ini fitur baru: bangun lewat migrasi + tes DB + UI admin + pesan id/en + dokumentasi, sebagaimana fase lain.
   - Nyalakan `registrations_open` lewat `/admin/settings` (butuh autentikasi ulang dan alasan; tercatat di audit).
3. **Konten nyata hanya lewat pemilik nyata yang setuju.** Tidak ada data demo di produksi (`SEED_DEMO` ditolak; jangan jalankan `99_OPTIONAL_demo_data.sql`). Periksa bahwa tidak ada baris `is_demo = true` di produksi (query dan masukkan ke checklist).
4. **Tombol umpan balik terlihat + survei singkat dalam aplikasi: belum ada.** Rancangan minimal yang konsisten dengan prinsip privasi: komponen `FeedbackButton` di footer/menu (dialog Radix) yang mengirim ke tabel `feedback(id, profile_id null, page, kind, message, created_at)` lewat fungsi SQL dengan batas laju; halaman admin `/admin/feedback` (ikuti pola admin: tampilan tabel, filter, audit untuk tindakan); survei singkat 3 pertanyaan (mis. "bisa menjelaskan proyek ini dalam 30 menit? ya/tidak/sebagian") disimpan tanpa identitas bila tamu. Semua teks id/en lewat `messages/*.json`. **Pertanyaan survei adalah data penelitian: jangan mengubahnya diam-diam di tengah beta**, catat versi pertanyaan. Ada `SurveyDots.tsx` dan `docs/survey.md` tetapi itu survei awal statis di beranda, bukan fitur umpan balik.
5. **Pantau harian**: kesalahan (log `request.error`, alert), laporan dan penahanan (`/admin`), pengiriman email (`email_outbox`: `status='failed'`, `pending` yang menumpuk), biaya AI (hitung `synthesis_runs` `mode='live'` per hari; belum ada penghitung biaya rupiah/dolar: bila perlu, hitung dari ukuran masukan atau dasbor penyedia), tugas terjadwal (`cron.done`), uptime.
6. **Ringkasan harian di `docs/beta-log.md`** (buat). Format per hari: tanggal; pengguna baru dan total; proyek dibagikan/diterbitkan; permintaan dan akses; laporan baru/diputuskan, penahanan; email terkirim/gagal; proses AI (jumlah, gagal, biaya); error teratas; uptime; insiden; keputusan. **Hanya angka yang diukur**; tulis "tidak diukur" bila tidak ada.

**Checklist go/no-go Tahap B → C (untuk dijawab pemilik):** minimal 2 minggu tanpa insiden Tinggi (angka pemilik); tidak ada kebocoran data; laporan ditangani dalam target; email sampai; biaya AI dalam anggaran; top isu diperbaiki; rencana rollback siap; legal final; "ya, buka publik".

### 7.4 Tahap C: peluncuran publik

1. Buka pendaftaran (hapus pembatas beta bila ada keputusan pemilik; `registrations_open` tetap sebagai tuas darurat).
2. Terbitkan **pengumuman** lewat `/admin/announcements` (banner dalam alur, id/en).
3. Konfirmasi monitor uptime dan alert aktif, dan **rencana rollback siap**: deploy sebelumnya di Vercel, catatan rollback migrasi di `docs/migrations-rN.md` (migrasi hanya menambah, jadi kode lama jalan di skema baru), prosedur restore (`docs/runbook.md`).
4. Pastikan SEO: `APP_ENV=PRODUCTION` ⇒ `robots.txt` membuka halaman publik dan `sitemap.xml` memuat proyek (`is_demo=false`) dan tidak memuat proyek ditahan/disembunyikan; `noindex` hilang di produksi. Cek di Google Search Console bila pemilik mau.
5. `README.id.md`: **belum ada** (disyaratkan CLAUDE.md 14.2); tulis versi Indonesia README. README Inggris tetap utama dan memuat pengungkapan bantuan AI yang mutakhir.

### 7.5 Dua minggu pertama setelah peluncuran

- Setiap hari: periksa `/admin` (ikhtisar: laporan baru, penahanan dan yang lewat target, banding, proses gagal, permintaan macet).
- Mingguan: laporan jumlah pengguna, proyek, akses, laporan, dan **median waktu untuk memahami dari uji coba** (`/admin/trials`; **belum ada uji coba nyata yang direkam**: semua baris saat ini berlabel demo; protokol di `docs/trial-protocol.md`, minimal 5 sesi per kelompok sebelum halaman mau menarik kesimpulan; jangan mengarang angka).
- Perbaiki isu teratas; jaga tabel Status README dan `docs/ai-disclosure.md` tetap mutakhir.

### 7.6 Penjaga Final Day (sebelum pekerjaan kompetisi apa pun)

Dari `PROMPTS_RELEASE.md`: baca ringkasan handbook di `CLAUDE.md` bagian 2 dan 14.2, lalu pastikan: (1) pengalih bahasa Inggris bekerja dan **lingkungan demo** tersedia dengan data contoh dan mode mock; (2) README Inggris mencantumkan apa yang selesai dan direncanakan beserta pengungkapan bantuan AI; (3) commit bertag `final-day-start` ada (ada, `964d2e9`); (4) tugas Final Day yang dideklarasikan masih belum selesai dan dapat ditelusuri. Jika ada yang gagal, perbaiki atau laporkan. **Jangan menyajikan fitur rencana sebagai selesai.** Catatan: **daftar tugas Final Day belum pernah diberikan**; tanyakan ke pemilik.

Lingkungan demo untuk juri: `APP_ENV=DEMO`, `LLM_PROVIDER=mock`, `SEED_DEMO=true`, `noindex`, proyek Supabase tersendiri **berbeda dari staging dan produksi** (`docs/environments.md`).

---

## 8. Format laporan setiap fase (perjanjian kerja)

CLAUDE.md bagian 10 dan 14 menetapkan, dan pemilik memintanya di setiap fase ("Report using the working agreement"). Laporan Anda kepada pemilik (bahasa Indonesia, jelas, tidak panjang berlebihan) berisi:

1. **Status**: apa yang selesai, di branch mana, commit apa, apakah sudah digabung.
2. **Yang diverifikasi**: perintah yang benar-benar dijalankan dan hasil angkanya (tes unit/DB/e2e, lint, tipe, i18n, Lighthouse, dll.).
3. **Yang tidak diverifikasi atau belum dikerjakan**: jujur dan spesifik (mis. "belum diuji di hosted", "Turnstile belum diuji ke Cloudflare", "teks Indonesia belum dibaca penutur asli").
4. **Yang perlu dilakukan pemilik** (SQL yang harus dijalankan di Supabase, keputusan, konfirmasi).
5. **Pertanyaan**: tutup dengan satu pertanyaan jelas (mis. "Gabungkan ke `release/next` dan lanjut?").

Selain itu, setiap fase: perbarui tabel Status di `README.md`, `docs/ai-disclosure.md` (baris untuk fase), buat `docs/migrations-rN.md` bila ada migrasi, jalankan `node scripts/build-cloud-sql.mjs`, dan commit dengan pesan yang diakhiri atribusi yang diminta lingkungan (`Co-Authored-By: ...` bila dipakai).

Jika Anda menambah migrasi: **pemilik harus menjalankan berkas `supabase/cloud-sql/NN_*.sql` yang baru di SQL Editor proyek cloud-nya** (satu berkas, sendirian). Katakan itu dengan jelas di laporan. Migrasi yang sudah dijalankan pemilik di proyek cloud-nya: 01 sampai 10. **Migrasi 11 (`11_r7_production.sql`) belum dijalankan** di cloud-nya; aplikasi R7 butuh itu untuk email dan preferensi (halaman `/akun/privasi` membaca `profiles.email_notifications`; tanpa migrasi 11 pembacaan kolom itu gagal secara diam-diam dan bawaannya aktif, tetapi menyimpan preferensi gagal). Lihat juga bagian 10.

---

## 9. Daftar dokumen di repo

| Berkas | Isi |
|---|---|
| `README.md` | status per fitur (jujur), setup, demo, keterbatasan, pengungkapan AI |
| `CLAUDE.md` | memori proyek, aturan, bagian 13 (admin), 14 (edisi rilis), 15 (amandemen) |
| `PROMPTS_RELEASE.md` | prompt R0 sampai R9, Final Day guard |
| `docs/release-plan.md` | audit R0 dan keputusan D1 sampai D8 |
| `docs/architecture.md` | arsitektur |
| `docs/environments.md` | empat lingkungan, aturan boot, variabel, cara menyiapkan staging |
| `docs/runbook.md` | deploy, rollback, job terjadwal, monitoring, alert, backup dan restore, insiden |
| `docs/security.md` | kontrol keamanan dengan status uji, kelemahan yang diketahui |
| `docs/privacy-data-map.md` | data apa, di mana, siapa, berapa lama; hak pengguna; pertanyaan terbuka |
| `docs/operations-checklist.md` | daftar centang operasi dengan tanggal |
| `docs/email.md` | email produk dan akun, penyedia, SPF/DKIM/DMARC, template Supabase Auth |
| `docs/email-templates/confirm-signup.html` | template konfirmasi untuk Supabase Auth (dwibahasa) |
| `docs/migrations-r1.md`, `r4`, `r6`, `r7` | apa yang ditambah tiap rilis dan catatan membatalkan |
| `docs/copy-review.md` | ulasan teks Indonesia R2 |
| `docs/admin-guide.md` | cara memakai admin, kebijakan break glass |
| `docs/trial-protocol.md`, `docs/survey.md` | protokol uji coba orientasi dan survei awal |
| `docs/performance.md`, `docs/demo-script.md`, `docs/sql-queries.md`, `docs/database-setup.md` | pendukung |
| `docs/ai-disclosure.md` | pengungkapan bantuan AI (wajib mutakhir, aturan kompetisi) |
| **`docs/handover-r8-r9.md`** | dokumen ini |
| *(belum ada, harus dibuat di R8 dan R9)* `docs/qa-report.md`, `docs/launch-checklist.md`, `docs/beta-log.md`, `README.id.md`, `tests/load/` | |

---

## 10. Tindakan manual pemilik yang tertunda (cek dulu dengan pemilik)

1. **Menjalankan `supabase/cloud-sql/11_r7_production.sql`** di SQL Editor proyek Supabase cloud-nya (satu berkas, sendirian). Tanpa itu: email notifikasi tidak bisa menyimpan preferensi, antrean email dan job `emails`/`daily` (fungsi `enqueue_emails`, `housekeeping`) gagal. Catatan: job hanya berjalan bila dijadwalkan; di lokal tidak ada jadwal otomatis.
2. Membuat proyek Supabase dan Vercel untuk staging dan produksi (bagian 7.2 dan 7.3), akun penyedia email, akun Cloudflare Turnstile, akun monitor uptime.
3. Menjawab pertanyaan terbuka di bagian 2.4.
4. Menghubungkan remote GitHub agar CI pertama berjalan (jangan `git push` tanpa izin pemilik).

---

## 11. Daftar utang dan celah yang diketahui (lengkap, jangan disembunyikan)

Dari laporan fase sebelumnya dan README. Tiap butir adalah sesuatu yang **belum** dilakukan atau **belum diverifikasi**.

**Tidak pernah berjalan di lingkungan hosted:** semuanya. Termasuk alur Supabase cloud yang sesungguhnya (pemilik menjalankan SQL 01-10 di cloud, tetapi tidak ada tes terhadapnya), Vercel, jadwal cron/`pg_cron`, monitor uptime, webhook alert, restore dari backup hosted, email nyata, SPF/DKIM/DMARC.

**Belum diuji ke layanan eksternal:** Cloudflare Turnstile; penyedia AI live (Gemini/Anthropic) dengan kunci sungguhan (termasuk prompt Indonesia); penyedia email nyata; Supabase Auth SMTP kustom.

**Konten dan hukum:** teks Indonesia (antarmuka, admin, email) ditulis AI dan belum dibaca penutur asli; teks legal draf belum ditinjau pihak berwenang; identitas pengendali data dan pendaftaran PSE belum diputuskan; masa simpan data belum diputuskan.

**Keamanan:** tidak ada uji otorisasi sistematis (R8); tidak ada pemindai malware (hook ada, layanan tidak); tidak ada pelaporan pelanggaran CSP; `style-src 'unsafe-inline'`; tidak ada pemeriksaan kata sandi bocor; tidak ada pemindaian header eksternal; batas laju gagal-terbuka bila DB mati (sengaja); cookie sesi tidak `HttpOnly` (karena klien browser membacanya).

**Fitur yang disebut spesifikasi tapi belum dibangun:** log email di admin (outbox ada di DB tapi tidak ada layar); batas kuota per pengguna di admin; penghitung biaya AI (rupiah); filter tersimpan dan tombol kerapatan tabel di admin; daftar undangan beta; tombol umpan balik dan survei dalam aplikasi; `README.id.md`; `/styleguide`; PDF perjanjian untuk akses mode terbuka (hanya ada untuk akses dari permintaan); pengingat kedaluwarsa permintaan lewat email (notifikasi dalam aplikasi saja).

**Pengamatan teknis:** `public_project_teaser` masih membawa kolom `advisor_name` dan `no_advisor` warisan; tabel `advisor_consents` dan kolom dosen di `projects` sengaja dibiarkan (ditandai usang, CLAUDE.md 15.1; tidak boleh ada kode yang menulis ke sana); migrasi pembersihan boleh menghapusnya kelak bila pemilik setuju; `docs/migrations-r4.md` dan lainnya masih menyebut "advisor" dalam konteks sejarah.

**Pengujian:** admin spec hanya dalam bahasa Inggris; e2e berbahasa Indonesia untuk alur utama belum ada (R8); beberapa halaman (kebijakan admin, kolom target tinjauan laporan) belum dibuka tangan; e2e tidak ada di CI selain overlap audit; helper `signUp` terduplikasi.

**Operasional:** jadwal tidak ada sampai dibuat; tidak ada Sentry (hanya log JSON); `GitHub workflow` belum berjalan; tidak ada alat uji beban di repo.

---

## 12. Cara memulai hari pertama (resep)

1. `git checkout release/next && git pull --ff-only` (jika remote dipakai, dengan izin pemilik), `git log --oneline -15`. Pastikan R7 ter-merge (`Merge R7: production readiness`).
2. Baca bagian 2 dan 3 dokumen ini, `CLAUDE.md` 14 dan 15, `PROMPTS_RELEASE.md` bagian R8 dan R9.
3. `pnpm install`, `pnpm db:start`, siapkan `.env.localstack`, `pnpm db:reset`.
4. Jalankan `pnpm check`, `pnpm test:db`, lalu satu spec e2e (`pnpm exec playwright test tests/e2e/security.spec.ts`) untuk memastikan lingkungan Anda sehat sebelum mengubah apa pun. Catat angka dasar (unit 189, DB 168).
5. `git checkout -b release/r8-quality-gate`.
6. Buat `docs/qa-report.md` kosong dengan struktur 6.10 dan mulai dari 6.2 (otorisasi).
7. Setelah tiap item: commit kecil, jalankan tes terkait, perbarui QA report.
8. Setelah R8 selesai, lapor ke pemilik (bagian 8). **Tunggu** "gabungkan" sebelum merge, dan tunggu konfirmasi sebelum tahap R9 apa pun.

Jika sesuatu di dokumen ini bertentangan dengan keadaan kode, **kode menang**; perbarui dokumen ini dan beri tahu pemilik.
