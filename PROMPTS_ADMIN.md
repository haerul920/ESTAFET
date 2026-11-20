# ESTAFET: admin area prompts for Claude Code

This file extends `CLAUDE.md` and `PROMPTS.md`. Use it after Phase 5 (the handover loop must exist, because admins moderate and monitor it). It can run in parallel with Phase 6.

How to use

1. Append the block "CLAUDE.md addendum" below to the end of `CLAUDE.md` (section 13). This is the binding spec for the admin area.
2. Paste the phase prompts 8A to 8E one at a time, in order.
3. The admin area is an internal tool. Keep it simple, safe and fast to use. It must never become a way to read students' private work casually.

Priority if time is short: 8A and 8B are the minimum. 8D gives real evidence for the "validation" criteria in the handbook. 8C, 8E are polish.

---

## CLAUDE.md addendum (append as section 13)

```
## 13. Admin area

Purpose: keep the platform trustworthy and running during the competition and afterwards. Moderate content, support users, watch the pipeline, record onboarding trials, and prove who did what.

### 13.1 Principles
- Least privilege and privacy first. Admins see metadata and public teasers by default. Private files, extracted text and evidence quotes from private files are NOT visible to admins unless they use "break glass" (13.4).
- Every admin write is audited. No exceptions.
- Prefer reversible actions (hide, suspend) over destructive ones. The UI offers no hard delete, except "Purge demo data" outside production.
- Admin is internal, so density and speed matter more than decoration. It still follows the design system (CLAUDE.md section 9), in a calmer, denser form.
- Honest data: trial results and metrics shown in admin are real or labeled demo. Never generate fake results.

### 13.2 Routes (all require admin, enforced in middleware, server code and RLS)
| Route | Purpose |
|---|---|
| `/admin` | Overview: queues, health, key numbers |
| `/admin/projects`, `/admin/projects/[id]` | Moderation of projects |
| `/admin/reports` | Content reports queue |
| `/admin/users`, `/admin/users/[id]` | Users, suspend or restore |
| `/admin/pipeline` | Synthesis runs, failures, caps |
| `/admin/consents` | Advisor consents, expired or pending |
| `/admin/requests` | Continuation requests, stuck or disputed |
| `/admin/trials` | Onboarding trial sessions and results |
| `/admin/audit` | Audit log viewer and export |
| `/admin/settings` | Platform settings |

### 13.3 Data model additions
- `profiles`: add `is_admin bool default false`, `suspended_at timestamptz null`, `suspended_reason text null`.
- `projects`: add `moderation_status enum[ok, hidden, removed] default ok`, `moderation_reason text null`, `moderated_by uuid null`, `moderated_at timestamptz null`. Moderation is separate from lifecycle `status`. Public pages show a project only if `status in (published, adopted)` AND `moderation_status = ok`.
- `reports(id, project_id, reporter_id null, reporter_contact null, reason enum[copyright, personal_data, inaccurate, inappropriate, other], details, status enum[open, in_review, resolved, dismissed], resolution_note, handled_by, handled_at, created_at)`. Anyone can submit a report from the teaser page (rate limited, no account needed, contact optional).
- `audit_log(id, actor_id, action text, target_type text, target_id uuid null, reason text null, before jsonb null, after jsonb null, ip_hash text null, created_at)`. Append-only: no update, no delete, enforced by RLS and a trigger.
- `app_settings(key text primary key, value jsonb, updated_by, updated_at)`. Keys: `allowed_email_domains`, `max_upload_mb`, `synthesis_daily_cap`, `advisor_token_ttl_days`, `show_demo_banner`, `registrations_open`. Env vars become defaults, settings override them.
- `trial_sessions(id, participant_code, cohort enum[baseline, estafet], project_id, started_at, minutes_to_understand numeric, completed bool, correct_answers int, total_questions int, sus_score numeric null, notes text null, consent_confirmed bool, is_demo bool, recorded_by)`. Participant codes are pseudonyms like P01. No names, no emails.
- `break_glass_access(id, admin_id, project_id, file_id null, reason text, expires_at, created_at)`.

### 13.4 Rules
- SQL function `is_admin()` (security definer, stable) backs every admin policy.
- All admin mutations go through SQL functions named `admin_*` that write the change and the `audit_log` row in one transaction. The UI never writes admin tables directly.
- Destructive or visibility-changing actions (hide, remove, suspend, break glass, settings change, purge demo data) require a reason of at least 15 characters. Store it in `audit_log.reason`.
- Re-authentication within the last 15 minutes is required for suspend, remove, break glass, settings and purge.
- An admin cannot suspend themselves or remove their own admin flag. The last admin cannot be demoted. Admin promotion happens only through a documented SQL function run with the service role, never through the UI.
- Break glass: reason required, signed URL valid for 5 minutes, one file at a time, logged in `break_glass_access` and `audit_log`, and the project's creators receive an in-app notification. Show a persistent red banner while a break glass view is open.
- Taking a project down (hidden or removed) does not delete data and does not revoke an existing signed agreement. Creators get a notification with the reason.
- Suspended users cannot sign in or act. Their published teasers stay visible unless moderated separately.
- Times are stored in UTC and displayed in WITA (Asia/Makassar) with the absolute time in a tooltip.
- Stats come from SQL views, not from client side aggregation.
- Demo mode: seed data and trial rows with `is_demo = true` are excluded from "real" metrics by default, with a toggle to include them.
```

---

## Phase 8A: Roles, security, audit, admin shell

```
Phase 8A: admin foundation.

Read CLAUDE.md (including section 13) and the design system in section 9. This phase is authorized to change the data model exactly as listed in section 13.3. Do not add anything else without asking me.

Goal: a locked down admin area with an audit trail and a usable shell, with no features inside yet except the overview.

Do:
1. Migrations for the 13.3 additions, `is_admin()`, RLS policies, the append-only trigger on `audit_log`, and a generic `write_audit(...)` helper function. Update the public views and policies so hidden or removed projects disappear from Explore, the teaser page and search.
2. Admin promotion: a SQL function `promote_admin(email)` callable only with the service role, documented in README. In seed data, create one demo admin only when `SEED_DEMO=true`, with credentials documented as demo only. Production seeds no admin.
3. Middleware and server guards: every `/admin/*` route and every admin server action checks `is_admin()` on the server. Non-admins get 404 (not 403) on admin routes so the area is not advertised. Add a `requireAdmin()` helper and a `requireRecentAuth(minutes)` helper.
4. Re-authentication dialog: asks the admin to confirm their password before sensitive actions, remembers it for 15 minutes in the session.
5. Admin shell: left sidebar with grouped links (Overview; Moderation: Projects, Reports; People: Users; Operations: Pipeline, Consents, Requests; Evidence: Trials; Governance: Audit, Settings), a top bar with the admin's name, a search field, a link back to the public site, and an environment badge (LOCAL, STAGING, PRODUCTION). Calm denser look: grey surfaces, 24 px card radius, mono uppercase section labels, lime only for the primary action on a page. Collapses to a drawer below 900 px.
6. Shared admin components in `src/components/admin/`: DataTable (server driven sorting, filters and pagination through URL params, sticky header, keyboard accessible rows, row action menu, loading and empty states, mobile card layout), FilterBar (search plus filter chips, saved in the URL), StatCard, StatusPill, ReasonDialog (requires reason, shows what will happen), TypedConfirmDialog (type a phrase for dangerous actions), Toast with Undo, EmptyState, Timeline, KeyValueList.
7. `/admin` overview: queue cards that deep link (open reports, projects awaiting nothing but hidden, failed synthesis runs in the last 24 hours, expired advisor consents, pending requests older than 7 days), key numbers (projects by status, requests by status, users), and a "recent audit events" list of the last 10. All numbers from SQL views.
8. Audit helper in the app: every server action that mutates admin data must call the matching `admin_*` function. Add a lint style test that fails if a file under `src/app/admin` imports a table writer directly.

Acceptance:
- Tests: a normal user and an anonymous visitor get 404 on every `/admin` route and are rejected by every `admin_*` function and policy; an admin can read the overview; `audit_log` rejects update and delete; the last admin cannot be demoted; an admin cannot suspend themselves.
- The shell is keyboard navigable, passes axe with no serious issues, and works at 900, 1280 and 1440 px.
Report using the working agreement.
```

---

## Phase 8B: Moderation (projects, reports, users)

```
Phase 8B: moderation.

Goal: admins can handle a report from arrival to resolution, safely and quickly.

Do:
1. Public side: add a "Report this project" action on the teaser page (small, unobtrusive). Form: reason, details, optional contact, with a short honest note about what happens next. Rate limit per IP hash. No account required. Confirmation state afterwards.
2. `/admin/reports`: DataTable with columns Reported (relative time), Project, Reason, Status, Handler. Filters: status, reason, assigned to me. Row opens a side panel with details, project teaser preview, creators, advisor name, previous reports on the same project, and a decision area: Dismiss, Mark in review, Hide project, Remove project. Every outcome requires a resolution note, writes audit, and notifies the creators with the reason (for hide or remove).
3. `/admin/projects`: DataTable with Title, Creators, Status, Moderation, Demo, Updated, Open reports count. Filters: status, moderation, demo, field. `/admin/projects/[id]`: metadata, lifecycle timeline (lineage events), public teaser preview, evidence status summary (counts of matched, partial, not found, without showing private quotes), files list as metadata only (name, type, size, skipped sensitive count), requests list, advisor consent state, audit history for this project. Actions: Hide, Remove, Restore (all through ReasonDialog, with Undo toast for Hide and Restore).
4. Break glass: on the project page, a clearly separated "Emergency access to private files" section. Needs a reason, re-auth and typed confirmation. Opens one file with a 5 minute signed URL, shows the red banner, writes `break_glass_access` and audit rows, and notifies the creators. Include a short explanation that this is only for legal or safety review.
5. `/admin/users`: DataTable with Name, Email, University, Role flags, Projects, Last active, Status. Search by name or email. `/admin/users/[id]`: profile, projects and requests, activity from audit, and actions Suspend (reason, optional until date) and Restore. Suspended users see a clear message at sign in explaining how to contact the team (a contact address from settings).
6. Notifications: creators see an in-app notice for hide, remove, restore and break glass, with the reason.

Acceptance:
- Playwright test: a visitor submits a report, an admin hides the project with a reason, the project disappears from Explore and its teaser returns 404, the creators get a notification, the admin restores it, it reappears. All steps appear in the audit log with reasons.
- A suspended user cannot sign in or call actions.
- Break glass writes both log rows, expires after 5 minutes, and the creators are notified.
Report using the working agreement.
```

---

## Phase 8C: Operations (pipeline, consents, requests, settings)

```
Phase 8C: operations.

Goal: admins can keep the product running smoothly during the demo and the competition.

Do:
1. `/admin/pipeline`: table of synthesis runs (Project, Provider, Model, Mode live or mock, Status, Duration, Error summary, Started). Filters by status, mode, date range. Detail panel with the sanitized error, item counts by evidence status, and input size, never the document text. Actions: Retry a failed run (counts toward the daily cap), Cancel a stuck run. Top strip: today's runs against the daily cap, failure rate in the last 24 hours, and the active provider with a visible "MOCK MODE" badge when active.
2. `/admin/consents`: advisor consents with Status, Project, Advisor, Expires, Age. Filters: pending, expired, declined. Actions: Regenerate link (creates a new token, invalidates the old one, shows the new link once to copy), and "Copy reminder text" that produces a short message the creator can send. Audit every action.
3. `/admin/requests`: continuation requests with Status, Project, Team, Created, Last change. Highlight requests pending more than 7 days or approved but waiting for an agreement signature. Read-only detail, plus an admin note field visible only to admins. Admins cannot approve or decline on behalf of creators.
4. `/admin/settings`: form sections for Access (allowed email domains, registrations open), Limits (max upload size, synthesis daily cap, advisor token lifetime), Display (show demo banner). Validate with Zod, show the current effective value and its source (setting or env default), save with a reason, audit the before and after, and apply immediately without redeploy. Include a "Danger zone" with "Purge demo data" that works only when the environment badge is not PRODUCTION, requires a typed phrase and re-auth, and only deletes rows with `is_demo = true`.
5. Make the ingestion, synthesis and consent code read limits from `app_settings` with env fallback, and add tests for that.

Acceptance:
- Changing the upload limit in settings changes the limit on the next upload, and the change is in the audit log with before and after.
- Retry and regenerate-link flows work and write audit rows.
- Purge demo data refuses to run in production mode and never touches non-demo rows (test with mixed data).
Report using the working agreement.
```

---

## Phase 8D: Onboarding trials and metrics (evidence for validation)

```
Phase 8D: trials and metrics.

Goal: let the team record real onboarding trials and see the results, so claims such as "understand a project within 30 minutes" are backed by honest data.

Context: the proposal plans onboarding trials with about 15 students. The design compares a baseline (understanding a project from raw files such as a Drive folder) with using an ESTAFET project page. The results must be recorded accurately and never invented.

Do:
1. `/admin/trials`: table of sessions (Participant code, Cohort baseline or ESTAFET, Project, Minutes to understand, Completed, Score, SUS, Demo flag, Date). Filters by cohort, project, demo. A "Record session" side panel: participant code (pseudonym), cohort, project, start time, minutes, completed, comprehension questions correct and total, optional SUS score (0 to 100), notes, and a required checkbox "Participant consented to being included". Validation with Zod. Edits are allowed and audited.
2. Summary strip from a SQL view: count per cohort, median and mean minutes to understand per cohort, completion rate per cohort, mean comprehension score per cohort, mean SUS for ESTAFET, and the share of ESTAFET sessions finished within 30 minutes. Show n next to every number. If n is under 5 per cohort, show a visible "Too few sessions to conclude" note instead of a confident headline.
3. A simple chart of minutes to understand by cohort (a dot strip plus median line, accessible with a data table fallback). Keep it plain.
4. Export CSV of the sessions (without any personal identifiers) and a one paragraph "methods and limits" text generated from the settings you choose, which the team can paste into the proposal. The text must state sample size, that participants are students at one university, and that results are indicative.
5. Demo rows (`is_demo = true`) are excluded by default from the summary, with a toggle to include them, and carry a Demo badge.
6. Add a short `docs/trial-protocol.md`: how to run a baseline session and an ESTAFET session consistently (same comprehension questions, same timer rule, same consent wording), so the numbers are comparable.

Acceptance:
- Unit tests for the SQL view against a small fixture (known medians, means and the within-30-minutes share).
- CSV export contains no names or emails.
- With fewer than 5 sessions in a cohort the page shows the "Too few sessions" note.
Report using the working agreement.
```

---

## Phase 8E: Audit viewer, polish, tests

```
Phase 8E: governance and polish.

Goal: make the admin area trustworthy and pleasant to use.

Do:
1. `/admin/audit`: DataTable of audit events (When, Actor, Action, Target, Reason). Filters: actor, action, target type, date range. Row detail shows a readable before and after diff. Export CSV for the current filter. Make it clear the log cannot be edited.
2. Global admin search in the top bar (press `/` to focus): finds projects by title or slug, users by name or email, reports by project, and opens the result. Results grouped by type.
3. Keyboard and speed: `g` then `p` goes to Projects, `g` then `r` to Reports, `g` then `u` to Users; `?` shows the shortcuts. Table rows can be opened with Enter. Do not break browser shortcuts.
4. Empty, loading and error states on every admin page; consistent toasts; Undo where reversible; focus returns to a sensible place after dialogs close.
5. Accessibility and responsive pass: axe with no serious issues, contrast AA, visible focus, reduced motion respected, usable on a tablet.
6. Playwright smoke tests for the admin area: login as demo admin, open each page, perform one moderation action, change one setting, record one trial, check the audit entries. Add them to `pnpm check` or a separate `pnpm test:e2e:admin` script.
7. Docs: `docs/admin-guide.md` with a short how-to for each page, the break glass policy, how to promote an admin, and a "before the demo" checklist (switch off mock banner if needed, check caps, check demo accounts, check consents not expired). Update README: admin features in the Status table (Done, Partial, Planned, honestly) and the AI assistance section if anything changed.

Acceptance:
- Every admin mutation in the codebase produces an audit row (verify with a test that runs each action and counts rows).
- Smoke tests pass on a clean local stack with `LLM_PROVIDER=mock`.
- A teammate can follow `docs/admin-guide.md` to handle a report end to end in under 10 minutes.
Report using the working agreement.
```
