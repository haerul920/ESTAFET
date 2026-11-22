# Uji Beban (Load Testing) — ESTAFET

Skrip uji beban menggunakan [Grafana k6](https://k6.io/) dan berada di [`tests/load/explore-and-uploads.k6.js`](explore-and-uploads.k6.js).

> **Peringatan keamanan lingkungan:** Jangan pernah menjalankan uji beban terhadap proyek Supabase cloud bersama (`.env.local`) tanpa izin tertulis dan paket kapasitas yang sesuai. Selalu jalankan uji beban terhadap stack Docker lokal (`.env.localstack`) dengan build produksi atau lingkungan staging khusus. Skrip menolak berjalan kecuali variabel `-e ALLOW_LOAD_TEST=1` diberikan secara eksplisit.

## Skenario yang Diuji

1. **`browse_explore_and_teasers` (200 peramban bersamaan)**
   - Naik bertahap hingga **200 Virtual Users (VU)** selama 2 menit.
   - Mengakses `/`, `/explore`, pencarian `/explore?q=mangrove`, filter `/explore?kind=research&sort=tasks`, halaman ringkasan proyek publik (`/projects/mangrove-cover-classifier`, `/projects/campus-waste-sorting-assistant`, `/projects/fish-freshness-indicator`, `/projects/study-group-matcher`), halaman kebijakan, serta `/api/health`.
   - **Ambang lulus (Thresholds):**
     - Tingkat kegagalan HTTP (`http_req_failed`): `< 1%` (`rate<0.01`)
     - Waktu respons `p(95) < 800 ms` dan `p(99) < 1500 ms`
     - `0` respons `5xx`.

2. **`concurrent_uploads` (20 unggahan bersamaan)**
   - Menjalankan **20 Virtual Users (VU)** paralel yang mengunggah berkas Markdown ke `POST /api/projects/:projectId/files`.
   - Memastikan ekstraksi berkas, batas maksimal 10 berkas per proyek (`400`), dan pembatas laju (rate limit 30 unggahan/jam per akun -> `429`) bekerja rapi tanpa pernah menghasilkan galat server `5xx`.
   - **Ambang lulus:** `p(95) < 3000 ms`, `0` respons `5xx`.

## Cara Menjalankan

### 1. Uji Asap Cepat (Smoke Mode) terhadap Build Produksi Lokal

Pastikan stack Supabase Docker lokal berjalan dan server produksi lokal aktif di port `3100`, lalu jalankan:

```bash
k6 run -e BASE_URL=http://localhost:3100 -e ALLOW_LOAD_TEST=1 -e SMOKE=1 tests/load/explore-and-uploads.k6.js
```

### 2. Uji Beban Penuh (200 Peramban Bersamaan)

```bash
k6 run -e BASE_URL=http://localhost:3100 -e ALLOW_LOAD_TEST=1 tests/load/explore-and-uploads.k6.js
```

### 3. Uji Beban Penuh + 20 Unggahan Paralel

Buat satu proyek draf pada lingkungan target, ambil ID proyek dan cookie sesi pemiliknya, lalu jalankan:

```bash
k6 run \
  -e BASE_URL=http://localhost:3100 \
  -e ALLOW_LOAD_TEST=1 \
  -e LOAD_PROJECT_ID="<uuid-proyek-draf>" \
  -e LOAD_COOKIE="<cookie-sesi-supabase>" \
  tests/load/explore-and-uploads.k6.js
```
