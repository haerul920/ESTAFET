# ESTAFET release plan (phase R0: audit and plan)

Status: **draft for owner review**. No application behavior was changed in R0. The only edits are `CLAUDE.md` (section 14 appended, as step 1 of `PROMPTS_RELEASE.md`) and this file.

Audit date: 2026-11-20. Audited commit: `964d2e9` ("first commit"), branch `main`.

How this audit was done: I read both migrations, the auth, proxy, settings, report and LLM code, the home hero, the teaser, the nav and the admin shell, and ran searches over `src/`, `tests/` and `supabase/`. The string, `z-index` and role counts come from searches and a small counting script, so they are **estimates** (see section 3). Baseline run: `pnpm check` (ESLint, `tsc --noEmit`, 80 Vitest unit tests) **passes**. I did **not** run `pnpm test:db` or `pnpm test:e2e` (they need the local Supabase stack), so the status of those suites is unknown.

---

## 0. Ringkasan untuk pemilik proyek (bahasa Indonesia)

**Temuan utama**

1. **Kolom peran di `profiles` sudah tidak ada.** Peran sudah per proyek lewat `project_members.role` (`creator` atau `adopter`). Jadi bagian "hapus kolom peran dari profiles" di 14.3 sudah terpenuhi. Pekerjaan sebenarnya: mengganti model *permintaan lalu terbuka* menjadi model akses (`project_access`, mode `open` / `by_request` / `paused`, kuota), dan mengganti kata "creator/adopter" di sekitar 178 tempat di 41 berkas `src/` dan 93 tempat di 6 berkas tes.
2. **Bagian paling berisiko adalah status proyek.** Sekarang ada `awaiting_advisor`, `verifying`, `adopted`. Status `adopted` membuat proyek tidak bisa menerima permintaan lagi (fungsi `create_continuation_request` hanya menerima `published`). Itu bertentangan dengan kuota tim penerus di 14.4. Status ini harus dipecah (R1).
3. **Hampir semua isi 14.7 sampai 14.10 belum ada:** antarmuka berbahasa Indonesia, Radix, pemeriksaan tumpang tindih, header keamanan/CSP, email, halaman legal, ekspor dan penghapusan data, CI, sitemap/robots, health check, pelacakan error.
4. **Verifikasi email belum ditegakkan.** Konfigurasi lokal `enable_confirmations = false` dan tidak ada kode yang memeriksa status verifikasi sebelum membagikan atau mengambil akses.
5. **Repo hanya punya satu commit dan belum ada tag `final-day-start`.** README masih menulis "repository was not under git". Ini harus dibereskan sebelum pekerjaan R1 menyentuh model data (lihat keputusan D1).
6. **Aman untuk produksi: belum.** `LLM_PROVIDER` bawaannya `mock` bila kosong, banner "Demo environment" tampil untuk semua lingkungan lewat pengaturan, dan tidak ada validasi konfigurasi saat boot.

**Yang perlu Anda putuskan** ada di bagian 7 (enam butir dari prompt, ditambah D1 sampai D8 yang saya temukan). Setiap butir sudah ada usulan bawaan, jadi Anda cukup menjawab "setuju" atau mengganti.

**Catatan jujur:** saya tidak membaca handbook STACK secara langsung. Pemeriksaan kompatibilitas kompetisi di bagian 5 bersandar pada ringkasan di `CLAUDE.md` bagian 2 dan ringkasan di `PROMPTS_RELEASE.md`. Catatan hukum di `PROMPTS_RELEASE.md` (UU PDP, Permen Kominfo 5/2020) saya perlakukan sebagai catatan dari Anda, bukan sesuatu yang saya verifikasi ulang, dan bukan nasihat hukum.

---

## 1. Gap analysis

Legend. Risk: low, medium, high. Effort: S (under a day), M (1 to 3 days), L (more than 3 days). Effort is a rough size, not a promise.

### 1.1 Principles and competition compatibility (14.1, 14.2)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| No demo data, no mock AI in production | `supabase/seed.sql` seeds demo rows. `getConfig()` falls back to `mock` when `LLM_PROVIDER` is unset or unknown. `show_demo_banner` defaults to `true`. | Unsafe defaults. Nothing stops production from running mock mode or showing the demo banner. | `src/lib/llm/index.ts`, `src/lib/settings-core.ts`, `src/app/layout.tsx`, `supabase/seed.sql` | high | S |
| Production refuses `LLM_PROVIDER=mock` and `SEED_DEMO=true` | No boot validation. `environmentName()` only picks a badge. `SEED_DEMO` is read only by `scripts/seed-admin.ts`. | Add a Zod env module checked at boot (`instrumentation.ts`). | new `src/lib/env.ts`, `instrumentation.ts`, `scripts/lib/env.ts` | high | S |
| Separate `demo` environment | Demo = whatever the local stack runs. Four env names exist only as `LOCAL/STAGING/PRODUCTION` for the admin badge. | Define four environments (local, demo, staging, production), per-environment config, demo badge text "Data contoh", `noindex`. | `src/lib/admin/env.ts`, `.env.example`, docs | medium | M |
| Default UI language Indonesian, English available | All UI English. `<html lang="en">` hard coded. | Whole of R2. | everything under `src/` | high | L |
| Tag `final-day-start`, README honest | One commit, no tags. README says the repo was not under git. | Fix README, decide when to tag (D1). | `README.md` | high | S |
| `README.id.md` | Missing. | Write it (R2 and R9). | new | low | S |
| README AI disclosure current | `docs/ai-disclosure.md` exists. Not re-checked for currency. | Update at every phase. | `docs/ai-disclosure.md`, `README.md` | low | S |

### 1.2 Accounts and relationships (14.3)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| No role column on `profiles` | **Already true.** Verified in `20261119000001_schema.sql` (no role column). `is_admin` exists. | None for `profiles`. The creator/adopter distinction lives in `project_members.role`, request ownership and UI wording. | n/a | low | n/a |
| `project_members(role owner/co_owner, status invited/active/left)` | Enum `member_role = (creator, adopter)`. No `status`. Teammates are added immediately by `add_team_member` (no confirmation). Adopter rows are inserted at unlock. | New roles and status, invitation by email with confirmation, ownership transfer with confirmation. | migration, `src/lib/db/creator.ts`, `src/components/features/wizard/ConsentStep.tsx` | high | L |
| `project_access` table | Missing. Access is derived from `continuation_requests` + `agreement_acceptances` through `has_unlocked()`. | New table, new unlock rule, backfill. | migration, `src/lib/db/access.ts`, `src/app/projects/[slug]/workspace/page.tsx`, download route | high | L |
| A person cannot take access to their own project | `create_continuation_request` blocks creators. | Re-implement for owners and co-owners in the new functions. | SQL | medium | S |
| Email verification before sharing or taking access | `[auth.email] enable_confirmations = false`. No code reads `email_confirmed_at`. Signup action already copes with "no session". | Turn on confirmations, add an `is_verified` check in the SQL functions and the UI state "Email belum diverifikasi". Needs an email provider (14.10). | `supabase/config.toml`, `src/app/actions/auth.ts`, `src/lib/auth.ts`, SQL | high | M |
| Terms and Privacy acceptance, versioned (`policy_acceptances`) | Missing. | Table, signup checkbox, force re-acceptance flow (R5). | migration, `src/components/features/AuthForm.tsx` | medium | M |
| First-run screen "Apa yang ingin kamu lakukan?" | Missing. | Small page, not stored as a role. | new route | low | S |
| `/dasbor` single view, two sections | `/dashboard` has tabs "My projects", "My requests", "Notifications" and tiles. | Rebuild as two sections, no tab/role switch. Notifications move to their own page. | `src/components/features/Dashboard.tsx`, `src/lib/db/dashboard.ts`, `src/app/dashboard/page.tsx` | medium | M |

### 1.3 Owner project settings and state machines (14.4, 14.5)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| Settings page `/proyek/[slug]/pengaturan` | None. | New page, all controls, audited history. | new | medium | L |
| `access_mode` open / by_request / paused | Missing. Only "request then approve". | Column, functions, CTA logic per state (R4). | migration, `src/app/projects/[slug]/page.tsx`, `TeaserContent.tsx` | high | L |
| `max_active_adopters` 1 / 3 / unlimited, "Beri tahu saya" | Missing. `adopted` status ends all further requests. | Quota function counting active access, watch list table, notifications. | migration, SQL | high | M |
| Lifecycle `draft -> published <-> unpublished -> archived` | Enum is `draft, awaiting_advisor, verifying, published, adopted, archived`. No `unpublished`. | Replace enum (type recreation, see section 2). `awaiting_advisor`, `verifying` become derived from consent and item state. `adopted` becomes derived from active access. | migration, every `status in (...)` filter (views, queries, tests) | high | L |
| Publish rule (14.5) | `publish_project` checks advisor approved, all members consented, no pending items, one kept item. | Add "no advisor" declaration path, current policy acceptance, `unpublish` and `republish`. | SQL | medium | M |
| Moderation `ok -> held -> hidden -> removed` | Enum is `ok, hidden, removed`. | Add `held` and review target. Admin functions and views must handle it. | migration, admin SQL, `src/app/admin/*` | medium | M |
| Request states with expiry (30 days), re-apply after 7 days | States `pending, approved, declined, withdrawn`. No expiry, no cooldown. | Add `expired`, `expires_at`, cooldown from `decided_at`, a scheduled job. | SQL, new cron | medium | M |
| Access revoke with reason | None. | New function plus notifications and lineage. | SQL, workspace UI | medium | M |
| Team requests: per-person agreement | One creator and one adopter acceptance unlocks the whole request (README known limitation). | Per person. Teammates need accounts. | SQL, `RequestReview.tsx` | medium | M |
| Request page for visitors in `open` mode | Missing. | Dialog with agreement summary and one checkbox. | new component | medium | M |

### 1.4 Reporting and moderation (14.6)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| Reasons: copyright, personal_data, false_information, inappropriate, false_ownership, harmful_file, spam, other | Enum `copyright, personal_data, inaccurate, inappropriate, other`. | Rename `inaccurate` to `false_information`, add three values. | migration, `src/app/actions/reports.ts`, `ReportProject.tsx` | low | S |
| Guests pass a bot check | None. IP-hash rate limit (5 per hour) exists via `check_rate_limit`. | Turnstile (or equivalent) on guest forms. | `reports.ts`, new component | medium | M |
| Reference code, "Laporan saya", duplicate grouping | Missing. | Columns, page, grouping view. | migration, new page | medium | M |
| Automatic hold on thresholds, distinct reporters | Missing. | Trigger or function, settings keys, escalation job. | SQL, settings | high | M |
| Written reason on every decision, owner gets reason and appeal link | Reasons (15+ chars) and owner notification exist for hide/remove/restore (`apply_moderation`). | Add `held` and dismiss notifications, appeal link. | SQL | medium | S |
| Appeals (one open per decision) | Missing. | Table, owner form, admin queue (R5, R6). | migration, new pages | medium | M |
| Reporter identity never shown to owners | Owners cannot read `reports` (admin-only RLS). | Keep it so. Also keep reporter id out of owner-facing notifications. Add a test. | tests | low | S |
| "Pedoman Komunitas" linked from every report form | No legal pages at all. | R5. | new pages | low | M |

### 1.5 Language and copy (14.7)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| `next-intl`, default `id`, `/en` prefix only for English, cookie | Not installed. | Install, restructure routing. | `src/app/*`, `src/proxy.ts`, `next.config.ts` | high | L |
| No hard coded strings, CI key check | None. | Extraction (about 1,000 strings, section 3) plus CI script. | all | high | L |
| `id-ID` formats, WITA with absolute time on hover | Admin already formats WITA (`src/lib/admin/time.ts`). Public pages do not. | Extend to public and email. | `src/lib/admin/time.ts` and callers | low | S |
| Glossary and "kamu" tone | None. | Apply during extraction. | messages | low | M |

### 1.6 Motion (14.8)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| Tokens, CSS-first animation | `framer-motion ^14.14.0` drives `Reveal`, `Stagger`, `Float`, `Cloud`, `CountUp`, `AnimatedBar` from `src/components/ui/motion.tsx`. One `@keyframes shimmer` in `globals.css`. | The spec prefers CSS keyframes for looping effects and says "no JS driven per frame animation". Check what the current floats and clouds actually run on (JS or Web Animations) and move loops to CSS. | `src/components/ui/motion.tsx`, `HomeHero.tsx`, `globals.css` | medium | M |
| Hero: floating cards (6 to 9 s, 8 to 16 px, rotation), word-by-word headline, flowers sway, parallax | Some exist (clouds, headline reveal, count-up). Not verified against the numbers in 14.8. | Compare against spec, fill gaps. | `HomeHero.tsx`, `MeadowCta.tsx`, `(public)/page.tsx` | medium | M |
| `prefers-reduced-motion` | `Providers.tsx` uses framer's reduced-motion setting. `globals.css` has a media query. | Cover the new CSS loops. | CSS | low | S |
| Pause off screen and when `document.hidden` | Not implemented for loops. | IntersectionObserver toggle. | new hook | low | S |
| `motion` library only for orchestrated reveals | `framer-motion` is already the dependency. | Keep `framer-motion`, do not add `motion` (decision D6). | `package.json` | low | S |

### 1.7 Layering (14.9)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| z-index token scale only | Ad hoc values: `z-10`, `z-20`, `z-30`, `z-40`, `z-50`, `z-[60]`, `z-[70]` (section 4). | Replace with tokens. | 11 places | medium | S |
| Radix primitives in portals | Not installed. Menus, dialogs, toasts, tabs are hand written (`GlassNav`, `ReasonDialog`, `AdminShell`, `Toast`, `SegmentedTabs`). | Replace and wrap in the UI kit. | `src/components/ui/*`, `src/components/admin/*` | high | L |
| No popovers inside `overflow: hidden` | `GlassNav` is rendered inside `SkyStrip`, which is `overflow-hidden` (section 4). | Likely clips the account menu. Fix with a portal. | `SkyStrip.tsx`, `GlassNav.tsx` | high | S |
| System banners push content down | `BreakGlassBanner` is `fixed top-0 z-[70]`, overlaying the admin header. | Move into flow. | `BreakGlassBanner.tsx`, `AdminShell.tsx` | medium | S |
| Playwright overlap audit in CI | None. There is no CI at all (`.github/` absent). Existing Playwright: core flow, admin, axe (2 + 3 + 2 tests). | Build it (R3) and the CI workflow. | `tests/e2e/`, `.github/workflows/` | medium | M |

### 1.8 Production requirements (14.10)

| Requirement | Current state | Gap | Files affected | Risk | Effort |
|---|---|---|---|---|---|
| Env validated with Zod at boot | None. | R7. | new | high | S |
| Transactional email | None (README: "Email delivery: Planned"). Local Supabase email limit is 2 per hour. | Adapter, templates (id and en), SPF/DKIM/DMARC docs. Blocks email verification, advisor reminders, notifications. | new `src/lib/email/` | high | L |
| Security headers, CSP with nonces | `next.config.ts` has none. | R7. | `next.config.ts`, `src/proxy.ts` | high | M |
| Rate limits | DB-backed limiter exists (`check_rate_limit`) and is used for reports and the advisor endpoint. Synthesis has a per-user daily cap setting. | Add login, signup, upload, token endpoints. | actions, routes | medium | M |
| Bot check on guest forms and signup | None. | R7. | forms | medium | M |
| Uploads: magic bytes, size, ZIP safety, secrets scan | Done (README, `src/lib/ingest/*`, unit tested). | Add scanning hook, safe download headers check. | `src/lib/ingest`, download route | low | S |
| Data export and account deletion (30-day grace) | None. | R5. | new | high | L |
| Legal pages, versioned acceptance | None. Footer exists. | R5. | new | high | M |
| Error tracking, structured logs, health endpoint, uptime | None. Logs not audited. | R7. | new | medium | M |
| Backups with tested restore | Local stack only. | Needs a real project first (D6). | docs | high | M |
| Cost caps (per user and global per day) | Per-user cap exists. No global cap. | Add global cap. | `src/lib/synthesis.ts`, settings | medium | S |
| SEO: sitemap, robots, OG, canonical, structured data, `noindex` on staging/demo | None of these files exist. | R7. | new | low | M |
| Performance budget (LCP 2.5 s) | Not measured. | Measure in R3 and R8. | n/a | medium | S |
| Accessibility WCAG 2.1 AA | Semantic HTML, focus ring, reduced motion built in. axe runs in `tests/e2e/a11y.spec.ts`. README says no Lighthouse run and no screen-reader pass has been done. | R8. | n/a | medium | M |
| Live AI path | README: "Partial: not tested live". | Must be run against the real provider before beta. | `src/lib/llm/*` | high | S |
| CI: tests, audit, dependency and secret scan | No CI. | Create in R1 (see D8). | `.github/workflows/` | medium | S |

---

## 2. Data migration plan (remove the creator/adopter distinction)

### 2.1 What actually changes

`profiles` has no role column, so there is nothing to drop there. The model change is:

| Object | Today | Target |
|---|---|---|
| `project_members.role` | enum `member_role (creator, adopter)` | enum `(owner, co_owner)` plus new `status (invited, active, left)` |
| Adopter membership | row with `role = 'adopter'` inserted by `accept_agreement` at unlock | removed from `project_members`, expressed as `project_access` |
| Access to private files | `has_unlocked(pid)` derived from request + two acceptances | `project_access` row with `status = 'active'` |
| `projects.status` | `draft, awaiting_advisor, verifying, published, adopted, archived` | `draft, published, unpublished, archived` |
| Agreement acceptance | `agreement_acceptances(request_id, side creator or adopter)` | `project_access.agreement_version / accepted_at`. Keep `agreement_acceptances` for history and the PDF, add nullable `access_id` |

New: `project_access`, `policies`, `policy_acceptances`, `access_watchers` (for "Beri tahu saya"), `report_appeals`, `moderation_decisions`, plus columns `projects.access_mode`, `projects.max_active_adopters`, `projects.advisor_mode`, `projects.no_advisor_declared_at`, `continuation_requests.expires_at`, `reports.reference_code`.

### 2.2 Row mapping

1. **Owner.** For each project, the `project_members` row where `profile_id = projects.created_by` and `role = 'creator'` becomes `owner`. Every other `creator` row becomes `co_owner`. All migrated rows get `status = 'active'` and keep `consented_at`.
2. **Adopters.** For each `continuation_requests` row where `request_unlocked(id)` is true, create `project_access` for the requester and for each teammate who has an account (matched by email) **only if they accepted**. Teammates who did not accept do not get access, which matches today's behavior only partly (today, a teammate's access follows the request). I need your confirmation (D5). Fields: `source = 'approved_request'`, `agreement_version` and `accepted_at` from `agreement_acceptances`, `request_id`. Then delete the `role = 'adopter'` rows.
3. **Pending and approved-but-unsigned requests.** Stay in `continuation_requests` untouched. Requests older than 30 days get `expires_at` set to `now() + 30 days` on migration so nothing expires the moment it deploys.
4. **Project status.** `draft`, `awaiting_advisor`, `verifying` become `draft`. `published` and `adopted` become `published`. `archived` stays. "Awaiting advisor" and "verifying" are recomputed from `advisor_consents` and `draft_items` for the wizard and the owner dashboard. "Adopted" is shown as "Sedang dilanjutkan" when an active access row exists.
5. **Access mode.** Every migrated project gets `access_mode = 'by_request'` (today's behavior) and `max_active_adopters = 3` (pending D2).
6. **Advisor.** Projects with an approved consent keep it. Others keep `advisor_mode = 'advisor'`. The "no advisor" path is new and applies only to new projects.
7. **Policies.** Migrated users have not accepted any policy. They are forced to accept on their next sign-in (no backfilled acceptance, because that would be a fabricated record).
8. **Lineage.** Not touched (append-only trigger). New lineage types are added in a separate, earlier migration (`ALTER TYPE ... ADD VALUE` cannot be used in the same transaction that uses the value).
9. **Demo seed.** `supabase/seed.sql` and `supabase/setup-all.sql` are rewritten for the new model so the demo environment keeps working.

### 2.3 Order of migrations

1. `r1_01_enum_additions.sql`: add enum values only (`lineage_type`, `moderation_status.held`, `request_status.expired`, report reasons).
2. `r1_02_new_tables.sql`: new tables, new columns, backups (`_bak_project_members`, `_bak_projects_status`).
3. `r1_03_backfill.sql`: the row mapping above, wrapped in a transaction, with counts printed.
4. `r1_04_functions_rls.sql`: new functions, policies, views, grants.
5. `r1_05_cutover.sql`: recreate `project_status` and `member_role` types and swap columns. Only after the app code is deployed.

### 2.4 Dry run and rollback

* **Dry run.** A script (`scripts/migrate-r1-dry-run.ts`) runs steps 1 to 4 inside a transaction on a copy of the seed data (and later a copy of staging), prints a report (rows per table before and after, owners per project, access rows per unlocked request, projects without an owner = must be 0), then rolls back.
* **Rollback.** Down scripts restore from the `_bak_*` tables and recreate the old enums. Valid until the first production write after cutover. After that the policy is forward-fix, with a `pg_dump` taken immediately before cutover. Postgres cannot drop enum values, which is why steps 1 and 5 are split.
* **Tests.** SQL tests (`tests/db`) for: every project has exactly one owner; every previously unlocked request has a matching active access row; no `adopter` rows remain; lineage row count unchanged; public views return the same set of projects before and after; plus one test per transition in 14.5 (open, by_request, paused, quota full, own project, re-apply cooldown, expiry, revoke).

### 2.5 Policies, functions and views that must be rewritten

**Helper and rule functions (all reference `role = 'creator'` or the request-based unlock):** `is_project_creator`, `is_project_member`, `project_is_editable`, `is_request_team`, `can_see_request`, `request_unlocked`, `has_unlocked`, `can_read_private`, `add_team_member`, `remove_team_member`, `confirm_team_consent`, `issue_advisor_consent`, `decide_advisor_consent`, `publish_project`, `create_continuation_request`, `decide_request`, `ask_request_question`, `withdraw_request`, `accept_agreement`, and the triggers `projects_after_insert`, `block_moderated_request`, `block_suspended_actor`.

**RLS policies (base schema):** `projects_select_member`, `projects_update_creator`, `projects_insert`, `members_select`, `consents_select`, `files_select`, `runs_select`, `items_select`, `items_insert_creator`, `items_update_creator`, `requests_select`, `acceptances_select`, `lineage_select`. The column grants on `projects` and `draft_items` also need a review (new editable columns, status moves only through functions).

**Public views:** `public_project_teaser`, `public_teaser_items`, `public_project_lineage` (all filter `status in ('published','adopted')`).

**Admin side:** `apply_moderation` and `admin_break_glass` (notify `role = 'creator'`), `admin_projects_v` and `admin_users_v` (count creators), `admin_project_detail`, `admin_user_detail`, `admin_requests_v` (uses `request_unlocked`), `admin_overview` (`projects_by_status`), `admin_purge_demo`.

**App code that reads the role:** `src/lib/db/creator.ts`, `src/lib/db/requests.ts`, `src/lib/db/dashboard.ts`, `src/lib/db/access.ts`, `src/lib/synthesis.ts`, `src/app/projects/[slug]/workspace/page.tsx`, `src/app/requests/[id]/page.tsx`, `src/components/features/RequestReview.tsx` (15 hits), `src/lib/agreement/pdf.tsx` (15 hits), `src/lib/agreement/terms.ts`, `src/app/api/requests/[id]/agreement/route.ts`. Tests: `tests/db/rules.test.ts` (40 hits), `tests/e2e/core-flow.spec.ts` (31 hits), `tests/db/admin.test.ts`, `tests/e2e/admin.spec.ts`.

---

## 3. Hard coded user-facing strings

Method: a counting script over `src/**/*.ts(x)` that matches JSX text nodes, text attributes (`placeholder`, `aria-label`, `title`, `alt`, `label`, `description`, `hint`), and string values for keys such as `error`, `message`, `label`, `title` and Zod messages. **It undercounts** multi-line JSX text, template strings and object maps (for example `src/lib/labels.ts`), so treat the total as a lower bound. I expect roughly **1,000 to 1,500** strings to extract.

| Folder | Files | JSX text | Text attributes | String literals | Notes |
|---|---:|---:|---:|---:|---|
| `src/app/(public)` | 4 | 37 | 1 | 21 | Home, Explore, teaser |
| `src/app/(auth)` | 2 | 2 | 0 | 2 | |
| `src/app/actions` | 5 | 0 | 0 | 48 | Validation and error messages |
| `src/app/api` | 8 | 0 | 0 | 23 | Route error messages |
| `src/app/admin` | 17 | 90 | 72 | 167 | Largest block |
| `src/app/consent`, `dashboard`, `projects`, `requests`, `share`, `suspended`, `layout`, `not-found`, `error` | 12 | 54 | 9 | 24 | |
| `src/components/features` | 22 | 169 | 64 | 12 | Wizard, dashboard, request review |
| `src/components/admin` | 17 | 68 | 34 | 21 | |
| `src/components/ui` | 15 | 11 | 4 | 5 | |
| `src/lib/*` and `src/proxy.ts` | 50 | 19 | 0 | 54 | Includes `agreement/pdf.tsx` (11 JSX), settings, synthesis, ingest, db |
| **Total** | **152** | **450** | **184** | **377** | about 1,011 candidates |

Not covered by the count and still needing translation: `src/lib/labels.ts` (enum labels), `src/lib/agreement/terms.ts` (the agreement text), `src/lib/llm/mock.ts` and `prompts.ts` (mock fixtures; the live prompt stays English and the output language is a separate decision, D7), `supabase/seed.sql` (demo content, can stay English in the demo environment), Supabase Auth email templates, every Playwright assertion that matches English text (`tests/e2e/*`), and the docs.

About 45% of the candidates (about 450) are in the admin area. Per R6 the admin UI must also be Indonesian with an English option.

---

## 4. Layering inventory

Flags: **likely** = I expect an overlap or clipping bug but have not reproduced it (the overlap audit in R3 will confirm), **ok** = no problem expected, **spec** = violates a rule in 14.9 on paper.

### 4.1 `z-index` and stacking

| Location | What | Value | Flag |
|---|---|---|---|
| `src/app/layout.tsx:46` | Skip link, shown on focus | `fixed z-50` | ok (becomes a token) |
| `src/components/ui/GlassNav.tsx:67` | Glass nav pill | `relative z-20` | ok |
| `src/components/ui/GlassNav.tsx:85` | Nav link label | `relative z-10` | ok |
| `src/components/ui/GlassNav.tsx:136` | Account menu (hand written, `role="menu"`) | `absolute z-30`, 240 px wide | **likely clipped** by `SkyStrip` `overflow-hidden` (the strip leaves 64 px of bottom padding, the menu is taller) |
| `src/components/admin/AdminShell.tsx:118` | Global search results | `absolute z-40` inside a header with blur | **likely** trapped in the header's stacking context |
| `src/components/admin/AdminShell.tsx:212` | Sticky admin header | `sticky top-0 z-30` with translucent blur | spec (stacking context for the search dropdown) |
| `src/components/admin/AdminShell.tsx:238` | Mobile sidebar overlay | `fixed inset-0 z-50` | spec (hand written, focus trap not verified) |
| `src/components/admin/AdminShell.tsx:261` | Shortcuts dialog | `fixed inset-0 z-50` | spec (same layer as the drawer) |
| `src/components/admin/ReasonDialog.tsx:156` | Reason dialog | `fixed inset-0 z-50` | spec |
| `src/components/admin/Toast.tsx:39` | Toasts | `fixed bottom-4 right-4 z-[60]` | spec (no safe-area padding, would sit under a mobile bottom bar) |
| `src/components/admin/BreakGlassBanner.tsx:16` | Emergency access banner | `fixed inset-x-0 top-0 z-[70]` | **likely overlap**: covers the sticky admin header (`z-30`). Rule 14.9 says banners push content down |

### 4.2 `overflow: hidden` around positioned or interactive children

| Location | Container | Risk |
|---|---|---|
| `src/components/ui/SkyStrip.tsx:6` | Header that wraps `SiteNav` | **likely**: clips the account menu (see above) |
| `src/components/features/HomeHero.tsx:39` | Hero `relative min-h-[900px] overflow-hidden` | **likely**: floating cards and clouds may be cut at narrow widths, and the hero has no reserved layout space for the cards (14.9 requires it) |
| `src/components/features/HomeHero.tsx:83` | Card strip `overflow-hidden` inside the hero | possible clipping of float amplitude |
| `src/components/features/HomeHero.tsx:12` | Word-reveal wrapper `overflow-hidden pb-[0.08em]` | clips descenders if the padding is too small, check in Indonesian text |
| `src/app/(public)/page.tsx:68`, `:147`, `:186` | Bento and CTA cards | ok unless a popover is added inside |
| `src/components/features/MeadowCta.tsx:31` | Meadow section | ok (decorative) |
| `src/app/consent/[token]/page.tsx:19` | Advisor page header | ok |
| `src/components/features/Dashboard.tsx:25`, `src/components/ui/Stepper.tsx:28`, `src/components/ui/motion.tsx:134` | Progress bars | ok |
| `src/components/features/wizard/ConsentStep.tsx:85` | Accordion panel | ok |
| `src/components/features/ReportProject.tsx:25` | Report form, animates `height` | spec: 14.8 forbids layout-shifting animation (CLS) |
| `src/components/admin/DataTable.tsx:55` | `overflow-x-auto` wrapper | the `sticky top-0` header cells stick to the wrapper, not the page, so they do nothing (not an overlap, but misleading) |

### 4.3 `fixed` and `sticky`

| Location | Element | Flag |
|---|---|---|
| `AdminShell.tsx:202` | Sidebar `sticky top-0 h-screen overflow-auto` | ok on desktop. Check mobile Safari (`100vh`) |
| `AdminShell.tsx:212` | Header `sticky top-0 z-30` | anchor targets need `scroll-margin-top` (14.9) |
| `src/components/features/wizard/VerifyBoard.tsx:341` | Source viewer `sticky top-4` | **likely** overlap with a sticky nav if one is added; today the public nav is not sticky |
| `BreakGlassBanner.tsx`, `ReasonDialog.tsx`, `Toast.tsx`, `AdminShell.tsx:238/261`, `layout.tsx:46` | Overlays | see 4.1 |

Also: no `env(safe-area-inset-bottom)` anywhere in `src/`, and the root layout puts a "Demo environment" banner in flow (good) but its text is English and it follows a setting, not the environment.

---

## 5. Competition compatibility check

Source of truth I had: `CLAUDE.md` section 2 and section 14.2, and the owner's summary in `PROMPTS_RELEASE.md`. I did not read the STACK handbook.

| Risk | Why it matters | How we avoid it |
|---|---|---|
| UI becomes Indonesian-only in judged material | Handbook (as summarized) requires English for judged material and the Final Day demo | Switcher in nav and footer from the first R2 commit. Demo script, README, docs and the pitch stay English. Add a smoke e2e in English. |
| Release work erases the "starting vs final version" evidence | Final Day asks for starting and final versions and member contributions | Tag `final-day-start` before any R1 change reaches `main` (D1). Work on a `release` branch. Never rewrite history. |
| Declared Final Day tasks get finished early | 14.2: keep them unfinished until the build session | Get the declared task list from you (D1) and keep those items out of R-phase scope until the session. I do not know the list. |
| Demo data disappears or is polluted in production | Judges need demo accounts and a labeled demo | Separate `demo` environment with `is_demo = true`, "Data contoh" badge, mock LLM, local fallback. Production never seeds. |
| Mock AI shown as real | Handbook: planned or simulated things must be labeled | Mock banner stays in demo. Production refuses `mock` at boot. |
| Local, offline fallback breaks | Handbook: prepare a local fallback | Keep `pnpm db:start` + `LLM_PROVIDER=mock` running the whole core flow. Add it to the R1 and R8 checklists. Email must have a local mail catcher (Supabase's local SMTP already exists). |
| README overclaims | "Never claim a feature is done unless it was run" | Update the Status table at each phase. The live AI path is currently "Partial: not tested live" and stays so until someone runs it. |
| AI assistance disclosure drifts | Required in README | `docs/ai-disclosure.md` updated per phase. |
| Schedule collision | Semifinal proposal 30 Nov, development 7 to 16 Dec, Final Day 16 Dec (dates from your summary) | R0 and R1 fit before 7 Dec. R2 to R4 only if you want them in the Final Day build. R5 to R9 after Final Day (D1). |

---

## 6. Phase order and branch plan

Branch model (proposal, see D1): `main` stays the competition baseline. Each phase is a branch off `release`, merged into `release` after its acceptance checks. `release` merges into `main` after Final Day (or earlier for phases you explicitly approve).

| Phase | Branch | Scope | Review checkpoint (you) |
|---|---|---|---|
| R0 | `release/r0-audit` | This plan, `CLAUDE.md` section 14 | Answer section 7. **Gate: no R1 until answered.** |
| R1 | `release/r1-accounts-access` | Migrations, functions, RLS, relationship checks, `/dasbor`, first-run screen, **CI skeleton** (D8) | Review the dry-run report and the 14.5 test list before cutover (`r1_05`) |
| R2 | `release/r2-i18n` | `next-intl`, extraction, glossary, CI key check, `docs/copy-review.md` | Review `docs/copy-review.md` (30 key strings and the flagged ones) |
| R3 | `release/r3-design-motion` | Radix wrappers, tokens, motion, home, overlap audit, performance numbers | Review screenshots in `docs/design/` and `docs/performance.md` |
| R4 | `release/r4-flows` | Wizard, settings page, access flows, requests, agreement, notifications | Walk through the 8 Playwright scenarios on screen |
| R5 | `release/r5-reporting-legal` | Reports, holds, appeals, policies, export, deletion | Review policy drafts and the hold threshold defaults |
| R6 | `release/r6-admin-v2` | Admin queues, appeals, policies, announcements, settings, trials | Review admin smoke run |
| R7 | `release/r7-production` | Env validation, email, headers/CSP, cron, observability, backups, SEO, docs | Staging deploy from README, restore test result |
| R8 | `release/r8-quality` | E2E, a11y, performance, security review, load test, `docs/qa-report.md` | Go or no go on open issues |
| R9 | `release/r9-launch` | Stage A (staging sign off), B (private beta), C (public) | Go or no go checklist per stage |

Ordering notes:

* R2 before R4 to R6 so new screens write straight into message files instead of being translated later.
* R3 (Radix) before R4 to R6 so dialogs, menus and toasts are built once.
* CI is created in R1 (not R3) because there is no CI today and R1 changes the data model.
* Email (R7) is needed earlier than R7 for verified accounts. In R1 the verification gate uses Supabase's built-in confirmation emails with the local mail catcher. The provider adapter, templates and DNS arrive in R7.

---

## 7. Decisions needed from you

Proposed defaults are what I will do if you answer "setuju".

### Six from the prompt

| # | Question | My proposed default |
|---|---|---|
| 1 | Cap on active adopter teams per project | **3**, owner can change to 1 or unlimited |
| 2 | Address form in the UI | **"kamu"** |
| 3 | Projects without an advisor | **Allowed** with a declaration, plus random admin spot checks (the spot-check queue is in R6) |
| 4 | Email domain policy in production | **Beta: allowlist `.ac.id`** (configurable setting). Public launch: decide after the beta |
| 5 | Who is the organizer and data controller, and is PSE registration needed | **Unknown, needs the campus legal office.** Until answered, the policy drafts carry the placeholder "[PENGENDALI DATA: perlu dikonfirmasi]" and the "Draf, belum ditinjau pihak berwenang" banner. Default for drafting: the team (Beban Server) under the study program |
| 6 | Hosting and data region | **Vercel plus Supabase, Singapore region** (closest to Makassar). Whether data must stay in Indonesia is a question for item 5 |

### Found during the audit

| # | Question | My proposed default |
|---|---|---|
| D1 | Branch and tag strategy vs Final Day. When do we tag `final-day-start`, which Final Day tasks are declared, and may R1 to R4 reach `main` before 16 Dec? | Tag `main` now (before any R1 change), keep R-phases on a `release` branch, merge after Final Day. **I need the list of declared Final Day tasks.** |
| D2 | Existing projects after migration | `access_mode = by_request`, `max_active_adopters = 3` (keeps today's behavior) |
| D3 | `adopted` status | Remove it as a stored status and show "Sedang dilanjutkan" when active access exists |
| D4 | URLs: the prompt uses Indonesian paths (`/dasbor`, `/bagikan`, `/proyek/[slug]/pengaturan`). English users would see `/en/dasbor` | Localized pathnames through `next-intl` (`/dasbor` and `/en/dashboard`), with redirects from today's English routes |
| D5 | Teammates on migrated requests | Only teammates who actually accepted get a `project_access` row. Others are asked to accept on their next visit |
| D6 | Animation library | Keep `framer-motion` (already installed). Do not add `motion`. Move looping effects to CSS |
| D7 | Language of AI output | Live synthesis keeps an English prompt and an `output_language` of the project (default Indonesian). Mock fixtures get Indonesian and English variants. **Needs your OK because it changes what the AI writes** |
| D8 | CI | Add a GitHub Actions workflow in R1 (lint, typecheck, unit tests, i18n key check from R2, overlap audit from R3, `pnpm audit`, secret scan). Needs a GitHub remote. Is there one? |
| D9 | Providers for email, bot check and error tracking | **Resend** (or SMTP) behind an adapter, **Cloudflare Turnstile**, **Sentry**. Each needs an account owned by you or the team |

---

## 8. Risks and things I could not verify

* `pnpm test:db` and `pnpm test:e2e` were not run, so I do not know whether they pass today.
* The live Gemini and Anthropic paths have never run against a real API (README). Cost caps and the production AI path depend on this.
* `AGENTS.md` warns that this Next.js version has breaking changes from what I know. Before R2 (routing, `next-intl`) and R7 (CSP, instrumentation) I must read the guides in `node_modules/next/dist/docs/` and not rely on memory.
* Several "likely" flags in section 4 are from reading code. The R3 overlap audit is what confirms them.
* The string counts are heuristics (section 3).
* Legal items (data controller, PSE registration, data residency, the content of the agreement and policies) are outside what I can decide or certify. Drafts only.
