# ESTAFET

**Enabling Sustainable Transitions for Academic Files and Experimental Trails.**
A web platform for the structured handover of discontinued student competition and research projects at Universitas Hasanuddin.
Built by team **Beban Server** for STACK 2026 (GDGoC ITB), Case 1 "Smarter Campus and Learning".

> **Prototype.** Sample projects are simulated demo data (`is_demo = true`, shown with a "Demo data" badge). In mock mode the
> AI output is simulated and the UI says so ("Simulated AI output (mock mode)").

## The core flow

1. A creator fills the basics, the team confirms, and the advisor approves through a private link (no account).
2. The creator uploads PDF reports, Markdown notes or a ZIP of the code folder (tree only).
3. A synthesis step drafts a summary, objectives, completed work, candidate next tasks and lessons. Every item carries evidence (file, page, quote), and the server checks that the quote exists on the cited page.
4. The creator keeps, edits or removes every item. Publishing is blocked until all items are reviewed and the advisor approved.
5. A public teaser is published. Files stay private.
6. An adopter team sends a continuation request. The creator approves, both sides accept the Attribution Agreement, private files unlock, and the lineage is logged.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript strict · Tailwind CSS 4 · **framer-motion** (animations, respects `prefers-reduced-motion`) ·
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
| `pnpm test:db` | Database rule tests against the local stack (RLS, publish rule, unlock rule, append-only lineage) |
| `pnpm test:e2e` | Playwright end-to-end tests: core flow, admin area and axe accessibility (starts `dev:local`, needs the local stack and mock mode) |
| `pnpm test:e2e:admin` | Only the admin end-to-end tests |
| `pnpm test:db:purge` | DESTRUCTIVE purge test on the local stack, then run `pnpm db:reset` |
| `pnpm dev:local` | Dev server on port 3100 against the local stack |
| `pnpm seed:admin` | Creates the demo admin, only when `SEED_DEMO=true` and the target is local |
| `pnpm db:reset` | Reset the local DB, seed it, upload demo files and create the demo admin |

## Demo access (demo accounts only)

Password for all demo accounts: `Demo-Pass-2026!`

| Account | Role in the demo |
|---|---|
| `creator@estafet.demo` | Owns *Mangrove Cover Classifier* (published, one pending request), *Coral Reef Photo Counter* (at the Verify step, 4 of 6 items reviewed, one with "Evidence not found") and *Solar Dryer Controller* (waiting for the advisor) |
| `adopter@estafet.demo` | Team Laut Biru, with pending requests for Mangrove and Fish Freshness |
| `alumni@estafet.demo` | Owns the other four published demo projects |
| `admin@estafet.demo` | **Demo admin** (only seeded when `SEED_DEMO=true`, never in production). Opens `/admin` |

Advisor demo link (single decision, demo token only): `http://localhost:3000/consent/demo-advisor-token-solar`

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
| Design system, UI kit, motion | **Done** | Tokens, glass nav, sky strip, buttons, badges, stepper, tabs. Compared against the approved design screens. |
| Home, Explore (URL filters), Project teaser | **Done** | Reads from Supabase through public views. Survey numbers carry the "indicative only" note. |
| Auth (email + password, optional domain check) | **Done** | `ALLOWED_EMAIL_DOMAINS` enforced in the sign-up action. |
| Database, RLS, state rules | **Done** | 12 tables, all with RLS. Rules live in SQL functions. Verified by `pnpm test:db`. |
| Creator wizard (Basics, Consent, Files, Verify, Publish) | **Done** | Autosaves a draft per step, resume from the dashboard. |
| Advisor consent (tokenized link, no account) | **Done** | 32-byte token, only the hash stored, 14-day expiry, one decision, DB-backed rate limit. |
| Upload + ingestion (PDF, Markdown, ZIP tree) | **Done** | Magic bytes, size limit, ZIP safety, secrets scan. Unit tested. |
| Synthesis, **mock** provider | **Done** | Deterministic, labeled, one unsupported item on purpose. |
| Synthesis, **live** providers (Gemini, Anthropic) | **Partial: not tested live** | Adapters, Zod validation, retry-once and chunking are implemented and unit-tested with a stubbed model. They have **not** been run against a real API with real data. |
| Evidence matcher | **Done** | Exact, hyphenated line breaks, whitespace, wrong page, fabricated quote, fuzzy at 0.9. |
| Continuation request, creator decision, agreement, unlock | **Done** | End to end in the Playwright test. |
| Agreement PDF and credit line | **Done** | `@react-pdf/renderer`. |
| Workspace (signed downloads, full backlog, lineage) | **Done** | Signed URLs are issued only after an RLS-checked read. |
| Dashboard + in-app notifications | **Done** | No email. |
| Accessibility pass (axe/Lighthouse) | **Planned** | Semantic HTML, labels, focus ring, 44 px targets and reduced motion are built in, but no axe or Lighthouse run has been done yet. |
| Admin area: roles, audit log, shell, overview (8A) | **Done** | `is_admin()`, append-only `audit_log`, `admin_*` functions, 404 for non-admins, password re-check for sensitive actions. Tests: unit, `pnpm test:db`, Playwright. |
| Admin moderation: reports, hide/remove, users, break glass (8B) | **Done** | Public "Report this project", reports queue, reversible hide/remove with creator notifications, suspend/restore, 5-minute break glass with red banner. |
| Admin operations: pipeline, consents, requests, settings (8C) | **Done** | Retry/cancel runs, regenerate advisor link, read-only requests with admin notes, settings that override env and apply immediately, purge demo data (never in PRODUCTION). |
| Admin trials and metrics (8D) | **Done (tool)** | Record sessions, per-cohort summary with n, chart, CSV, methods paragraph. **No real trial has been recorded**: the only rows are labeled demo and excluded by default. |
| Admin audit viewer, shortcuts, polish (8E) | **Done** | Filters, diff, CSV export, global search, keyboard shortcuts, axe with no serious issues at 900/1280/1440 px. A screen-reader pass by a person is still **Planned**. |
| Email delivery | **Planned** | Out of scope: the creator copies the consent link and shares it. |
| Deployment (Vercel + Supabase cloud) | **Planned** | Only the local stack has been run. |
| `/styleguide` route | **Planned** | Not built. |

## Known limitations

- Admin: the "environment" badge comes from `APP_ENV` (or the Supabase URL: local means LOCAL, anything else is treated as PRODUCTION). Set `APP_ENV` correctly on staging.
- Admin: break glass opens the **stored** file (PDF, Markdown, or the sanitized code tree). Extracted text and evidence quotes are not offered as a separate view.
- Admin: a suspension is enforced by the database (it blocks writes), by the sign-in check, and by an auth ban. A session that is already open can still read public pages until it ends.
- Admin: new settings keys beyond CLAUDE.md 13.3 are `contact_email` (shown to suspended users) and the column `profiles.suspended_until` (optional end date).

- **Live AI path is untested** (see Status). Mock mode is the verified path.
- Synthesis runs inside the request (no background queue, no status polling). Large live runs may take tens of seconds.
- Scanned PDFs (no text layer) are flagged "Check" and cannot be read. There is no OCR.
- Teammates must already have an ESTAFET account to be added as creators.
- "One open request per team" is enforced per requesting account.
- Only one agreement acceptance per side is needed to unlock (one creator, one adopter), by design of this prototype.
- The Attribution Agreement is a simple template for student projects and is **not legal advice**.
- Survey numbers (n = 10) are indicative only. The "30 minutes to understand a project" figure is a **target, not a measured result**.
- The local-stack keys in `.env.local` are Supabase's public development defaults.

## Simulated or unfinished functionality

- All sample projects, people, advisors, requests and files are synthetic (`is_demo = true`). Names are fictional.
- Mock synthesis is rule-based text extraction, not AI.
- Demo PDFs are generated programmatically and contain placeholder text.

## Data model changes beyond `CLAUDE.md` section 6

Additive columns only: `projects.stopped_note`, `projects.tech`, `projects.team_size`, `project_files.ingest_status/ingest_note`,
`draft_items.objective_status`, `synthesis_runs.requested_by/summary_draft`, extra `lineage_type` values (`declined`, `advisor_withdrawn`),
and the `rate_limit_hits` table. They are marked "(added)" in `supabase/migrations`.

## Architecture notes

- Cache Components is switched off: every page reads the Supabase session cookie, so pages render per request.
- `src/proxy.ts` (the Next 16 name for middleware) refreshes the session and protects `/dashboard`, `/share`, `/requests` and the request and workspace routes.
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

Starting version: [TAG `final-day-start` TO BE SET BY THE TEAM]. Final version: [TO BE SET]. This repository was not under git when
this README was written, so no tags exist yet.

## License

[LICENSE TO BE CHOSEN BY THE TEAM]
