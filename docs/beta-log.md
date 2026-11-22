# Catatan Harian Beta Tertutup (R9 Stage B Beta Log)

> **Status saat ini:** **Templat siap pakai — Beta tertutup (Tahap B) belum dimulai.**
> Sesuai aturan kerja (`docs/handover-r8-r9.md` bagian 2.2 & 7.3), pengujian beta dengan mahasiswa nyata hanya boleh dimulai setelah pemilik proyek menyiapkan lingkungan staging/produksi (Tahap A) dan memberi izin. Tidak ada angka uji coba pengguna yang boleh dikarang.

---

## Ringkasan Konfigurasi Beta Tertutup

- **Lingkungan:** `PRODUCTION` (mode beta tertutup)
- **Domain email yang diizinkan (`allowed_email_domains`):** `student.unhas.ac.id, unhas.ac.id`
- **Target peserta:** 10–20 mahasiswa Universitas Hasanuddin (pencipta proyek berhenti & tim penerus)
- **Target sesi uji coba terstruktur (`/admin/trials`):** Minimal 5 sesi nyata (`is_demo = false`) dengan persetujuan peserta (`consented = true`)
- **Durasi pemantauan:** 3–5 hari

---

## Catatan Harian

### Hari 1 — Tanggal: `YYYY-MM-DD`
- **Peserta diundang / mendaftar:** `0` diundang · `0` akun terkonfirmasi
- **Proyek baru:** `0` draf dibuat · `0` memakai draf AI · `0` memakai isi manual · `0` terbit
- **Permintaan & akses:** `0` permintaan dikirim · `0` akses langsung diambil
- **Sesi uji coba onboarding (`/admin/trials`):** `0` sesi dicatat (kode: `—`)
- **Kesehatan teknis:**
  - Kegagalan sintesis AI (`/admin/pipeline`): `0`
  - Kegagalan pengiriman email (`email_outbox` berstatus `failed`): `0`
  - Laporan moderasi masuk (`/admin/reports`): `0`
- **Temuan & tindakan:**
  - _Belum ada catatan._

### Hari 2 — Tanggal: `YYYY-MM-DD`
- **Peserta diundang / mendaftar:** `0` akun baru
- **Proyek baru:** `0` draf · `0` terbit
- **Permintaan & akses:** `0` permintaan · `0` akses aktif
- **Sesi uji coba onboarding (`/admin/trials`):** `0` sesi dicatat
- **Kesehatan teknis:**
  - Kegagalan sintesis AI: `0` · Kegagalan email: `0` · Laporan masuk: `0`
- **Temuan & tindakan:**
  - _Belum ada catatan._

### Hari 3 — Tanggal: `YYYY-MM-DD`
- **Peserta diundang / mendaftar:** `0` akun baru
- **Proyek baru:** `0` draf · `0` terbit
- **Permintaan & akses:** `0` permintaan · `0` akses aktif
- **Sesi uji coba onboarding (`/admin/trials`):** `0` sesi dicatat
- **Kesehatan teknis:**
  - Kegagalan sintesis AI: `0` · Kegagalan email: `0` · Laporan masuk: `0`
- **Temuan & tindakan:**
  - _Belum ada catatan._

### Hari 4 — Tanggal: `YYYY-MM-DD`
- **Peserta diundang / mendaftar:** `0` akun baru
- **Proyek baru:** `0` draf · `0` terbit
- **Permintaan & akses:** `0` permintaan · `0` akses aktif
- **Sesi uji coba onboarding (`/admin/trials`):** `0` sesi dicatat
- **Kesehatan teknis:**
  - Kegagalan sintesis AI: `0` · Kegagalan email: `0` · Laporan masuk: `0`
- **Temuan & tindakan:**
  - _Belum ada catatan._

### Hari 5 — Tanggal: `YYYY-MM-DD`
- **Peserta diundang / mendaftar:** `0` akun baru
- **Proyek baru:** `0` draf · `0` terbit
- **Permintaan & akses:** `0` permintaan · `0` akses aktif
- **Sesi uji coba onboarding (`/admin/trials`):** `0` sesi dicatat
- **Kesehatan teknis:**
  - Kegagalan sintesis AI: `0` · Kegagalan email: `0` · Laporan masuk: `0`
- **Temuan & tindakan:**
  - _Belum ada catatan._

---

## Rekap Akhir Beta Tertutup (Diisi Sebelum Tahap C)

| Metrik | Target Lulus | Hasil Nyata | Status |
|---|---|---|---|
| Masalah P0 / P1 yang belum selesai | `0` | _Belum diukur_ | Menunggu Tahap B |
| Laporan moderasi ditangani dalam SLA | `100%` | _Belum diukur_ | Menunggu Tahap B |
| Sesi uji coba nyata di `/admin/trials` (`is_demo = false`) | `>= 5 sesi` | `n = 0` | Menunggu Tahap B |
| Median waktu memahami proyek (kelompok ESTAFET) | `<= 30 menit` (target) | _Belum diukur_ | Menunggu Tahap B |
| Rerata skor SUS | Dicatat jujur beserta `n` | _Belum diukur_ | Menunggu Tahap B |
