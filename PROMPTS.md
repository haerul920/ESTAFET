# ESTAFET: prompts for Claude Code

How to use this file

1. Create an empty repo, copy `CLAUDE.md` into its root, open Claude Code there.
2. Paste the prompts below one phase at a time, in order. Wait until a phase passes its acceptance checks before starting the next.
3. Each prompt already tells Claude Code to read `CLAUDE.md` and the design reference first. Keep both open while you work.
4. Commit after every phase. Tag the last commit before Final Day as `final-day-start` (the handbook asks teams to record the starting version).

Suggested schedule against the STACK 2026 timeline

| Window | Goal | Phases |
|---|---|---|
| 19 to 30 Nov (semifinal proposal and 2-minute video) | A runnable starting point you can show honestly in the video | 0, 1, 2, and the advisor consent part of 3 |
| 7 to 16 Dec (product improvement) | The core flow works end to end in mock mode | 3, 4 (mock path), 5 |
| 16 Dec (Final Day build session) | Substantive, traceable work declared in advance | Reserve 2 to 3 items from the list at the end |

Remember the handbook rules: say clearly in the video and proposal what is done and what is planned, and label simulated data.

---

## Master prompt (paste once at the very start)

```
You are building ESTAFET, a web platform for handing over discontinued student projects, for the STACK 2026 hackathon.

First, read CLAUDE.md in full. It defines scope, competition rules, stack, data model, security rules and the design system. Treat it as binding.

The approved UI design is at https://claude.ai/artifact/9wnDEifCPiFs5a97vm3aEU (screens: Home, Explore, Project teaser, Upload, Verify, Dashboard, Request, Review, Consent). If you can open it, match it closely. If you cannot, follow the tokens and descriptions in CLAUDE.md section 9 and ask me for screenshots.

Working agreement:
- Work in phases. I will give you one phase at a time. Do not start the next phase on your own.
- For each phase: (1) restate the goal and list the files you will create or change, (2) implement, (3) run `pnpm check` and the tests, (4) fix failures, (5) update the Status table in README.md, (6) report what is done, what is not done, and any decision I should confirm.
- Never claim something works unless you ran it. If you could not run it, say so.
- Never commit secrets. Never invent data that looks real: demo data must have is_demo = true and show a Demo badge.
- Ask me before adding dependencies that are not listed in CLAUDE.md, or before changing the data model.

Confirm you understand by summarizing the product, the core flow and the three most important rules in five lines. Then wait for Phase 0.
```

---

## Phase 0: Foundation

```
Phase 0: foundation.

Goal: a clean Next.js app that already looks like the design system, with tooling and CI-style checks, and no features yet.

Do:
1. Scaffold Next.js (App Router, TypeScript strict, Tailwind) with pnpm. Add ESLint, Prettier, Vitest, Playwright (install only), and a `pnpm check` script that runs lint, `tsc --noEmit` and unit tests.
2. Create `src/styles/tokens.css` and the Tailwind theme from CLAUDE.md section 9. Load Instrument Sans, DM Mono and JetBrains Mono through `next/font`.
3. Build the shared UI kit in `src/components/ui/`: Button (primary lime pill with arrow circle, secondary dark pill, outline pill, destructive), Pill/Badge (Creator-verified, Advisor-consented, Demo data, Evidence matched, Evidence not found), Card (28 px radius, grey surface), Field (label, input, textarea, select, checkbox with proper labels and error text), Stepper (aria-current), GlassNav (liquid glass with solid fallback), SkyStrip (sky gradient with blurred cloud ellipses), ProgressBar, SegmentedTabs.
4. Create the app shell: sky strip plus glass nav on inner pages, footer, a 404 page, a generic error boundary, and a loading skeleton pattern.
5. Add a temporary `/styleguide` route showing every component and token so we can compare against the design. Remove it from the production nav.
6. README.md skeleton with: product summary, setup, scripts, Status table (all items Planned), AI assistance disclosure section (state that Claude Code is used for scaffolding and implementation under team review), known limitations, license placeholder.
7. `.env.example` from CLAUDE.md section 11, `.gitignore` that excludes env files and local Supabase volumes.

Acceptance:
- `pnpm dev` runs and `/styleguide` renders all components, keyboard focus rings visible, no console errors.
- `pnpm check` passes.
- The nav and buttons visually match the Home screen of the design (pill, mono uppercase labels, lime accent).
Report using the working agreement.
```

---

## Phase 1: Database, auth, security rules

```
Phase 1: database, auth and RLS.

Goal: the full data model from CLAUDE.md section 6 running on a local Supabase stack, with auth and row level security that enforce the rules, plus labeled demo data.

Do:
1. Initialize the Supabase CLI project. Write migrations for all tables, enums, indexes, the `public_project_teaser` view, and database functions for the state rules (publish check, request approval, unlock check). Enable RLS on every table and write policies per CLAUDE.md section 6.
2. Create private Storage buckets for project files and extracted text. Add a server helper that returns short-lived signed URLs only after an authorization check.
3. Supabase Auth with email and password. Sign up and login pages in the design style. After sign up, create a `profiles` row via trigger. Enforce `ALLOWED_EMAIL_DOMAINS` when set.
4. Typed Supabase client helpers (server and browser) and Next.js middleware that refreshes the session and protects `/dashboard`, `/share`, `/requests/*`, and workspace routes.
5. `supabase/seed.sql`: 6 demo projects matching the Explore screen (all `is_demo = true`), 2 demo users (one creator, one adopter) with documented demo credentials in README, demo draft items with matched and one not_found evidence, one pending request, lineage events. Use clearly fictional names.
6. Unit or SQL tests proving: a non-member cannot read private files; a project cannot be published without advisor approval or with pending items; files unlock only after approval plus both agreement acceptances; lineage rows cannot be updated or deleted.

Acceptance:
- `supabase start` then `supabase db reset` works from a clean checkout.
- The tests in step 6 pass.
- Logging in as each demo user works.
Report using the working agreement. List every policy you wrote in a short table in docs/architecture.md.
```

---

## Phase 2: Public pages

```
Phase 2: public pages with real data.

Goal: Home, Explore and the Project teaser page, matching the design, reading from the database.

Do:
1. Home (`/`): rebuild the design: sky hero panel with liquid glass nav, headline, two CTAs, floating glass preview cards row, "Why ESTAFET" statement, bento survey cards (60%, 90% shown as 9 of 10 dots, 70%, and the 30 minute target labeled "Our target, not yet measured"), how it works, creator and adopter cards, "AI drafts. People decide." glass cards, the sunset meadow call to action (SVG hills, no photos), footer. The survey numbers come from a `docs/survey.md` file (n=10, source: Beban Server Team, Nov 2026) and must keep the "indicative only" note.
2. Explore (`/explore`): search (title, summary, field), filters (type of work, why it stopped, faculty), sort, result count, project cards as in the design, URL query params for all filters, empty state, skeleton loading. Only published teasers.
3. Project teaser (`/projects/[slug]`): badges, summary, "Where it stands" with objectives and progress bar, "Where it stopped" note, verified next tasks with source labels, lessons, locked private files panel, right rail with the Request CTA, tech chips and lineage timeline. 404 for unknown slugs and for unpublished projects.
4. Open Graph metadata and sensible titles per page.

Acceptance:
- All three pages match the design at 1280 px and look correct at 390 px.
- Filters and search work and are shareable by URL.
- Lighthouse accessibility score at least 95 on these pages. Keyboard only navigation works.
- Demo badge shows on every demo project.
Report using the working agreement.
```

---

## Phase 3: Creator flow (consent, upload, ingestion)

```
Phase 3: creator wizard, advisor consent, upload and ingestion.

Goal: a signed in creator can create a project, collect team and advisor consent, and upload files that are parsed safely.

Do:
1. Wizard at `/share` with the Stepper from the design: Basics, Consent, Files, Verify, Publish. Autosave a draft project after each step. Resume from the dashboard.
2. Step Basics: title, summary, type of work, field, year, why it stopped, advisor name and email. Zod validation with inline errors.
3. Step Consent: list team members (creators) who must confirm; each confirmation stores `consented_at`. Create an advisor consent row, generate a token, show a "Copy consent link" button. Email sending is out of scope: the creator shares the link. Make this explicit in the UI copy.
4. Advisor page `/consent/[token]` (mobile first, per the Consent screen): shows what becomes public and what stays private, approve or "Not now" with an optional comment, no account needed. Token is hashed, expires, one decision, rate limited. Show a clear expired or already decided state.
5. Step Files: drag and drop plus file picker for PDF, Markdown, ZIP. Validate type by magic bytes and size. Upload to private Storage.
6. Ingestion pipeline in `src/lib/ingest/`: PDF text per page (pdfjs-dist), Markdown sections, ZIP tree listing with README and manifest reading only. Add the secrets scan and ZIP safety limits from CLAUDE.md section 8. Show per file status exactly like the design: Ready, Check, with plain explanations (for example "Two sensitive files were skipped and not stored").
7. Show the data notice on this step: what is read, by whom, what stays private.
8. The right rail "Before you can publish" checklist must reflect the real state (team consent, advisor approval, review).

Acceptance:
- Unit tests for: magic byte check, ZIP traversal rejection, secrets detection, token hashing and expiry.
- Manual run: create a project, copy the consent link, approve as advisor in a private window, upload a sample PDF, Markdown and ZIP, see the right statuses.
- A file with a `.env` inside the ZIP is skipped and reported.
Report using the working agreement.
```

---

## Phase 4: Synthesis and verification (the heart of the product)

```
Phase 4: synthesis engine and the verification screen.

Goal: turn uploaded files into a reviewable draft with evidence, and let the creator verify it. This is the most important feature. Build the mock path first, then the live path.

Do:
1. LLM adapter in `src/lib/llm/` with providers gemini, anthropic and mock, selected by `LLM_PROVIDER`. A single `synthesize(input)` function returns the Zod-validated JSON from CLAUDE.md section 7. Retry once on invalid JSON. Enforce input token limits by chunking pages and merging results.
2. Mock provider: deterministic output built from the extracted text (for example headings and TODO lines), plus one deliberately unsupported item so the "Evidence not found" state can be demonstrated. Show the banner "Simulated AI output (mock mode)" whenever `mode = mock`.
3. Prompt in `src/lib/llm/prompts.ts` following the rules in CLAUDE.md section 7. Treat file text as data. Include a short prompt injection test fixture in the tests.
4. Evidence matcher in `src/lib/evidence/` (normalize, match, fuzzy) and tests: exact, hyphenated line break, whitespace difference, wrong page, fabricated quote.
5. Server route to start a run (rate limited, daily cap), status polling, and storing `draft_items` with `evidence_status`.
6. Verify screen (step 4) exactly like the design: progress "x of n reviewed", item cards with kind, status chip, evidence chip, Keep, Edit (inline editing of title and description), Remove, toggle behavior, source viewer on the right with the highlighted quote or the amber "Evidence not found" explanation, footer with the publish button disabled until all items are reviewed and the advisor has approved. Creator can add their own item (origin = creator).
7. Publish step (step 5): preview of the teaser exactly as the public page will show, then publish. Use the database function that checks all rules. Log lineage events.

Acceptance:
- In mock mode, the full path upload, synthesize, verify, publish works with the seed archive and the published teaser appears on Explore.
- Publishing is impossible via the UI and via a direct API call while any item is pending or the advisor has not approved.
- Matcher and schema tests pass.
- A short note in README states honestly whether the live provider path has been tested and with which data.
Report using the working agreement.
```

---

## Phase 5: Request, approval, agreement, unlock

```
Phase 5: continuation requests, creator decision, attribution agreement, workspace and lineage.

Goal: finish the handover loop.

Do:
1. Request page `/projects/[slug]/request` as in the design: team name, teammates' emails, task selection from verified tasks, plan, purpose, target date, fit note, mandatory acknowledgment of the credit requirement. Zod validation, one open request per team per project.
2. Creator review page `/requests/[id]`: request details, decision card (Approve, Ask a question, Decline, optional message), progress indicator. Only creators can decide. Notify the other side.
3. Attribution agreement: versioned terms in `src/lib/agreement/terms.ts` (plain language: adopters credit creators and advisor by name in any submission that builds on the project; creators confirm they may share the files; original ownership stays with creators; new work belongs to adopters; ESTAFET logs the handover). Show the "not legal advice" note. Each side accepts with a checkbox; store `agreement_acceptances` with the version.
4. When both have accepted: set the request and project state, unlock the workspace for the adopter team, add lineage events, and generate a PDF of the agreement with names and date (`@react-pdf/renderer`). Provide the copyable credit line.
5. Workspace `/projects/[slug]/workspace`: private files with signed download links, the full backlog with evidence, lineage timeline, and the credit line. Only creators and approved adopters.
6. Lineage component used on the teaser and workspace: original team, published, requested, approved, continued. Append-only.

Acceptance:
- Playwright test of the whole core flow in mock mode: creator signs in, shares and publishes, adopter requests, creator approves, both accept, adopter opens the workspace and downloads a file. Non-members get 403 or redirect.
- An adopter cannot open the workspace after only the creator approved.
- Declined requests leave the project published.
Report using the working agreement.
```

---

## Phase 6: Dashboard, notifications and polish

```
Phase 6: dashboard and polish.

Goal: a complete, forgiving product.

Do:
1. Dashboard `/dashboard` per the design: summary tiles, tabs (My projects, My requests, Notifications), project pipeline with stages Draft, Advisor approval, Verify, Published, Continued, action buttons that deep link to the right step.
2. Notifications list (in app only): advisor decision, new request, decision on your request, agreement accepted. Mark as read.
3. Every page: loading, empty and error states; form errors that explain how to fix; confirmation before destructive actions; unsaved changes warning in the wizard.
4. Accessibility pass: keyboard, focus order, labels, contrast, reduced motion, screen reader names for icon buttons. Fix everything Lighthouse or axe reports.
5. Responsive pass at 390, 768, 1280 px. The advisor page must be excellent on a phone.
6. Performance: image-free pages, lazy load heavy components, measure LCP on Home.
7. Copy pass: plain English, consistent terms (creator, adopter, advisor, teaser, verified), no placeholders left outside demo data.

Acceptance:
- axe reports no serious issues on the main pages; Lighthouse accessibility at least 95.
- All empty and error states reachable and tested.
Report using the working agreement.
```

---

## Phase 7: Testing, deploy, handover documents

```
Phase 7: release.

Goal: something the judges can run and trust.

Do:
1. Deploy: Vercel for the app, Supabase cloud project for the database. Document every step and every environment variable (without values). Provide a read-only demo account and the demo credentials in the README (demo users only).
2. Local fallback: document `supabase start`, `supabase db reset`, `LLM_PROVIDER=mock`, `pnpm dev`. Verify on a clean clone.
3. docs/demo-script.md: a 5 minute walkthrough with exact clicks and data, and a "what if the network fails" fallback.
4. docs/architecture.md: system diagram in Mermaid, data model, policies table, synthesis pipeline, security notes.
5. README final: setup, supported environment, demo access, Status table (Done, Partial, Planned, honestly), known limitations, simulated or unfinished functionality, third-party resources and licenses, AI assistance disclosure (tool and role), member contributions table (fill with team input), starting and final versions (tags).
6. Run a dependency audit and a secret scan on the repo history.

Acceptance:
- A teammate who has never seen the project can run the core flow from the README in under 15 minutes.
- No secrets in the repo or history. Demo works with the network off (mock mode).
Report using the working agreement.
```

---

## Reserve for Final Day (declare these in the proposal and the deck)

Pick two or three of these, keep them unfinished on purpose before the build session, and record the starting commit. They are substantive and traceable, as the handbook requires.

1. Live LLM synthesis end to end on a consented real archive, with evidence matching tuned on real quotes, and a measured accept rate (items kept without edits).
2. Attribution agreement PDF, credit line and lineage view fully integrated, including email-free notifications.
3. Usability fixes from onboarding trials with 15 students (time to understand a project, task completion, SUS score), with before and after screenshots.
4. Handover readiness score on the Verify step (completeness of the project's documentation).
5. Lessons-learned view across projects (aggregate common funding feedback themes).

## Prompt for Final Day itself

```
Today is the STACK 2026 Final Day build session. Read CLAUDE.md and README.md. The starting commit is tagged final-day-start.

Declared tasks for today: [LIST THE 2 TO 3 TASKS].

Rules for today:
- Only work on the declared tasks and bug fixes needed to demo them.
- Commit small and often with descriptive messages so progress is traceable.
- At the end, update README.md: what changed since final-day-start, what is simulated or unfinished, known limitations, and who did what.
- Do not present anything as finished unless you ran it today.

Start by restating the tasks and proposing a 3 step plan for each. Wait for my confirmation.
```
