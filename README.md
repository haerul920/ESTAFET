# ESTAFET

Read in: **English** · [Bahasa Indonesia](README.id.md)

**Enabling Sustainable Transitions for Academic Files and Experimental Trails.**
A web platform for the structured handover of discontinued student competition and research projects at Universitas Hasanuddin.
Built by team **Beban Server** for STACK 2026 (GDGoC ITB), Case 1 "Smarter Campus and Learning".

> **Prototype.** Sample projects are simulated demo data (`is_demo = true`, shown with a "Demo data" badge). In mock mode the
> AI output is simulated and the UI says so ("Simulated AI output (mock mode)").

## The core flow

There is **one account type**. "Owner" (shares a project) and "adopter" (continues one) are relationships per project, so the same account can do both. Admin is an extra flag.

1. An owner fills the basics and the team confirms. There is no advisor or lecturer step: ESTAFET is for students.
2. The owner uploads PDF reports, Markdown notes or a ZIP of the code folder (tree only).
3. A synthesis step drafts a summary, objectives, completed work, candidate next tasks and lessons. Every item carries evidence (file, page, quote), and the server checks that the quote exists on the cited page. It runs only after every team member consented.
4. The owner keeps, edits or removes every item. Publishing is blocked until all items are reviewed, every active team member has confirmed and the current Terms and Privacy Policy are accepted.
5. A public teaser is published. Files stay private.
6. Someone who wants to continue gets access in one of two ways, set per project: **open** (accept the Attribution Agreement and the files open, owners are told) or **by request** (a team sends a plan, the owners approve, each teammate accepts the agreement for themselves). Owners can pause new access and limit how many teams continue at once. Owners can revoke access with a reason. The lineage is logged.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript strict · Tailwind CSS 4 · **Radix UI** (overlays) · CSS motion with **framer-motion** only for the nav pill, tab underline and list or wizard transitions (all respect `prefers-reduced-motion`) ·
Supabase (Postgres, Auth, Storage, RLS) · Zod · `pdfjs-dist`, `remark`, `jszip` · `@react-pdf/renderer` · Vitest · Playwright · **pnpm**.

## Setup (works offline with the local stack)

Requirements: Node 20+ (tested on 25), pnpm 10, Docker Desktop (running).

```bash
pnpm install
cp .env.example .env.local          # your own target: a cloud project, or the local stack (see below)
cp .env.example .env.localstack     # LOCAL stack only: used by db:reset, seeds, tests and dev:local
pnpm db:start                        # supabase start (first run pulls images)
pnpm db:reset                        # applies migrations + seed.sql, then uploads demo files
pnpm dev:local                       # http://localhost:3100, always uses .env.localstack
# or: pnpm dev                       # http://localhost:3000, uses .env.local
```

**Two env files, on purpose.** `.env.local` is your normal target (it may point at a cloud project). `.env.localstack` always points at the
local Supabase stack. Everything that writes demo data or runs tests (`db:reset`, `seed:*`, `test:db`, `test:e2e`, `dev:local`) reads
`.env.localstack` first, and the seed scripts and database tests **refuse a non-local URL** unless `ALLOW_REMOTE_SEED=true`. So a demo reset
can never hit a real project by accident. Supabase's newer key names are accepted as aliases (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the
anon key, `SUPABASE_SECRET_KEY` for the service role key).

Get the local Supabase values with `pnpm exec supabase status -o env`:

| `.env.local` variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` (http://127.0.0.1:54321) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` (server only, never in the browser) |
| `LLM_PROVIDER` | `mock` (default, no internet needed) |

Other variables are documented in `.env.example`. `.env*` files are git-ignored; never commit secrets.

### Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm check` | ESLint + `tsc --noEmit` + unit tests |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:db` | Database rule tests against the local stack (RLS, publish rule, access modes, quota, expiry, revoke, append-only lineage) |
| `node scripts/migrate-r1-dry-run.mjs` | Dry run of the R1 migration on legacy-shaped data, then restores the local DB |
| `node scripts/build-cloud-sql.mjs` | Rebuilds `supabase/cloud-sql/` (numbered files to paste into the Supabase SQL Editor) from the migrations |
| `pnpm test:e2e` | Playwright end-to-end tests: core flow, admin area and axe accessibility (starts `dev:local`, needs the local stack and mock mode) |
| `pnpm test:e2e:admin` | Only the admin end-to-end tests |
| `pnpm test:db:purge` | DESTRUCTIVE purge test on the local stack, then run `pnpm db:reset` |
| `pnpm dev:local` | Dev server on port 3100 against the local stack |
| `pnpm seed:admin` | Creates the demo admin, only when `SEED_DEMO=true` and the target is local |
| `pnpm seed:dev -- --dry-run` / `-- --yes` | Seeds a hosted **development or demo** Supabase project in one command: pending migrations, demo data, demo files. Refuses STAGING and PRODUCTION, needs `SUPABASE_DB_URL` for the same project and `--yes`. Safe to run again. See `docs/database-setup.md` |
| `pnpm db:reset` | Reset the local DB, seed it, upload demo files and create the demo admin |

## Demo access (demo accounts only)

Password for all demo accounts: `Demo-Pass-2026!`

All demo accounts are ordinary accounts. What they can do depends on the projects they own, not on an account type. The emails keep their old names so older notes still work.

| Account | In the demo |
|---|---|
| `creator@estafet.demo` | Owns *Mangrove Cover Classifier* (published, one pending request), *Coral Reef Photo Counter* (at the Verify step, 4 of 6 items reviewed, one with "Evidence not found") and *Solar Dryer Controller*. Can also continue other people's projects. |
| `adopter@estafet.demo` | Team Laut Biru, with pending requests for Mangrove and Fish Freshness |
| `alumni@estafet.demo` | Owns the other four published demo projects. *Campus Waste Sorting Assistant* is **open**: any signed-in, verified account can take access after accepting the agreement. The rest are **by request**. |
| `admin@estafet.demo` | **Demo admin** (only seeded when `SEED_DEMO=true`, never in production). Opens `/admin` |


See `docs/demo-script.md` for a 5-minute walkthrough.

## Admin area

`/admin` is an internal tool (moderation, users, pipeline, consents, requests, onboarding trials, audit log, settings). Guests and normal users get a 404.
Read `docs/admin-guide.md` (how-to per page, break glass policy, before-the-demo checklist) and `CLAUDE.md` section 13 (the rules).

**Making an admin** (service role only, never through the UI; the person needs an account first):

```sql
select public.promote_admin('person@student.unhas.ac.id');   -- demote_admin(...) refuses to demote the last admin
```

**Demo only:** with `SEED_DEMO=true`, `pnpm db:reset` creates `admin@estafet.demo` (password `Demo-Pass-2026!`). Production never seeds an admin.

## Status

| Area | Status | Notes |
|---|---|---|
| Design system v2: layering, Radix, motion, overlap audit (R3) | **Done, except the settings page and a native-reviewed copy** | Z-index token scale (checked by a unit test), Radix dialog, drawer, dropdown menu, tooltip, tabs and toast in portals (hand-written overlays removed), CSS motion system (floating cards, drifting clouds, word-by-word headline, count-up, reveals, parallax, swaying flowers, hover and press, focus ring), reduced-motion mode, phone drawer with focus trap. Overlap audit (Playwright) passes on 38 routes at 6 viewports and runs in CI (the CI workflow has not run on GitHub yet). Numbers in `docs/performance.md` (Home LCP 1.34 s, Explore 1.08 s, CLS 0, emulated phone, local server, not a real device). Screenshots in `docs/design/`. **Not re-run after R3:** the older Playwright specs (core flow, admin, axe, Indonesian smoke) were not run again after the Radix and button changes, because the machine ran out of memory; the owner chose to merge anyway. Treat those flows as unverified until they are run. **Not done:** `/proyek/[slug]/pengaturan` does not exist until R4, so it is not audited; form `<select>` stays the native element on purpose. |
| Home, Explore (URL filters), Project teaser | **Done** | Reads from Supabase through public views. Survey numbers carry the "indicative only" note. |
| Auth (email + password, any email address) | **Done** | Sign up and sign in work with any email. `ALLOWED_EMAIL_DOMAINS` is an optional admin restriction and is empty (off) by default. Sharing a project or taking access needs a confirmed email. |
| Database, RLS, state rules | **Done** | 12 tables, all with RLS. Rules live in SQL functions. Verified by `pnpm test:db`. |
| Creator wizard (Basics, Consent, Files, Verify, Publish) | **Done** | Autosaves a draft per step, resume from the dashboard. |
| Advisor consent | **Removed (R5)** | The owner decided that ESTAFET has no advisor role. The page, the token endpoint and the database functions are gone. Old columns stay in the database, marked deprecated, until a cleanup migration. |
| Upload + ingestion (PDF, Markdown, ZIP tree) | **Done** | Magic bytes, size limit, ZIP safety, secrets scan. Unit tested. |
| Synthesis, **mock** provider | **Done** | Deterministic, labeled, one unsupported item on purpose. |
| Synthesis, **live** providers (Gemini, Anthropic) | **Partial: not tested live** | Adapters, Zod validation, retry-once and chunking are implemented and unit-tested with a stubbed model. They have **not** been run against a real API with real data. |
| Evidence matcher | **Done** | Exact, hyphenated line breaks, whitespace, wrong page, fabricated quote, fuzzy at 0.9. |
| Continuation request, creator decision, agreement, unlock | **Done** | End to end in the Playwright test. |
| Agreement PDF and credit line | **Done** | `@react-pdf/renderer`. |
| Workspace (signed downloads, full backlog, lineage) | **Done** | Signed URLs are issued only after an RLS-checked read. |
| One account type, relationships per project (R1) | **Done (database, rules, dashboard, tests)** | `project_members` (owner, co_owner), `project_access`, access modes `open`, `by_request`, `paused`, team quota, lifecycle `draft`, `published`, `unpublished`, `archived`, request expiry and cooldown, revoke, email-verification gate, policy acceptance. 103 database tests, a migration dry run on legacy-shaped data, and 3 core-flow Playwright tests pass. See `docs/migrations-r1.md`. |
| Flow redesign (R4): `/bagikan` wizard, project settings, access flows | **Mostly done** | Five steps (Info dasar, Berkas, Tinjau draf AI, Tim dan akses, Pratinjau dan terbitkan) with autosave on edits, resume from the dashboard, a "Syarat terbit" checklist, and the preview that explains the chosen access mode. "Isi manual tanpa AI" (nothing goes to an AI provider; the AI path needs the owner's consent first). `/proyek/[slug]/pengaturan`: publication (unpublish, publish again, archive), access mode and team limit, co-owners (invite, remove, hand over ownership with the recipient's confirmation), advisor status, incoming-request inbox with filters, active access holders with revoke (reason required), notifications, change history. Teaser call to action per state, "Beri tahu saya", visitor preview for owners. Request thread (500 characters), decision message templates, backlog items marked "Dikerjakan" or "Selesai" by access holders (shown in the lineage). New database rules in `docs/migrations-r4.md` with 14 database tests (117 pass). Playwright: manual and open-mode publish with unpublish and republish, paused then full then open with watchers, plus the core flow, all run and passing. **Not done:** email (advisor link, request decisions, reminders) and the notification preferences page (both need the email provider, phase R7); nothing runs the expiry reminder on a schedule yet (R7); the agreement PDF exists only for access that came from a request, not for open-mode access; a brand-new project is created at the first "Save and continue", so autosave starts from then; onboarding hints are only on the new screens, not every screen. **Not re-run after the last edits:** the admin smoke spec (one assertion changed because the environment pill is now a tooltip) and the overlap audit for the renamed wizard routes and the new settings page. |
| Dashboard (`/dasbor`) + in-app notifications | **Done** | One view with two sections: projects I share, projects I am continuing. First-run screen at `/mulai`. No email. |
| Indonesian interface with English switcher (R2) | **Done for all screens except admin** | Indonesian is the default (no URL prefix), English is under `/en`, the choice is kept in a cookie. Messages live in `messages/id.json` and `messages/en.json`; `pnpm i18n:check` fails on missing, unused or hard-coded text. The agreement PDF, API errors and live AI drafts follow the language. **Not done:** the admin area stays English until R6; localized URLs (`/en/dashboard`) were not built, so both languages use `/dasbor`. The Indonesian text is an AI draft and still needs a native-speaker review: see `docs/copy-review.md`. |
| Reports, moderation, legal pages, account privacy (R5) | **Built, partly verified** | **Reports:** a dialog with eight reasons (each with its rule in one line), required details, optional evidence link, a bot check for guests, rate limits (per hashed address and per account), a reference code, duplicate grouping, and `/laporan-saya` with status only. **Automatic hold:** several different reporters (default 3, verified accounts or distinct hashed addresses) for copyright, personal data or harmful files hold a project; visitors see a neutral notice; admins are alerted. **Owners:** a decision page `/proyek/[slug]/keputusan` with the written reason and one appeal per decision; admins have an appeals queue; every outcome notifies the owners. **Reporter anonymity:** owners cannot read reports, and decisions carry no reporter. **Legal pages in Indonesian and English:** Terms, Privacy Policy, Community Guidelines, Attribution Agreement and Contact, all marked *Draf, belum ditinjau pihak berwenang* and linked from the footer and the report dialog; a new policy version forces re-acceptance (`/kebijakan/setujui`). **Account privacy** (`/akun/privasi`): JSON data export and account deletion with a 30 day grace period that can be cancelled. **Verified:** database rules by 18 database tests when Docker was available (132 database tests passed then), unit tests (121), lint, types, i18n check. **Not verified:** the app screens for R5 were not run in a browser, and the database tests and Playwright were not re-run after the last app changes, because Docker was switched off (the owner moved to Supabase cloud). The Cloudflare Turnstile path has never been tested against Cloudflare; without keys a weaker local check (hidden field and minimum fill time) is used. **Not done:** nothing runs the hold escalation or the deletion processor on a schedule yet (`pnpm deletions:process` is run by hand; scheduling is R7); no emails (report outcome, appeal outcome, moderation notice need the provider in R7); the legal texts are drafts written by the team and have not been reviewed by a lawyer or the university; admin screens are still English (R6). |
| Accessibility pass (axe/Lighthouse) | **Done (automated axe + keyboard E2E)** | Semantic HTML, labels, focus ring, 44 px targets and reduced motion are verified by `tests/e2e/a11y.spec.ts` (axe-core WCAG 2.1 A/AA across English & Indonesian public, user, dialog and admin routes on mobile 390px and desktop 900/1280/1440px, plus keyboard skip-link, focus-ring, honeypot `tabIndex=-1`, and dialog Escape/focus-restoration checks). A manual human screen-reader pass (NVDA/VoiceOver) is still **Planned**. |
| Admin area: roles, audit log, shell, overview (8A) | **Done** | `is_admin()`, append-only `audit_log`, `admin_*` functions, 404 for non-admins, password re-check for sensitive actions. Tests: unit, `pnpm test:db`, Playwright. |
| Admin moderation: reports, hide/remove, users, break glass (8B) | **Done** | Public "Report this project", reports queue, reversible hide/remove with creator notifications, suspend/restore, 5-minute break glass with red banner. |
| Admin operations: pipeline, requests, settings (8C) | **Done** | Retry/cancel runs, read-only requests with admin notes, settings that override env and apply immediately, purge demo data (never in PRODUCTION). |
| Admin trials and metrics (8D) | **Done (tool)** | Record sessions, per-cohort summary with n, chart, CSV, methods paragraph. **No real trial has been recorded**: the only rows are labeled demo and excluded by default. |
| Admin audit viewer, shortcuts, polish (8E) | **Done** | Filters, diff, CSV export, global search, keyboard shortcuts, axe with no serious issues at 900/1280/1440 px. A screen-reader pass by a person is still **Planned**. |
| Admin panel v2 (R6) | **Done** | **New:** announcements (`/admin/announcements`: Indonesian and English text, start and end in WITA, severity, dismissible; shown in the page flow at the top of public pages), policy versions with acceptance rates and publish (`/admin/policies`, needs a recent password check), appeals queue, a fuller overview (new reports, held and overdue holds, open appeals, failed runs, stale requests, projects by moderation state, access mode, reports by reason and outcome, median days to publish), reports: review-target timer, reason templates (in the admin's language, because owners read them), internal project note, bulk dismissal of spam only; users: reports made and received, email confirmed or not, resend confirmation, force sign out. **The whole admin area is now in Indonesian with an English option** (verified in both English `admin.spec.ts` and Indonesian `id-smoke.spec.ts`, plus overlap audit across all 12 admin routes at 6 viewports). See `docs/migrations-r6.md`. **Email log (R9):** `/admin/emails`, see the row below. **Saved filters** are the URL itself (every filter, sort and page is in the address, so it can be bookmarked or shared). **Density toggle (R9):** "Compact rows" in the admin header, kept in this browser only (localStorage, not a cookie). **Not done:** per-user synthesis quota overrides and cost counters. **Not checked:** the Indonesian admin text was written by the AI and still awaits review by a native speaker. |
| Admin email log (R9) | **Built, partly verified** | `/admin/emails`: product emails from the outbox with status, attempts and short error codes (no address, no message text), 7-day counts, the active provider, filters, and **Send again** for failed essential emails (reason required, audited as `email.resend`). A "failed emails" card on the overview. **Verified:** unit tests, i18n check, types, the authorization matrix, a production build, `pnpm test:db` on the local stack (183 tests, including `tests/db/r9-email-log.test.ts` and the admin boundary checks for the new view and function), the migration on a development Supabase project, and a browser run as the demo admin on the local stack (table, axe with no serious issues at 1280 px, Send again with reason and audit row, no Send again for a regular email, the overview card, the Compact rows toggle). **Not done:** bounce tracking (needs a provider webhook). |
| Email delivery (R7) | **Built, verified locally only** | Provider-agnostic adapter (SMTP through nodemailer, or Resend over HTTP; `log` for local use). Twelve templates in Indonesian and English (new request, decision, agreement, moderation notice, appeal outcome, revoked access, co-owner invite and ownership offer, report outcome, three admin alerts), HTML-escaped, with a preview route outside production. An outbox in the database with retries (5, 15, 45, 135 minutes, then failed with an alert); the outbox stores no email address. Preferences and email language in `/akun/privasi`; safety emails always go out. Account emails (confirm address) are sent by Supabase Auth: the template to paste is in `docs/email-templates/`. **Verified:** 36 template unit tests, 17 database tests including the full sender against a fake SMTP server on this machine. **Not verified:** a real provider, a real inbox, SPF/DKIM/DMARC on a real domain (steps in `docs/email.md`), Supabase Auth custom SMTP. |
| Production readiness (R7) | **Built, verified locally only** | **Config:** validated at boot with Zod; production refuses mock AI, demo seeding, a local database, plain http, no Turnstile keys, no email provider and a weak cron secret, and the process exits with code 1 (seen on a real production build; `pnpm config:check` checks a file before deploying). **Security:** CSP with a nonce per request and `strict-dynamic`, fixed security headers, no `X-Powered-By`, `noindex` for staging and demo (browser-tested, also against the production build); rate limits on sign-in, sign-up, resend, upload and the existing report and AI limits; bot check on sign-up; upload scan hook (`UPLOAD_SCAN_URL`, tested against a fake scanner; no scanner is bundled); gitleaks and a production-build job in CI. **Jobs:** `/api/cron/emails` and `/api/cron/daily` (expire requests, expiry reminders, hold escalation, account deletion after the grace period, cleanup) with a bearer secret, `vercel.json` schedule and a `pg_cron` alternative. **Observability:** structured JSON logs without personal data, `onRequestError`, `alert()` with an optional webhook, `/api/health`. **Cost:** a platform-wide daily cap on live AI runs next to the per-person and per-project caps, with a friendly message. **SEO:** sitemap, robots, canonical and language alternates, share pictures, JSON-LD for public projects only. **Backups:** `pnpm restore:drill` restores a dump into a scratch database and compares every table (passed locally). **Docs:** `docs/runbook.md`, `docs/security.md`, `docs/privacy-data-map.md`, `docs/operations-checklist.md`, `docs/environments.md`, `docs/email.md`, `docs/migrations-r7.md`. **Not done or not verified:** nothing has run on a hosted staging or production project; the Vercel and `pg_cron` schedules, the uptime monitor, the alert webhook, Turnstile against Cloudflare, SPF/DKIM/DMARC, and a restore from a hosted backup are all unexecuted. |
| Quality gate (R8) | **Done (local production build + local stack)** | Systematic authorization matrix (`tests/security/authz.matrix.ts`) covering all 36 page routes, 12 API routes, 38 user Server Actions, and 19 admin Server Actions; multi-role DB & IDOR authorization suite (`tests/db/r8-authz.test.ts`, 176 DB tests total); unit security & glossary compliance suite (`tests/unit/r8-security.test.ts`, 199 unit tests total); deduplicated E2E helpers (`tests/e2e/helpers.ts`) with repeatable `admin.spec.ts` and full Indonesian R4/R5/R6 E2E flows (`tests/e2e/id-smoke.spec.ts`); expanded overlap + reduced-motion audit (`tests/e2e/overlap.spec.ts`); expanded axe + keyboard walkthrough suite (`tests/e2e/a11y.spec.ts`); production build performance measurement (`docs/performance.md`); k6 load test suite (`tests/load/explore-and-uploads.k6.js`); and full QA report (`docs/qa-report.md`). |
| Staged launch (R9) | **Prepared, waiting for owner execution** | Stage A (staging sign-off), Stage B (private beta with 10–20 Universitas Hasanuddin students), and Stage C (public launch Go/No-Go) checklists are prepared in `docs/launch-checklist.md`, daily beta log template in `docs/beta-log.md`, and Indonesian README in `README.id.md`. Staging deployment and live beta require the project owner's accounts and explicit confirmation per stage. |
| Deployment (Vercel + Supabase cloud) | **Prepared, not deployed** | Configuration, schedule, health check and runbook exist (R7); only the local stack and a local production build have been run. Staging and production projects must be provisioned and verified by the owner per `docs/launch-checklist.md`. |
| `/styleguide` route | **Done (internal page)** | Every colour, gradient, layer and motion token and every shared UI component (buttons, badges, cards, form fields, stepper, tabs, dialog, drawer, menu, tooltip, toasts) on one page, in Indonesian and English. Not linked from the navigation, `noindex`, and a 404 in PRODUCTION. **Verified:** unit tests (404 in PRODUCTION, `noindex`), i18n check, and a local production build in Chromium: axe-core WCAG 2.1 A/AA with no serious issues at 1280 and 390 px in both languages, no horizontal overflow, dialog Escape and focus return, menu, toast and tabs. **Not done:** it is not part of the Playwright overlap audit (the local Docker stack was not available), and it was not compared side by side with the design file by a person. |

## For the next developer / project owner

Phases R0 to R7 are merged into `release/next`, and **Phase R8 (quality gate) plus Phase R9 readiness artifacts** are completed on `release/r8-quality-gate`. See:
- [`docs/qa-report.md`](docs/qa-report.md) — complete R8 quality gate results, security review tables, performance measurements, and issue log.
- [`docs/launch-checklist.md`](docs/launch-checklist.md) — step-by-step R9 Stage A (Staging), Stage B (Private Beta), and Stage C (Public Launch Go/No-Go) checklists for the project owner.
- [`docs/beta-log.md`](docs/beta-log.md) — daily beta observation log template for Stage B.
- [`docs/handover-r8-r9.md`](docs/handover-r8-r9.md) — full Indonesian handover guide and architecture map.

## Known limitations

- Admin: the "environment" badge comes from `APP_ENV` (or the Supabase URL: local means LOCAL, anything else is treated as PRODUCTION). Set `APP_ENV` correctly on staging.
- Admin: break glass opens the **stored** file (PDF, Markdown, or the sanitized code tree). Extracted text and evidence quotes are not offered as a separate view.
- Admin: a suspension is enforced by the database (it blocks writes), by the sign-in check, and by an auth ban. A session that is already open can still read public pages until it ends.
- Admin: new settings keys beyond CLAUDE.md 13.3 are `contact_email` (shown to suspended users) and the column `profiles.suspended_until` (optional end date).

- Account deletion: the database step and the cleanup script (`pnpm deletions:process`) are tested with unit tests and database tests, but the cleanup has not been run against a real Supabase project. If the script fails after the database step, it prints the account id so the cleanup can be finished by hand.
- Reports: a guest's bot check without Cloudflare Turnstile keys only stops simple scripts.
- **Live AI path is untested** (see Status). Mock mode is the verified path.
- Synthesis runs inside the request (no background queue, no status polling). Large live runs may take tens of seconds.
- Scanned PDFs (no text layer) are flagged "Check" and cannot be read. There is no OCR.
- Co-owners and teammates must already have an ESTAFET account to be invited. A co-owner joins only when they accept.
- "One open request per team" is enforced per requesting account. Access is per person: each teammate accepts the agreement for themselves.
- Owners change the access mode, team limit, publication and co-owners at `/proyek/[slug]/pengaturan`. Inviting a co-owner is allowed on a published project (R4); the invited person still has to accept.
- A person whose access was revoked cannot take it again by themselves.
- The agreement PDF exists only for access that came from a request. Open-mode access has no PDF yet (not built in R4).
- The Attribution Agreement is a simple template for student projects and is **not legal advice**.
- Survey numbers (n = 10) are indicative only. The "30 minutes to understand a project" figure is a **target, not a measured result**.
- The local-stack keys in `.env.local` are Supabase's public development defaults.

## Simulated or unfinished functionality

- All sample projects, people, requests and files are synthetic (`is_demo = true`). Names are fictional.
- Mock synthesis is rule-based text extraction, not AI.
- Demo PDFs are generated programmatically and contain placeholder text.

## Data model changes beyond `CLAUDE.md` section 6

Additive columns only: `projects.stopped_note`, `projects.tech`, `projects.team_size`, `project_files.ingest_status/ingest_note`,
`draft_items.objective_status`, `synthesis_runs.requested_by/summary_draft`, extra `lineage_type` values (`declined`, `advisor_withdrawn`),
and the `rate_limit_hits` table. They are marked "(added)" in `supabase/migrations`.

## Architecture notes

- Cache Components is switched off: every page reads the Supabase session cookie, so pages render per request.
- `src/proxy.ts` (the Next 16 name for middleware) refreshes the session and protects `/dasbor`, `/mulai`, `/share`, `/requests` and the request and workspace routes. `/dashboard` redirects to `/dasbor`.
- Authorization depends on relationships, never on an account type: `is_project_owner`, `has_access`, `can_read_private`, `is_request_team` (see `docs/migrations-r1.md`).
- The service-role client is used only in server code and only after an explicit authorization check.
- See `docs/architecture.md` for the policy table and diagrams.

## AI assistance

See [`docs/ai-disclosure.md`](docs/ai-disclosure.md). In short: **Claude Code (Anthropic)** was used to scaffold and implement this
codebase, the database schema and the tests under team direction. The product design, scope and review remain the team's. Material AI
assistance is disclosed there and must stay current.

## Third-party resources

Next.js, React, Tailwind CSS, framer-motion, Supabase, Zod, pdfjs-dist, jszip, unified/remark, @react-pdf/renderer, lucide-react (MIT/Apache/ISC licenses).
Fonts: Instrument Sans, DM Mono, JetBrains Mono (SIL Open Font License) via `next/font`.

## Member contributions and versions

| Member | Contribution |
|---|---|
| [TEAM TO FILL] | [TEAM TO FILL] |

Starting version: git tag `final-day-start` (commit `964d2e9`, the first commit). Final version: [TO BE SET]. Release-edition work
(`CLAUDE.md` section 14) happens on `release/*` branches and is merged after Final Day. The plan is in `docs/release-plan.md`.

## License

[LICENSE TO BE CHOSEN BY THE TEAM]
