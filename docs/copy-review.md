# Copy review (R2): Indonesian interface

Status: **draft for a native-speaker review.** The Indonesian text was written by an AI assistant and has not yet been read by a fluent Indonesian reviewer. Please read the 30 strings below first, then the uncertain list.

Source of truth: `messages/id.json` (Indonesian) and `messages/en.json` (English). Tone: friendly, direct, short, "kamu". Glossary: `CLAUDE.md` section 14.7.

## How to review

1. Run the app, open `/` (Indonesian), click through Home, Jelajahi, a project page, Masuk, Dasbor, and the wizard.
2. Compare with the English under `/en`.
3. Send corrections as edits to `messages/id.json`. `node scripts/check-i18n.mjs` checks that nothing breaks.

## The 30 strings that matter most

| # | Key | Indonesian | Where it shows |
|---|---|---|---|
| 1 | `nav.explore` | Jelajahi | Navigation |
| 2 | `board.title` | Tinjau draf AI | Verify step title |
| 3 | `board.keep` | Pertahankan | Verify: keep an item |
| 4 | `board.remove` | Hapus | Verify: remove an item |
| 5 | `board.matchedBold` | Bukti cocok. | Evidence chip |
| 6 | `board.notFoundBold` | Bukti tidak ditemukan. | Evidence chip |
| 7 | `board.continuePublish` | Lanjut ke penerbitan | Verify footer |
| 8 | `files.draftBtn` | Susun draf dengan AI dan lanjut | Files step |
| 9 | `errors.hints.quota_full` | Kuota tim penerus penuh. | Access errors |
| 10 | `errors.hints.email_unverified` | Verifikasi alamat email kamu dulu. | Access errors |
| 11 | `errors.generic` | Terjadi kesalahan. Coba lagi, atau hubungi tim ESTAFET kalau berlanjut. | Any unknown error |
| 12 | `errors.forbidden` | Kamu tidak punya akses ke ini. | Permission errors |
| 13 | `board.advisorPending` | Persetujuan dosen menunggu | Verify footer |
| 14 | `board.footRemaining` | Tinjau N item tersisa untuk membuka penerbitan. | Verify footer |
| 15 | `files.readText` | teks PDF dan catatan Markdown-mu ... | Data notice |
| 16 | `synth.needConsent` | ESTAFET membaca berkasmu hanya setelah seluruh anggota tim mengonfirmasi... | Drafting error |
| 17 | `board.mockBold` | Keluaran AI simulasi (mode mock). | Mock banner |
| 18 | `board.summaryTitle` | Ringkasan hasil draf | Verify |
| 19 | `board.addTitle` | Tambahkan itemmu sendiri | Verify |
| 20 | `board.writtenByYou` | Ditulis olehmu | Verify |

Items 21 to 30 are the home hero, login, signup, request form, the access call to action, the report form, the consent page, the dashboard section titles, the agreement card and the footer. Read them in `messages/id.json` under `home`, `auth`, `request`, `teaser`, `report`, `advisor`, `dashboard`, `review` and `footer`.

## Uncertain choices (please decide)

- **"Tim penerus"** for adopter and **"Pemilik proyek"** for owner follow the glossary. Check that they sound natural in sentences such as "Kuota tim penerus penuh."
- **"Jejak estafet"** for lineage: keeps the brand idea, but may read as a metaphor only.
- **"Ringkasan publik"** for teaser, and **"Draf"** for draft: fine in context, check in labels and buttons.
- **"Pertahankan"** vs "Simpan" for keep: "Simpan" is used for deleting-file confirmation (keep the file), "Pertahankan" for review items. Check this is not confusing.
- **Mixed English terms** kept on purpose: ESTAFET, STACK, PDF, Markdown, ZIP, "mode mock". "mode mock" is only shown in mock environments.
- **Plural forms**: Indonesian has no plural, so messages use `other` only. Check "item" vs "butir".
- **Legal pages** (`terms`, `privacy`) are drafts for campus review, not legal text.
- **Agreement PDF** is generated in the language of the person who downloads it. The wording of the clauses was not reviewed by a lawyer.
- **AI-written content**: live AI drafts follow the language of the interface when the draft is created (Indonesian prompt line, quotes verbatim in the document's language). Mock mode output is not translated: it is deterministic and labeled.

## Known gaps

- The admin area is English only until phase R6.
- Upload notes saved in the database (`ingest_note`) keep the language they were created in.
- URLs are `/dasbor` for both languages (`/en/dasbor` in English). Localized path names (decision D4) were not implemented.
