# ESTAFET: Release edition prompts for Claude Code

This file turns the STACK prototype into a real, public product. It supersedes `CLAUDE.md`, `PROMPTS.md` and `PROMPTS_ADMIN.md` wherever they conflict. Where it is silent, the older files still apply.

---

## Ringkasan untuk pemilik proyek (bahasa Indonesia)

Bagian ini untuk Anda, bukan untuk Claude Code. Semua yang lain ditulis dalam bahasa Inggris karena Claude Code bekerja paling stabil dengan itu. Antarmuka situsnya sendiri akan berbahasa Indonesia.

**Keputusan yang saya ambil setelah memikirkan alurnya**

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Satu jenis akun. "Pemilik proyek" dan "penerus" adalah hubungan per proyek, bukan jenis akun. Admin hanya penanda tambahan. | Satu orang bisa berbagi dan melanjutkan. Tidak ada pilihan peran saat daftar. |
| 2 | Pemilik mengatur akses berkas tiap proyek: **Terbuka dengan perjanjian** (penerus langsung dapat akses setelah menyetujui perjanjian atribusi) atau **Dengan persetujuan** (penerus mengajukan dulu, pemilik memutuskan). Ada juga jeda sementara. | Sesuai permintaan Anda: dipublikasikan atau diajukan dulu. |
| 3 | Status proyek dipisah dari moderasi. Status: draf, terbit, ditarik, diarsipkan. Moderasi: normal, ditahan, disembunyikan, dihapus. | Pemilik bisa menarik proyeknya sendiri tanpa tercampur dengan tindakan admin. |
| 4 | Persetujuan tim diminta sebelum berkas diproses AI. Persetujuan dosen pembimbing hanya menahan penerbitan, bukan pengunggahan. | Alur tidak macet menunggu dosen. |
| 5 | Laporan pelanggaran terbuka untuk siapa saja. Ada ambang penahanan otomatis, alasan tertulis untuk pemilik, dan jalur banding. | Adil bagi pelapor dan pemilik. |
| 6 | Bahasa Indonesia jadi bawaan, bahasa Inggris tetap tersedia lewat pengalih bahasa. | Handbook STACK mewajibkan bahasa Inggris untuk materi yang dinilai juri (termasuk demo di Final Day). |
| 7 | Dua lingkungan: **demo** (untuk juri, data contoh, mode tiruan AI boleh) dan **produksi** (data nyata, AI sungguhan, mode tiruan dilarang). | Handbook meminta data demo yang diberi label dan cadangan lokal. Rilis publik tidak boleh membawa data contoh. |
| 8 | Rilis bertahap: staging, beta tertutup, baru publik. | Mengurangi risiko saat pertama kali dipakai orang sungguhan. |
| 9 | Email transaksional sekarang masuk cakupan (verifikasi akun, tautan dosen, notifikasi penting). | Produk publik tidak bisa mengandalkan "salin tautan lalu kirim sendiri". |
| 10 | Pengguna boleh memilih **tanpa AI** (isi manual). | Persetujuan yang bermakna. Tidak semua orang mau berkasnya dikirim ke penyedia AI. |

**Perlu Anda konfirmasi sebelum fase R0 selesai**

1. Batas tim penerus aktif per proyek. Bawaan saya: 3 (pemilik bisa ubah ke 1 atau tidak terbatas).
2. Sapaan antarmuka: "kamu" (bawaan saya, cocok untuk mahasiswa) atau "Anda".
3. Proyek tanpa dosen pembimbing (misalnya lomba mandiri): boleh terbit dengan pernyataan dan pemeriksaan acak admin (bawaan saya) atau wajib ada dosen.
4. Pembatasan domain email di produksi (misalnya hanya `.ac.id`) atau terbuka.
5. Siapa penyelenggara dan pengendali data: tim, program studi, atau universitas. Ini menentukan isi Syarat, Kebijakan Privasi, kontak, dan apakah perlu pendaftaran PSE Lingkup Privat.
6. Hosting dan wilayah data.

**Catatan hukum yang saya verifikasi lewat pencarian (bukan nasihat hukum)**

- UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi berlaku, dengan hak subjek data seperti akses, koreksi, penghapusan, portabilitas, dan penolakan pemrosesan. Fitur ekspor dan penghapusan akun di bawah ini mengacu ke sana.
- Peraturan Menteri Kominfo No. 5 Tahun 2020 mewajibkan Penyelenggara Sistem Elektronik Lingkup Privat yang melayani pengguna di Indonesia mendaftar lewat OSS. Apakah ESTAFET termasuk, dan atas nama siapa, perlu dikonfirmasi ke bagian hukum kampus.
- Syarat dan Kebijakan Privasi harus ditinjau pihak berwenang kampus sebelum rilis publik. Claude Code hanya membuat draf.

**Jadwal yang realistis**

STACK: proposal semifinal 30 Nov, pengembangan 7 sampai 16 Des, Final Day 16 Des. Pekerjaan R0 sampai R4 bisa mengalir bersama pengembangan produk. Rilis publik (R9) sebaiknya setelah Final Day, dengan beta tertutup lebih dulu. Jangan menghapus jejak commit: beri tag `final-day-start` sebelum Final Day dan kerjakan refactor besar di cabang terpisah.

---

## How to use (for Claude Code)

1. Append the block "CLAUDE.md addendum v2" to `CLAUDE.md` as section 14. It is binding.
2. Paste phase prompts R0 to R9 one at a time. Do not skip R0.
3. Work on a branch per phase. Merge only after the acceptance checks pass.

---

## CLAUDE.md addendum v2 (append as section 14)

```
## 14. Release edition (supersedes earlier sections where they conflict)

### 14.1 Principles
- This is a real public product, not a demo. No demo data, no mock AI, no placeholder copy in production.
- One account type. A person can share projects and continue other people's projects with the same account.
- Clear flows over clever ones: one primary action per screen, plain Indonesian, visible status, no dead ends.
- Privacy and safety by default. Private files stay private. Reports are easy. Moderation is transparent and reversible.
- Calm, animated, polished, and never obstructed: no UI layer may hide or cover another.

### 14.2 Competition compatibility (STACK 2026)
- Default UI language is Indonesian. English must remain fully available through a language switcher, because judged materials, the README and the Final Day pitch and demo are in English.
- Keep a separate `demo` environment: demo data (`is_demo = true`), mock LLM allowed, "Data contoh" badge. Judges use it.
- Production refuses to boot with `LLM_PROVIDER=mock` or with `SEED_DEMO=true`.
- Keep the declared Final Day tasks unfinished until the build session. Tag `final-day-start`. Never claim a feature is done unless it was run.
- The README stays in English and keeps the AI assistance disclosure current. Add `README.id.md` in Indonesian.

### 14.3 Accounts and relationships
- `profiles` has no role column for creator or adopter. Remove it (migrate data). Keep `is_admin`.
- Relationships live per project:
  - `project_members(project_id, profile_id, role enum[owner, co_owner], status enum[invited, active, left], consented_at)`.
  - `project_access(id, project_id, profile_id, source enum[open, approved_request], status enum[active, revoked], agreement_version, accepted_at, revoked_at, revoked_reason, request_id null)`.
- A person cannot request or take access to a project they own.
- Sign up: email and password, email verification required before sharing a project or taking access. Browsing needs no account. Accept the current Terms and Privacy Policy (versioned, stored in `policy_acceptances`).
- First-run screen: "Apa yang ingin kamu lakukan?" with two cards, "Bagikan proyek" and "Jelajahi proyek". This only guides the first visit and is not stored as a role.
- Dashboard (`/dasbor`) has one view with two sections: "Proyek saya" (projects I share) and "Proyek yang saya lanjutkan" (access I hold, requests I sent). No role switch.

### 14.4 Project settings owned by the owner
Per project, editable by owners at any time (`/proyek/[slug]/pengaturan`):
- Publication: `draft`, `published`, `unpublished`, `archived`. Owner can unpublish and republish when requirements are met.
- File access mode (`access_mode`):
  - `open`: any signed-in, verified user can take access after accepting the attribution agreement. No approval. Owners are notified.
  - `by_request`: a user submits a request, owners decide, then the agreement is accepted.
  - `paused`: teaser stays public, no new access or requests. Existing access continues.
- `max_active_adopters`: 1, 3 (default) or unlimited. When full, the CTA shows "Kuota tim penerus penuh" and offers "Beri tahu saya".
- Co-owners: invite by email, they confirm. Ownership transfer needs the recipient to confirm.
- Advisor consent status, resend link.
- Incoming requests, active adopters, revoke access with a reason (adopters keep their attribution duty).
- Notifications for this project.

### 14.5 State machines
Project lifecycle (`status`): draft -> published <-> unpublished -> archived.
- draft -> published needs ALL of: at least one kept item, every drafted item reviewed, all active members consented, advisor approved OR "no advisor" declaration accepted, current policies accepted by the publisher.
- unpublished hides the teaser from public pages but keeps data and active access.
- archived is read-only for the owner; active adopters keep access; cannot be deleted while any active access or agreement exists (owner can ask admin).

Moderation (`moderation_status`, separate): ok -> held (automatic or by admin, temporary) -> hidden (admin) -> removed (admin). Any state can return to ok by admin decision or successful appeal. Public pages show a project only if `status = published AND moderation_status = ok`.

Access for a user U on project P:
- none -> (mode open) accept agreement -> active
- none -> (mode by_request) request pending -> approved -> agreement accepted -> active
- pending -> declined (can re-apply after 7 days, configurable) | withdrawn | expired (30 days, owners and applicant notified)
- active -> revoked (owner or admin, with reason)

Team requests: the applicant may list teammates by email. Access is per person: each teammate must have an account and accept the agreement once. The applicant acts as team contact.

### 14.6 Reporting and moderation
- Anyone can report a project from the teaser page and from the project menu. Guests pass a bot check. Reasons map to the rules: `copyright`, `personal_data`, `false_information`, `inappropriate`, `false_ownership`, `harmful_file`, `spam`, `other`. Details required, evidence link optional.
- The reporter gets a reference code. Signed-in reporters see status under "Laporan saya". The reporter's identity is never shown to owners.
- Duplicate reports on the same project and reason are grouped.
- Automatic hold: when distinct reporters reach the threshold (default 3 for `copyright`, `personal_data`, `harmful_file`; configurable in settings), the project becomes `held`: hidden from public lists with a neutral notice, and an admin is alerted. A hold is temporary and must be reviewed within the review target (default 3 days) or an admin alert escalates. Holds can be abused, so the threshold counts distinct verified accounts or distinct guest IP hashes, with rate limits, and admins can dismiss.
- Every decision (dismiss, hold, hide, remove, restore) needs a written reason. The owner always receives the reason and a link to appeal.
- Appeals: one open appeal per decision, admin reviews, outcome notified. Appeals appear in a separate admin queue.
- Rules are published as "Pedoman Komunitas", linked from every report form.

### 14.7 Language and copy
- Use `next-intl`. Default locale `id`, secondary `en`. Locale in the URL only for English (`/en/...`), Indonesian has no prefix. Persist choice in a cookie. `<html lang>` follows the locale.
- No hard coded user-facing strings. All text lives in `messages/id.json` and `messages/en.json`. A CI check fails if a key exists in one file and not the other.
- Formats: `id-ID` numbers and dates, timezone shown in WITA (Asia/Makassar) with absolute time on hover.
- Tone: friendly, direct, short. Address the user as "kamu". Errors say what went wrong and how to fix it. No jargon, no English leftovers in the Indonesian UI (except proper names such as ESTAFET, STACK, PDF, Markdown, ZIP).
- Glossary (keep consistent everywhere):

| English | Indonesian |
|---|---|
| Creator (owner) | Pemilik proyek |
| Adopter | Tim penerus (hubungan per proyek) |
| Teaser | Ringkasan publik |
| Share a project | Bagikan proyek |
| Explore | Jelajahi |
| Dashboard | Dasbor |
| Verify the AI draft | Tinjau draf AI |
| Evidence matched / not found | Bukti cocok / Bukti tidak ditemukan |
| Advisor | Dosen pembimbing |
| Attribution agreement | Perjanjian atribusi |
| Request to continue | Ajukan untuk melanjutkan |
| Take access (open mode) | Lanjutkan proyek ini |
| Workspace | Ruang proyek |
| Lineage | Jejak estafet |
| Report | Laporkan |
| Hold / Hide / Remove / Restore | Tahan / Sembunyikan / Hapus / Pulihkan |
| Appeal | Banding |
| Publish / Unpublish / Archive | Terbitkan / Tarik / Arsipkan |
| Demo data | Data contoh |

### 14.8 Motion
Tokens: durations 150 ms (micro), 250 ms (standard), 500 ms (reveal), easing `cubic-bezier(0.22, 1, 0.36, 1)`. Animate only `transform` and `opacity` (and small `blur` on glass). No layout shifting animations. Target CLS under 0.05.

Required motion:
- Home: hero cards float and drift with different durations (6 to 9 s), amplitudes (8 to 16 px) and slight rotation, staggered delays, `ease-in-out`, alternate infinite. Clouds drift horizontally slowly (40 to 70 s, linear). Headline reveals word by word. Hero CTAs have a hover glow and an arrow that nudges. Stat numbers count up once when scrolled into view (the final value is in the accessible name). Sections reveal with a small upward fade and stagger. Subtle scroll parallax on clouds (max 24 px). Meadow flowers sway gently.
- Global hover and press: cards lift 4 px with soft shadow growth, buttons lift and brighten, pills and chips scale 1.03, links get an animated underline, icon buttons rotate or nudge, active press scales 0.98. Visible focus ring animates in.
- State changes: progress bars ease, accordion and tab content slides, toasts slide and fade, dialogs scale from 0.96 with overlay fade, success checkmark draw, skeleton shimmer, list items enter and exit with a short fade.
- Wizard steps transition horizontally with direction awareness.

Rules:
- `prefers-reduced-motion: reduce` disables floating, drifting, parallax, count-up, stagger and word reveal, and keeps instant state changes.
- Pause looping animations when off screen (IntersectionObserver toggles `animation-play-state`) and when `document.hidden`.
- Use `will-change` only on the floating hero cards. No JS driven per frame animation except for scroll parallax throttled with `requestAnimationFrame`.
- On phones, reduce floating elements to 3 and shorten amplitudes.
- Prefer CSS keyframes and CSS transitions. Add the `motion` library only for orchestrated reveals and wizard transitions.

### 14.9 Layering and anti-overlap rules
- Use a z-index scale defined as tokens, nothing else: `base 0`, `raised 10`, `sticky 20`, `nav 30`, `dropdown 40`, `drawer 50`, `overlay 60`, `modal 70`, `toast 80`, `system-banner 90`. Never use ad hoc z-index values.
- Dialogs, menus, popovers, tooltips and toasts render in portals (use Radix UI primitives: Dialog, DropdownMenu, Popover, Tooltip, Tabs, Toast, Select). They handle focus trap, focus return, escape, collision flipping and scroll lock.
- Never put popovers inside containers with `overflow: hidden`. Avoid creating accidental stacking contexts (`transform`, `filter`, `opacity < 1`) on ancestors of positioned UI.
- Decorative layers (clouds, gradients, floating cards, flowers) are `aria-hidden`, `pointer-events: none`, sit below content, and live in their own container with reserved space. Floating cards must never overlap the headline, subtext or CTAs at any width. Use grid areas and minimum heights to guarantee separation.
- Sticky nav: set `scroll-margin-top` on anchor targets, add top padding so content is not hidden behind it.
- Bottom bars on mobile: add matching `padding-bottom` plus `env(safe-area-inset-bottom)`; toasts sit above bars; cookie or notice banners are in flow or non-blocking and never cover the primary action.
- System banners (staging badge, moderation notices, emergency access banner) push content down, they do not overlay it.
- Test viewports: 360x740, 390x844, 768x1024, 1024x768, 1280x800, 1536x864.
- An automated overlap audit (Playwright) is part of CI: for every key route and viewport it verifies that (a) the center of every visible interactive element hits that element or its label, (b) there is no horizontal page overflow, (c) clipped text is flagged, (d) hero floating elements do not intersect the h1 or CTAs. Failures block merging.

### 14.10 Production requirements
- Environments: local, demo, staging, production. Config via env vars, validated at boot with Zod. Production fails fast on unsafe config.
- Email: transactional provider through SMTP or an API (provider agnostic adapter), templates in Indonesian and English, SPF, DKIM, DMARC documented. Emails: verify account, advisor consent link and reminder, request received and decided, agreement signed, report outcome, appeal outcome, moderation notice. Respect notification preferences, except essential account and safety emails.
- Security: HTTPS only, HSTS, strict CSP with nonces, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection, secure cookies, CSRF protection for non Server Action routes, rate limits (login, signup, report, upload, synthesis, token endpoints), Cloudflare Turnstile (or equivalent) on guest forms and signup, password policy plus breach check if feasible, file downloads served as attachments with safe content types, upload scanning hook, dependency audit in CI.
- Privacy: data export (JSON) and account deletion (30 day grace, then delete or anonymize; keep attribution lines for existing agreements as "Pengguna lama" if needed and say so in the Privacy Policy), cookie use limited to essential cookies, optional privacy friendly analytics only with notice, data retention rules documented, AI processing disclosure with an opt-out ("Isi manual tanpa AI").
- Legal pages (drafts for campus review): Syarat dan Ketentuan, Kebijakan Privasi, Pedoman Komunitas, Perjanjian Atribusi (versioned), Kontak. Footer links on every page. Acceptance stored with version and timestamp. Admin can publish a new version and force re-acceptance.
- Reliability: error tracking (Sentry or equivalent), structured logs without personal data or file contents, uptime check, health endpoint, database backups with a tested restore, migrations through CI with a rollback note, feature flags for risky features, cost caps for LLM per user per day and globally per day.
- SEO and sharing: Indonesian metadata, sitemap, robots, Open Graph images, canonical URLs, structured data for public projects (not for held or hidden ones), `noindex` for staging and demo.
- Performance budget: LCP under 2.5 s on a mid range phone for Home and Explore, JS budget documented, images optimized, fonts preloaded and subsetted.
- Accessibility: WCAG 2.1 AA, keyboard complete, screen reader labels in Indonesian, contrast checks, reduced motion.
```

---

## R0: Audit and plan (no feature code)

```
Phase R0: audit and plan. Do not change application behavior in this phase.

Read CLAUDE.md including section 14, and the three prompt files in the repo docs if present. Then audit the current codebase against section 14.

Produce `docs/release-plan.md` containing:
1. A gap analysis table: each requirement in section 14 (accounts, access modes, state machines, reporting, i18n, motion, layering, production) with Current state, Gap, Files affected, Risk (low, medium, high), Effort (S, M, L).
2. A data migration plan for removing creator and adopter distinctions: tables and columns to change, how existing rows map to `project_members` and `project_access`, rollback plan, and tests. Include the RLS policies that must be rewritten.
3. A list of every hard coded English string location (counts per folder) so the i18n work is estimated.
4. A list of every `z-index`, `overflow: hidden` with positioned children, and fixed or sticky element, flagged where overlap is likely.
5. A competition compatibility check: what changes could conflict with the STACK handbook rules and how we avoid it (English availability, demo environment, final-day-start tag, README disclosure).
6. A phase order and branch plan for R1 to R9, with the checkpoints where I should review.
7. A short list of decisions you need from me (see the "Perlu Anda konfirmasi" items: team cap default, "kamu" or "Anda", no advisor path, email domain policy, data controller identity and PSE registration, hosting region). Propose a default for each.

Then stop and ask me to confirm. Do not start R1 until I answer.
```

---

## R1: Unified accounts and access model

```
Phase R1: one account type and the new access model.

Authorized to change the data model exactly as described in section 14.3, 14.4 and 14.5. Ask before anything else.

Do:
1. Migrations: remove the creator and adopter distinction from profiles; add `project_members` roles owner and co_owner with invitation status; add `project_access`; add `access_mode`, `max_active_adopters` and lifecycle values (draft, published, unpublished, archived) to projects; add `policy_acceptances`. Migrate existing data per docs/release-plan.md with a reversible script and a dry run report.
2. Rewrite RLS policies and database functions so authorization depends on relationships, not on a user role. Rules: owners manage their projects; anyone verified can take access in `open` mode after the agreement; in `by_request` mode access requires an approved request plus agreement; `paused` blocks new access; owners cannot take access to their own project; quota enforced by a function that counts active access.
3. Server logic: functions for take access, create request, approve, decline, withdraw, expire (scheduled job), revoke. Each writes lineage events and notifications.
4. Auth: email verification required before sharing or taking access; show a clear state for unverified accounts. Policy acceptance at signup.
5. Replace all role checks in the app with relationship checks. Rebuild `/dasbor` as the single dashboard described in 14.3. Add the first-run screen.
6. Tests: SQL and unit tests for every transition in 14.5 including quota full, own project, re-apply cooldown, expiry, revoke; and a Playwright test where the same account shares one project and continues another.

Acceptance:
- No code path references a creator or adopter account type.
- All transitions behave as specified and are covered by tests.
- Migration dry run passes on a copy of the seed data and can be rolled back.
Report using the working agreement.
```

---

## R2: Indonesian interface

```
Phase R2: full Indonesian interface with English switcher.

Do:
1. Install and configure `next-intl` per section 14.7: default `id`, `en` under `/en`, cookie persistence, `<html lang>`, metadata per locale, localized dates, numbers and relative times (WITA).
2. Extract every user-facing string into `messages/id.json` and `messages/en.json`, namespaced by feature. Write natural Indonesian using the glossary and the "kamu" tone (or "Anda" if I decided so). Do not translate proper names. Pluralization and interpolation through ICU messages.
3. Cover everything: pages, forms, validation errors, empty and error states, toasts, dialogs, emails, PDF agreement, notifications, 404 and 500 pages, accessibility labels, alt text, document titles, Open Graph text.
4. Language switcher in the nav and footer, keyboard accessible, shows "ID | EN".
5. CI script that fails when keys differ between locales, when a key is unused, or when a hard coded string appears in components (simple lint rule or script).
6. Copy review: produce `docs/copy-review.md` with the 30 most important strings (CTAs, errors, consent, agreement) and why they read well. Flag any string you are unsure about for me to review.

Acceptance:
- Switching to Indonesian leaves no English text except proper names and file type names. Switching to English leaves no Indonesian.
- Date and number formats follow the locale. Layout holds with longer Indonesian strings at 360 px.
- The CI check passes.
Report using the working agreement.
```

---

## R3: Design polish, animation, layering

```
Phase R3: design system v2.

Follow section 14.8 (motion) and 14.9 (layering) exactly. Keep the visual identity from the approved design (sky, glass, lime accent, soft cards, mono labels).

Do:
1. Replace all hand written dialogs, menus, popovers, tooltips, tabs, selects and toasts with Radix UI primitives wrapped in our UI kit. Render overlays in portals. Remove ad hoc z-index values and use the token scale.
2. Motion tokens and utilities in `src/styles/motion.css` (keyframes, durations, easing, stagger helpers), a `Reveal` component (IntersectionObserver, once), a `Floating` wrapper, a `CountUp` component with accessible final value, and a `usePrefersReducedMotion` hook. Add the `motion` library only if needed for wizard transitions.
3. Home: implement the required hero motion: floating cards with different durations, amplitudes, rotations and delays; drifting clouds; word by word headline; CTA hover glow and arrow nudge; scroll reveals; count up stats; subtle parallax; swaying meadow flowers. Reserve layout space so floating cards never touch the headline or CTAs. On phones show 3 cards.
4. Global interactions: card lift, button lift and press, chip scale, animated link underline, animated focus ring, tab and accordion transitions, skeleton shimmer, success check, toast and dialog animations.
5. UI tidy pass across all pages: consistent spacing scale, consistent card, table and form patterns, aligned grids, consistent icon size and stroke (Lucide), consistent empty and error states, readable line lengths, no orphan buttons, all status chips with text (never color alone).
6. Responsive pass at all test viewports. Mobile navigation as a drawer with focus trap. Sticky elements do not cover content. Bottom action bars have padding.
7. Build the Playwright overlap audit described in 14.9 and run it in CI on Home, Explore, Project, Wizard steps, Dashboard, Settings, Request pages, Admin pages, and the advisor page. Fix everything it finds.
8. Performance check: animations only on transform and opacity, paused off screen, CLS under 0.05, LCP under 2.5 s on a throttled mid range profile for Home and Explore. Record numbers in docs/performance.md.

Acceptance:
- Overlap audit passes on all viewports. No horizontal overflow anywhere.
- Reduced motion mode disables the loops and keeps the UI usable.
- Visual comparison screenshots saved in `docs/design/` for each key page at 390 and 1280 px.
Report using the working agreement.
```

---

## R4: Flow redesign (wizard, owner settings, access, requests)

```
Phase R4: the new user flows. Think about each screen's single primary action.

Follow 14.3 to 14.5.

Do:
1. Share wizard `/bagikan` in five steps with autosave and resume: (1) Info dasar, (2) Berkas (upload, or "Isi manual tanpa AI"), (3) Tinjau draf AI, (4) Tim dan akses, (5) Pratinjau dan terbitkan. Step 4 contains co-owner invitations, team consent, advisor consent (emailed link, resend, or the "no advisor" declaration path), and the access settings: mode (Terbuka dengan perjanjian, Dengan persetujuan), `max_active_adopters`. Right rail checklist "Syarat terbit" shows each requirement with a clear state and a link to fix it. Step 5 shows the exact public teaser and the effects of the chosen mode in plain words, then "Terbitkan" or "Simpan sebagai draf". Nothing is sent to the AI provider before team consent is recorded and the AI path is chosen.
2. Manual mode: a form to write summary, objectives, tasks, lessons with the same item cards, no evidence checks, marked "Diisi manual".
3. Project settings page `/proyek/[slug]/pengaturan` with all controls in 14.4, each change confirmed with a plain description of its effect, and audited in the project's history.
4. Teaser CTA logic that changes per state: guest, owner, open mode, by_request mode, paused, quota full, pending, approved but agreement not signed, already active. Add "Beri tahu saya" (watch) with a notification when mode or quota changes.
5. Access flows: open mode dialog (summary of the agreement, one checkbox, "Lanjutkan proyek ini", immediate access, owners notified); by_request form (tasks, plan, purpose, date, teammates); request status page; owner inbox with filters, decision with message templates, "Minta info" messages (simple thread, limited length), expiry reminders.
6. Agreement: per person acceptance, PDF in Indonesian and English, versioned, credit line to copy. Workspace with files, backlog, lineage, and the ability for access holders to mark backlog items "Dikerjakan" or "Selesai" which appears in the lineage.
7. Notifications: in app list plus email for essential events, preferences page, unread counts.
8. Empty states and onboarding hints that explain what to do next on every screen. Breadcrumbs. "Pratinjau sebagai pengunjung" button for owners.

Acceptance:
- Playwright tests for: share and publish in open mode; share in by_request mode and approve a request; paused; quota full; owner unpublishes and republishes; the same account does both roles; manual mode without AI; "no advisor" path.
- No screen has two competing primary buttons. Every status has an explanation.
Report using the working agreement.
```

---

## R5: Reporting, moderation, legal pages

```
Phase R5: reporting, moderation and policies.

Follow 14.6 and the legal items in 14.10.

Do:
1. Report flow: entry points on teaser, project menu and workspace. Modal with reason (with a one line description of each rule), required details, optional evidence link, bot check for guests, rate limits, confirmation with a reference code. "Laporan saya" page for signed-in reporters showing status. Duplicate grouping.
2. Automatic hold logic and settings: thresholds per reason, distinct reporter counting, rate limits, review target time and escalation alert. Neutral public notice for held projects. Tests including abuse cases (one person many reports, guests behind one IP).
3. Owner side: notification with the reason, a page showing the decision, and an appeal form (one open appeal per decision). Appeal outcome notifications.
4. Policy pages in both languages: Syarat dan Ketentuan, Kebijakan Privasi, Pedoman Komunitas, Perjanjian Atribusi, Kontak. Write solid drafts based on the product's real behavior (what data is collected, AI processing and the opt-out, retention, rights of access, correction, deletion, portability, and objection under Indonesia's personal data protection law, reporting and moderation, attribution duties, limits of liability phrased carefully). Mark clearly at the top of each draft: "Draf, belum ditinjau pihak berwenang" until I remove it. Do not claim legal compliance anywhere.
5. Policy versioning: `policies` table with version and effective date; acceptance at signup and forced re-acceptance flow when a new version is published.
6. Account privacy: data export (JSON of my data) and account deletion with a 30 day grace period and a clear explanation of what happens to my projects, access and attribution lines.

Acceptance:
- Tests: guest report, logged in report, threshold hold, dismiss, hide with reason, owner notified, appeal, restore, reporter anonymity (owner never sees reporter), data export content, deletion grace flow.
- Policy pages render in both languages and are linked in the footer and in forms.
Report using the working agreement.
```

---

## R6: Admin panel v2

```
Phase R6: admin panel v2. This replaces and extends PROMPTS_ADMIN.md. Reuse what already exists.

Admin principles stay: least privilege (no private file access except break glass), everything audited, reversible actions, reasons required, re-auth for sensitive actions.

Features:
1. Overview: queues with counts (new reports, held projects, appeals, no advisor spot checks, expired advisor links, failed synthesis, failed emails, pending requests older than 7 days), key numbers from SQL views (users, projects by status and moderation, access by mode, reports by reason and outcome, median time to publish), recent audit events.
2. Reports queue: filters, grouped duplicates, side panel with teaser preview, owners, history of the project and the owners' past moderation, decision area with reason templates (dismiss, hold, hide, remove), bulk dismiss of obvious spam, assign to me, internal notes, SLA timer based on the review target.
3. Appeals queue: shows the original decision and reason, owner message, decision (uphold, restore) with reason.
4. Projects: list and detail with lifecycle, moderation state, access mode and quota, active access count, evidence status counts (no private quotes), files metadata only, audit history. Actions: hold, hide, remove, restore. Break glass for private files with reason, re-auth, 5 minute signed URL, owner notification, banner.
5. Spot checks: queue for projects published through the "no advisor" path. Admin marks checked or escalates.
6. Users: search, detail (projects, access, reports made and received counts, verification state), suspend or restore with reason and optional end date, resend verification, force sign out. Admin cannot suspend self or demote the last admin.
7. Policies: manage versions (draft, publish, force re-acceptance), see acceptance rates.
8. Announcements: site wide banner with start and end time, severity, localized text, dismissible, never covering content (in flow).
9. Pipeline: synthesis runs, retry, cancel, caps, provider status, cost counters per day, per user quota overrides.
10. Email log: sent, failed, bounced with sanitized errors, resend for essential emails.
11. Settings: access (domains, registrations), limits (uploads, synthesis caps, token lifetime, request expiry, re-apply cooldown), moderation (hold thresholds, review target), display. Effective value plus source, reason on save, audit before and after.
12. Trials and metrics: onboarding trial sessions with baseline and ESTAFET cohorts, median and mean, share within 30 minutes, n shown, "too few sessions" note under 5 per cohort, CSV export without identifiers, demo rows excluded by default.
13. Audit log: filters, diff view, CSV export, append only.
14. Admin UX: global search with `/`, keyboard shortcuts with `?` help, saved filters in the URL, density toggle, Undo toasts, consistent DataTable, everything in Indonesian with an English option.

Acceptance:
- Every admin mutation writes an audit row (a test runs each action and counts).
- A non admin gets 404 on every admin route and is rejected by every admin function.
- Playwright smoke: handle a report end to end, handle an appeal, publish an announcement, change a setting, break glass with notification.
- Overlap audit passes on admin pages.
Report using the working agreement.
```

---

## R7: Production readiness

```
Phase R7: infrastructure and hardening. Follow 14.10 line by line.

Do:
1. Environment config validated at boot with Zod. Production refuses `LLM_PROVIDER=mock` and `SEED_DEMO=true`. Separate Supabase projects and Vercel environments for staging and production. Demo environment documented separately.
2. Email adapter with templates in Indonesian and English for every email listed in 14.10, preview route for templates in non production, retries, failure logging. Document SPF, DKIM and DMARC steps.
3. Security headers and CSP with nonces, secure cookies, rate limiting for sensitive endpoints, Turnstile (or equivalent) on guest forms and signup, upload safety (magic bytes, ZIP limits, secret scan), safe downloads, dependency audit in CI, secret scanning in CI.
4. Scheduled jobs: request expiry, advisor link expiry reminders, account deletion after the grace period, hold review escalation, daily cost cap reset. Use Supabase cron or Vercel cron, documented.
5. Observability: error tracking, structured logs without personal data or file contents, health endpoint, uptime check instructions, alert rules (error spike, failed emails, failed synthesis rate, cap reached).
6. Backups: enable database backups, write and TEST a restore procedure, document in `docs/runbook.md`.
7. SEO and sharing: sitemap, robots, canonical URLs, Open Graph images, structured data for public projects, `noindex` on staging and demo, Indonesian metadata.
8. Cost control: per user and global daily limits for synthesis, with friendly messages when reached.
9. Documentation: `docs/runbook.md` (deploy, rollback, incident steps, who to contact), `docs/security.md`, `docs/privacy-data-map.md` (what data, where, who processes it, retention), `docs/operations-checklist.md`.

Acceptance:
- A clean deploy to staging works from the README. Production boot refuses unsafe config (tested).
- Security header scan shows no high severity gaps; rate limits tested; restore procedure verified on staging.
- No secrets in repo or history.
Report using the working agreement.
```

---

## R8: Quality gate

```
Phase R8: full quality pass before any user touches it.

Do:
1. End to end tests (Playwright) for all flows in R4 and R5 and the admin flows in R6, in Indonesian and a smoke subset in English.
2. Overlap audit and visual screenshots at all six viewports for every key route. Fix all findings.
3. Accessibility: axe on every page, keyboard only walkthrough of the share wizard, access flows and report flow, screen reader labels checked in Indonesian. Target Lighthouse accessibility at least 95.
4. Performance: Lighthouse on Home, Explore, Project page, wizard; record numbers; fix regressions. Test with a throttled mid range phone profile.
5. Security review: authorization tests for every route and server action (user A cannot touch user B's data; guests; suspended users; unverified users; revoked access), IDOR checks, file download authorization, token endpoints, rate limits.
6. Load test: simulate a realistic peak (for example 200 concurrent browsers on Explore and 20 uploads) on staging; record results and bottlenecks.
7. Content review: read every Indonesian string in context, fix awkward phrasing, check consistency with the glossary, check that no placeholder or English leftovers remain. Produce `docs/qa-report.md` with results, open issues and severity.

Acceptance:
- No open issue of high severity. All medium issues either fixed or listed with an owner and date.
- QA report committed.
Report using the working agreement.
```

---

## R9: Launch

```
Phase R9: staged launch. Do not go public until I explicitly confirm each stage.

Stage A: staging sign off
- Run the full QA checklist on staging. Confirm legal drafts have been reviewed by the campus (I will tell you). Remove the "Draf" banners only when I confirm.
- Confirm the PSE registration question and the data controller identity are resolved (I will tell you).

Stage B: private beta
- Enable `registrations_open` with an invitation list or an allowed domain (as I decide), target 20 to 50 users.
- Seed real content only through real owners who consented. No demo data in production.
- Add a visible feedback button and a short in app survey. Monitor errors, reports, email delivery and AI cost daily. Produce a daily summary file in `docs/beta-log.md`.

Stage C: public launch
- Open registrations. Publish the announcement banner. Confirm uptime checks and alerts. Keep a rollback plan ready (previous deployment, migration rollback notes).

After launch (first two weeks)
- Daily check of the admin overview. Weekly report of users, projects, access, reports, and median time to understand from trials. Fix top issues. Keep the README Status table and the AI assistance disclosure current.

Rules:
- Every stage ends with a go or no go checklist that I answer.
- Never claim a metric you did not measure. Label small samples as such.
Report using the working agreement.
```

---

## Final Day guard (paste before any competition work)

```
STACK 2026 guard. Before doing anything, read the handbook summary in CLAUDE.md section 2 and 14.2.

Confirm: (1) the English language switcher works and the demo environment is available with demo data and mock mode, (2) the README in English lists what is done and what is planned, with the AI assistance disclosure, (3) the commit tagged final-day-start exists, (4) the declared Final Day tasks are still unfinished and traceable.

If any item fails, fix or report it. Do not present planned features as completed.
```
