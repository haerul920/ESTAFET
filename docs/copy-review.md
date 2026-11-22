# Tinjauan Bahasa Indonesia dan Glosarium (R1 & R8)

Bahasa Indonesia adalah bahasa utama dan bawaan ESTAFET (tanpa awalan URL). Bahasa Inggris tersedia di bawah `/en`. Seluruh teks antarmuka dan templat email disimpan di [`messages/id.json`](../messages/id.json) dan [`messages/en.json`](../messages/en.json) (**2.148 kunci** di masing-masing bahasa) serta diperiksa otomatis oleh [`scripts/check-i18n.mjs`](../scripts/check-i18n.mjs) dan [`tests/unit/r8-security.test.ts`](../tests/unit/r8-security.test.ts).

## 1. Kepatuhan Glosarium (CLAUDE.md 14.7 & 15.1)

Seluruh halaman publik, alur pengguna masuk, halaman hukum, area admin, dan 12 templat email transaksional memakai istilah yang sama secara konsisten:

| Konsep | Istilah di `messages/id.json` | Catatan Pemeriksaan R8 |
|---|---|---|
| Pemilik proyek | **Pemilik proyek** / **Pemilik** / **Pemilik bersama** | Menggantikan istilah lama *pencipta*/*creator* sejak R2 (satu jenis akun) |
| Tim yang melanjutkan | **Tim penerus** / **Penerus** | Tidak pernah diterjemahkan kaku sebagai *pengadopsi* atau *adopter* |
| Orang yang memegang akses | **Orang dengan akses** / **Pemegang akses** | Konsisten di Dasbor, Pengaturan proyek, dan Ruang proyek |
| Halaman proyek publik | **Ringkasan publik** | Konsisten di Wizard, Pengaturan, dan Admin |
| Halaman berkas terkunci | **Ruang proyek** | Konsisten di CTA, Dasbor, dan Workspace |
| Catatan serah terima | **Jejak estafet** | Konsisten di Teaser, Workspace, PDF, dan Admin |
| Tugas yang ditinjau pemilik | **Tugas berikutnya yang terverifikasi** | Konsisten di Beranda, Jelajahi, Teaser, dan Permintaan |
| Hasil pemeriksaan bukti | **Bukti cocok** · **Bukti cocok sebagian** · **Bukti tidak ditemukan** | Konsisten di lencana bukti dan papan tinjauan |
| Perjanjian kredit | **Perjanjian atribusi** | Konsisten di halaman `/atribusi`, modal persetujuan, dan PDF |
| Mode akses | **Terbuka dengan perjanjian** · **Dengan persetujuan** · **Dijeda** | Konsisten di langkah Tim dan akses, Pengaturan, dan Admin |
| Mode pengisian draf | **Susun draf dengan AI** · **Isi manual tanpa AI** | Konsisten di langkah Berkas dan papan tinjau |
| Status proyek | **Draf** · **Terbit** · **Ditarik** · **Diarsipkan** | Konsisten di Dasbor, Pengaturan, dan Admin |
| Status moderasi | **Ditahan sementara** · **Disembunyikan** · **Dihapus dari tampilan publik** | Konsisten di halaman keputusan pemilik dan Admin |
| Ukuran tugas (`effort`) | **Beban kerja: Kecil / Sedang / Besar** | Tidak pernah diterjemahkan menjadi *usaha kecil* |
| Navigasi jejak (`breadcrumb`) | **Jalur navigasi** | Tidak pernah diterjemahkan menjadi *remah roti* |

## 2. Pembersihan Istilah Lama & Pemeriksaan Otomatis (R8 Item 7)

Pada Fase R8, seluruh 2.148 kunci di `messages/id.json` dan `messages/en.json` dipindai secara menyeluruh:

1. **Penghapusan alur dosen pembimbing (R5):** Tidak ada lagi istilah `dosen pembimbing`, `advisor`, atau kunci lama `board.advisorPending` di `messages/id.json` maupun `messages/en.json`. Persetujuan sebelum AI membaca berkas dan sebelum proyek terbit sepenuhnya berada pada pemilik dan pemilik bersama aktif (`consentStep.*`, `fill.consent*`).
2. **Bebas istilah kaku dan sisa bahasa Inggris:** Pemindaian otomatis di [`tests/unit/r8-security.test.ts`](../tests/unit/r8-security.test.ts) memastikan `messages/id.json` bebas dari kata terlarang (`dosen pembimbing`, `advisor`, `creator`, `adopter`, `pengadopsi`, `remah roti`, `usaha kecil`, `TODO`, `PLACEHOLDER`, `FIXME`, `lorem ipsum`).
3. **Kesesuaian kunci dan komponen:** `node scripts/check-i18n.mjs` memverifikasi bahwa:
   - Setiap kunci di `messages/id.json` ada di `messages/en.json` (dan sebaliknya) dengan placeholder ICU `{...}` yang identik.
   - Tidak ada kunci yatim (tidak terpakai) dan tidak ada kunci yang hilang di kode sumber.
   - Tidak ada teks bahasa Inggris atau Indonesia yang di-*hard-code* langsung di komponen `.tsx`.
4. **Format lokal Indonesia (`src/lib/format.ts`):** Tanggal menggunakan format `id-ID` (`19 Nov 2026`) dan zona waktu kampus `Asia/Makassar` (`WITA`), serta angka menggunakan pemisah ribuan titik (`1.250`).
