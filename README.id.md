# ESTAFET

Baca dalam: **Bahasa Indonesia** · [English](README.md)

**Lanjutkan dari tempat tim sebelumnya berhenti.**

ESTAFET adalah platform web serah terima proyek lomba dan riset mahasiswa yang berhenti di Universitas Hasanuddin, sehingga tim mahasiswa berikutnya dapat memahami posisi proyek dan melanjutkannya dengan atribusi yang jelas.

Dibuat oleh tim **Beban Server** (Haerulumu, Universitas Hasanuddin) untuk **STACK 2026**, Kasus 1: *Smarter Campus and Learning*.

---

## Masalah yang Diselesaikan

Setiap semester, tim mahasiswa mengerjakan proyek Program Kreativitas Mahasiswa (PKM), proyek hackathon, dan prototipe riset yang berhenti ketika pendanaan tidak turun, anggota tim lulus, atau tenggat lomba berakhir. Dalam survei awal kami terhadap 10 mahasiswa Universitas Hasanuddin dari empat fakultas (November 2026; hanya indikatif, bukan sampel statistik), 8 dari 10 memiliki proyek yang baru berhenti tetapi masih tersimpan, 9 dari 10 menyimpan berkas di drive pribadi atau grup obrolan, dan 9 dari 10 tidak memiliki dokumentasi serah terima yang lengkap.

Masalahnya bukan kurangnya proyek, melainkan tidak adanya cara terstruktur untuk menyerahkan proyek dengan aman dari satu tim mahasiswa ke tim berikutnya.

## Cara Kerja ESTAFET

1. **Unggah & pilih mode pengisian.** Pemilik proyek membuat draf pribadi, mengonfirmasi persetujuan tim, lalu memilih untuk mengunggah laporan PDF, catatan Markdown, atau ZIP kode agar didrafkan AI — **atau memilih isi manual tanpa AI sama sekali**. Untuk ZIP, ESTAFET hanya menyimpan pohon folder, `README`, dan manifes paket; berkas sensitif seperti `.env`, kunci pribadi, dan kredensial dilewati serta tidak pernah disimpan.
2. **Verifikasi dengan bukti sumber.** Jika memakai AI, setiap tujuan, pekerjaan selesai, tugas berikutnya, dan pelajaran yang didrafkan harus menyertakan kutipan singkat dan halaman/berkas asalnya. Pencocok deterministik memeriksa setiap kutipan terhadap teks asli dan menandainya **Bukti cocok**, **Bukti cocok sebagian**, atau **Bukti tidak ditemukan**. Penerbitan diblokir di tingkat database sampai pemilik meninjau setiap butir (`Pertahankan`, `Ubah`, atau `Hapus`).
3. **Terbitkan dengan aturan akses pilihan pemilik.** Pemilik memilih salah satu dari tiga mode akses:
   - **Terbuka dengan perjanjian (`open`)**: siapa pun yang sudah masuk dan memverifikasi email dapat menyetujui perjanjian atribusi dan langsung membuka berkas pribadi.
   - **Dengan persetujuan (`by_request`)**: tim penerus mengirim rencana singkat dan pemilik memutuskan tiap permintaan.
   - **Dijeda (`paused`)**: ringkasan publik tetap tayang, tetapi akses baru dijeda sementara dan pengunjung dapat menekan **Beri tahu saya**.
4. **Lanjutkan dengan atribusi & jejak estafet.** Setiap penerus menyetujui Perjanjian Atribusi untuk dirinya sendiri. Berkas pribadi terbuka melalui tautan bertanda tangan berumur 60 detik, kalimat kredit siap salin beserta PDF perjanjian disediakan, dan setiap peristiwa tercatat secara *append-only* di jejak estafet proyek.

---

## Kejujuran Bukti & Metrik

- Proyek yang dimuat melalui `supabase/seed.sql` adalah **data contoh sintetis** dan selalu ditandai lencana **Data contoh** (`is_demo = true`).
- Target waktu pemahaman proyek (`<= 30 menit`) adalah **target desain**, bukan hasil yang sudah diklaim.
- Halaman `/admin/trials` mencatat sesi uji coba onboarding nyata (`is_demo = false`) terpisah dari baris contoh dan menolak menarik kesimpulan ketika jumlah sesi nyata di bawah ambang (`n < 5`).
- Semua dokumen hukum (`/terms`, `/privacy`, `/pedoman`, `/atribusi`) menampilkan pemberitahuan jujur **"Draf, belum ditinjau pihak berwenang"**.

---

## Menjalankan Secara Lokal

### Prasyarat
- Node.js 20+ dan `pnpm` 10+
- Docker Desktop (untuk stack Supabase lokal)

### Langkah Cepat (Stack Lokal)

1. Nyalakan stack Supabase lokal (atau gunakan `pnpm db:reset` pada proyek Supabase kosong):
   ```bash
   pnpm install
   pnpm dev:local
   ```
   `pnpm dev:local` memuat `.env.localstack` (Supabase lokal di `127.0.0.1:54321`, `AI_PROVIDER=mock`, `EMAIL_PROVIDER=console`) dan menjalankan aplikasi di [http://localhost:3100](http://localhost:3100).

2. **Akun Demo** (kata sandi untuk semuanya: `Demo-Pass-2026!`):
   - `creator@estafet.demo` — memiliki proyek terbit dan satu draf yang siap diuji di langkah verifikasi
   - `adopter@estafet.demo` — memegang akses pada satu proyek dan memiliki permintaan pada proyek lain
   - `alumni@estafet.demo` — memiliki proyek mode terbuka dan proyek dengan permintaan menunggu
   - `admin@estafet.demo` — akun admin untuk `/admin`

---

## Pemeriksaan Kualitas & Pengujian

```bash
pnpm check          # ESLint + Prettier + TypeScript + pemeriksaan 2.148 kunci i18n + 199 unit test
pnpm test:db        # 176 pengujian aturan database, RLS, moderasi, outbox email, dan matriks otorisasi (R8)
pnpm test:e2e       # Pengujian end-to-end Playwright (alur bahasa Indonesia & Inggris, admin, overlap, a11y)
pnpm perf           # Pengukuran LCP, CLS, dan ukuran JS pada profil ponsel mid-range ter-throttle
```

---

## Dokumentasi Lengkap

- [`CLAUDE.md`](CLAUDE.md) — Spesifikasi produk, aturan desain, dan skema
- [`docs/release-plan.md`](docs/release-plan.md) — Rencana rilis Fase R0 sampai R9
- [`docs/handover-r8-r9.md`](docs/handover-r8-r9.md) — Panduan serah terima R8 & R9
- [`docs/security.md`](docs/security.md) — Model keamanan, RLS, pembatas laju, pemindaian unggahan, dan break-glass
- [`docs/performance.md`](docs/performance.md) — Hasil pengukuran LCP, CLS, dan beban JavaScript
- [`docs/copy-review.md`](docs/copy-review.md) — Tinjauan bahasa Indonesia dan kepatuhan glosarium
- [`docs/qa-report.md`](docs/qa-report.md) — Laporan gerbang kualitas Fase R8 lengkap
- [`docs/launch-checklist.md`](docs/launch-checklist.md) — Daftar periksa peluncuran bertahap R9 (Tahap A, B, C)
- [`docs/beta-log.md`](docs/beta-log.md) — Templat catatan harian Beta Tertutup
- [`docs/runbook.md`](docs/runbook.md) — Panduan operasional, variabel lingkungan, cron, pencadangan, dan penanganan insiden
- [`docs/ai-disclosure.md`](docs/ai-disclosure.md) — Pengungkapan penggunaan AI untuk STACK 2026

---

## Status Fase Rilis

| Fase | Ruang Lingkup | Status |
|---|---|---|
| **R0** | Penjaga kejujuran bukti & penghapusan metrik yang belum diukur | Selesai |
| **R1** | Bahasa Indonesia sebagai bahasa bawaan & peralihan bahasa ID/EN (`next-intl`) | Selesai |
| **R2** | Satu jenis akun, verifikasi email, pemilik bersama, mode akses (`open`, `by_request`, `paused`), siklus hidup proyek | Selesai |
| **R3** | Keamanan, pembatas laju, pemeriksaan bot ramah-aksesibilitas, pemindaian unggahan, penegakan versi kebijakan | Selesai |
| **R4** | Pengalaman pemilik & penerus: mode isi manual tanpa AI, simpan otomatis, "Beri tahu saya", utas pesan permintaan, kemajuan tugas, pengalihan kepemilikan | Selesai |
| **R5** | Kepercayaan, moderasi & privasi: penghapusan langkah dosen pembimbing, laporan & kode referensi, penahanan otomatis dari pelapor berbeda, halaman keputusan & banding, ekspor data JSON, penghapusan akun masa tunggu 30 hari | Selesai |
| **R6** | Area admin penuh (`/admin`), spanduk pengumuman, manajemen versi kebijakan, uji coba onboarding (`/admin/trials`), catatan audit *append-only* & break-glass 5 menit | Selesai |
| **R7** | Operasional produksi: antrean email transaksional (`email_outbox` + Resend), jadwal cron (`/api/cron/emails`, `/api/cron/daily`), pemeriksaan kesehatan (`/api/health`), log terstruktur & `docs/runbook.md` | Selesai |
| **R8** | Gerbang kualitas: matriks otorisasi & uji IDOR (`tests/security/authz.matrix.ts`, `tests/db/r8-authz.test.ts`), uji E2E bahasa Indonesia & Inggris, audit tumpang-tindih 39 rute × 6 viewport, audit aksesibilitas & keyboard, pengukuran performa produksi, skrip uji beban k6, dan `docs/qa-report.md` | Selesai |
| **R9** | Peluncuran bertahap: daftar periksa Tahap A/B/C (`docs/launch-checklist.md`), templat log beta (`docs/beta-log.md`), `README.id.md` — menunggu eksekusi staging & beta tertutup oleh pemilik | Siap untuk pemilik |
