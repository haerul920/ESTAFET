# Daftar Periksa Peluncuran Bertahap (R9 Staged Launch Checklist)

Dokumen ini memandu pemilik proyek dalam menjalankan **Fase R9 (Peluncuran Bertahap)**: dari **Tahap A (Staging)**, **Tahap B (Beta Tertutup)**, hingga keputusan **Go / No-Go Tahap C (Peluncuran Publik)**.

> **Aturan pengaman utama:** Tidak ada tahap yang boleh dilompati. Jangan beralih dari Tahap A ke Tahap B, atau dari Tahap B ke Tahap C, sebelum seluruh butir pada tahap sebelumnya tercentang dan pemilik proyek memberi konfirmasi tertulis.

---

## 0. Pemeriksaan Penjaga Tag `final-day-start`

Sebelum melakukan penggabungan (`merge`) atau perubahan cabang rilis:

- [ ] Pastikan tag `final-day-start` masih menunjuk ke komit awal (`964d2e9`):
  ```bash
  git rev-parse --short final-day-start
  # Harus mencetak: 964d2e9
  ```
- [ ] Pastikan cabang `main` tidak tersentuh selama pengujian R8, Tahap A, dan Tahap B:
  ```bash
  git diff final-day-start..main --stat
  # Harus kosong sampai Tahap C disetujui pemilik
  ```

---

## 1. Tahap A — Pemeriksaan Staging (`APP_ENV=STAGING`)

> **Peringatan tentang `.env.local`:** Berkas `.env.local` di mesin lokal saat ini mengarah ke proyek Supabase cloud `qbmhqeuwxwazirhixhgc.supabase.co`. Sebelum memakai proyek cloud tersebut untuk staging atau produksi, pemilik wajib memeriksa apakah di dalamnya sudah ada data nyata. Jika hanya berisi data demo awal, jalankan migrasi tambahan (`supabase/migrations/20261119000001_r2_foundation.sql` s.d. `20261125000001_r7_operations.sql`) secara berurutan — **jangan** menjalankan `supabase/setup-all.sql` pada database yang sudah berisi tabel.

### A.1 Variabel Lingkungan Staging
- [ ] `APP_ENV=STAGING`
- [ ] `APP_URL=https://<domain-staging-anda>` (HTTPS penuh, tanpa garis miring di akhir)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` mengarah ke proyek Supabase staging
- [ ] `SUPABASE_SERVICE_ROLE_KEY` terpasang sebagai rahasia server (tidak pernah diawali `NEXT_PUBLIC_`)
- [ ] `AI_PROVIDER=gemini` (atau `openai` / `anthropic`) dengan kunci API nyata (`GEMINI_API_KEY`, dll.)
- [ ] `EMAIL_PROVIDER=resend` dengan `RESEND_API_KEY` dan `EMAIL_FROM` pada domain yang sudah diverifikasi (SPF & DKIM aktif)
- [ ] `CRON_SECRET` berisi string acak minimal 32 karakter (`openssl rand -hex 32`)
- [ ] `REPORT_IP_SALT` berisi string acak minimal 16 karakter
- [ ] `ALERT_WEBHOOK_URL` (opsional) terpasang ke kanal notifikasi tim

### A.2 Database, Penyimpanan & Jadwal Cron
- [ ] Seluruh 10 berkas migrasi di `supabase/migrations/` sudah diterapkan
- [ ] Bucket penyimpanan `project-files` dan `extracted-text` berstatus `public = false`
- [ ] Akun admin pemilik dipromosikan melalui SQL Editor:
  ```sql
  select public.promote_admin('email-admin-anda@unhas.ac.id');
  ```
- [ ] Penjadwal memanggil `POST /api/cron/emails` setiap 10 menit dan `POST /api/cron/daily` sekali sehari dengan header `Authorization: Bearer <CRON_SECRET>`

### A.3 Uji Asap (Smoke Test) di Staging
- [ ] `GET /api/health` mengembalikan `200` dengan `{"status":"ok","database":"up"}`
- [ ] `GET /api/dev/email-preview` berfungsi di `STAGING` (dan mengembalikan `404` saat diuji dengan `APP_ENV=PRODUCTION`)
- [ ] Satu alur penuh bahasa Indonesia berhasil dijalankan di staging:
  - Daftar akun baru -> terima email konfirmasi nyata -> masuk -> `/mulai`
  - Bagikan proyek (`/bagikan`) -> unggah PDF/Markdown/Word/Excel/PowerPoint/JPG/PNG (coba juga berkas mendekati 50 MB) -> jalankan sintesis AI nyata (bukan mode tiruan) -> tinjau semua butir -> konfirmasi tim -> terbitkan
  - Akun kedua mengajukan permintaan melanjutkan (atau mengambil akses langsung pada mode terbuka) -> pemilik menyetujui -> penerus menyetujui perjanjian atribusi -> unduh berkas pribadi & PDF perjanjian atribusi
  - Kirim laporan dari halaman proyek -> proses dari `/admin/reports` -> verifikasi email notifikasi keluar dari `email_outbox` dan terkirim lewat Resend
- [ ] Pemilik proyek menandatangani persetujuan lanjut ke Tahap B.

---

## 2. Tahap B — Beta Tertutup (10–20 Mahasiswa Universitas Hasanuddin)

### B.1 Persiapan Lingkungan Produksi untuk Beta Tertutup
- [ ] `APP_ENV=PRODUCTION` (aplikasi akan menolak berjalan jika `AI_PROVIDER=mock`, `EMAIL_PROVIDER=console`, `CRON_SECRET` kurang dari 32 karakter, atau `APP_URL` masih `localhost`)
- [ ] Bersihkan data demo (`is_demo = true`) sebelum mengundang peserta nyata, atau dari `/admin/settings` bagian **Zona berbahaya -> Hapus data contoh** (ketik `PURGE DEMO DATA` + konfirmasi kata sandi)
- [ ] Di `/admin/settings`, atur:
  - **Tampilkan spanduk demo (`show_demo_banner`)**: `Mati` (`false`)
  - **Pendaftaran dibuka (`registrations_open`)**: `Hidup` (`true`)
  - **Domain email yang diizinkan (`allowed_email_domains`)**: `student.unhas.ac.id, unhas.ac.id`
  - **Alamat kontak (`contact_email`)**: alamat email resmi tim ESTAFET

### B.2 Pelaksanaan Beta Tertutup (3–5 Hari)
- [ ] Undang 10–20 mahasiswa Universitas Hasanuddin (campuran tim yang punya proyek berhenti dan tim yang ingin melanjutkan proyek)
- [ ] Catat setiap sesi uji coba onboarding nyata di `/admin/trials` menggunakan kode samaran (`P01`, `P02`, dst. — **tanpa nama atau email peserta**, centang persetujuan peserta, dan **jangan** centang `Ini baris contoh`)
- [ ] Isi catatan harian di [`docs/beta-log.md`](beta-log.md) setiap hari selama masa beta
- [ ] Tinjau setiap laporan yang masuk di `/admin/reports` dalam target SLA (`report_review_days`, bawaan 3 hari)

### B.3 Kriteria Lulus Tahap B
- [ ] `0` bug tingkat P0 (kehilangan data, kebocoran berkas pribadi, kegagalan masuk/terbit) atau P1 yang belum diperbaiki
- [ ] Seluruh laporan moderasi yang masuk selama beta sudah ditangani dengan alasan tertulis
- [ ] Minimal **5 sesi uji coba onboarding nyata** tercatat di `/admin/trials` (`is_demo = false`)

---

## 3. Tahap C — Daftar Periksa Go / No-Go Peluncuran Publik

Peluncuran publik hanya boleh dilakukan bila **semua 10 syarat** di bawah ini terpenuhi:

| No | Syarat Go / No-Go | Status | Bukti / Catatan |
|---|---|---|---|
| 1 | Semua pemeriksaan otomatis R8 lulus (`pnpm check`, `pnpm test:db`, E2E Playwright, audit tumpang-tindih, axe-core, performa) | [x] Lulus di R8 | Lihat [`docs/qa-report.md`](qa-report.md) |
| 2 | Tidak ada masalah keamanan atau akses lintas-akun (IDOR) yang terbuka | [x] Lulus di R8 | 8 suite `r8-authz.test.ts` + 68 tes `admin.test.ts` lulus; `pnpm audit --audit-level=high` = 0 kerentanan |
| 3 | Data contoh (`is_demo = true`) sudah dihapus atau disembunyikan, dan spanduk demo mati di produksi | [ ] Menunggu Tahap B/C | Dijaga otomatis oleh `isProduction()` di `src/app/[locale]/layout.tsx` + tombol `PURGE DEMO DATA` |
| 4 | Setidaknya satu akun admin nyata aktif, dengan kata sandi kuat, dan sudah diuji | [ ] Menunggu pemilik | Gunakan `select public.promote_admin('...')` |
| 5 | Pengiriman email nyata berfungsi dari alamat pengirim terverifikasi (`EMAIL_PROVIDER=resend`) | [ ] Menunggu pemilik | Diverifikasi di Tahap A |
| 6 | Penyedia AI nyata berfungsi dengan batas biaya dan batas harian (`daily_synthesis_cap`) terpasang | [ ] Menunggu pemilik | Diverifikasi di Tahap A |
| 7 | Pencadangan database otomatis aktif dan prosedur pemulihan di [`docs/runbook.md`](runbook.md) sudah diuji | [ ] Menunggu pemilik | Lihat `docs/runbook.md` bagian 5 |
| 8 | Pemeriksaan kesehatan (`/api/health`) dan peringatan gagal cron/email (`ALERT_WEBHOOK_URL`) aktif | [ ] Menunggu pemilik | Endpoint `/api/health` sudah lulus uji (200 OK) |
| 9 | Halaman hukum (`/terms`, `/privacy`, `/pedoman`, `/atribusi`) dan halaman `/kontak` tampil dengan alamat kontak nyata | [ ] Menunggu pemilik | Halaman sudah aktif dalam ID & EN; atur `contact_email` di `/admin/settings` |
| 10 | Beta tertutup (Tahap B) selesai tanpa masalah kritis yang belum tertangani | [ ] Menunggu Tahap B | Dicatat di [`docs/beta-log.md`](beta-log.md) |

### Langkah Saat Pemilik Menyatakan "Go" untuk Tahap C:
1. Di `/admin/settings`, sesuaikan `allowed_email_domains` sesuai keputusan peluncuran (tetap domain kampus atau dibuka lebih luas).
2. Bila pemilik menginstruksikan penggabungan ke `main`, pastikan `git rev-parse final-day-start` tetap utuh (`964d2e9`), lalu gabungkan `release/next` ke `main`.
3. Pantau `/admin` (Ringkasan, Laporan, Pipeline AI, Catatan Audit) dan log server selama 48 jam pertama.
4. **Prosedur Rollback Cepat:** Jika ditemukan masalah kritis pasca-peluncuran, matikan pendaftaran baru (`registrations_open = false`) dan publikasikan spanduk pengumuman tingkat `critical` dari `/admin/announcements` dalam waktu kurang dari 2 menit tanpa perlu deploy ulang.
