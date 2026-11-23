# Admin guide

The admin area (`/admin`) is an internal tool for keeping ESTAFET trustworthy during the competition. Read `CLAUDE.md` section 13 for the rules. The short version:

- Admins see **metadata and public teasers**. Private files, extracted text and evidence quotes stay hidden unless you use **break glass**.
- **Every admin write is audited** with who, what, why and before/after values.
- Hide, remove, suspend, break glass, settings and purge need a **reason of 15+ characters**. Remove, suspend, break glass, settings and purge also need a **password check** (remembered for 15 minutes).
- There is **no hard delete**, except "Purge demo data" outside PRODUCTION.
- Non-admins and guests get **404** on every admin route.
- Times are shown in **WITA**. Hover a time for the exact value.

## Becoming an admin

Admins are promoted only with a SQL function and the **service role**. There is no button for it.

```sql
-- Supabase SQL Editor (runs as the service role) or psql as postgres
select public.promote_admin('person@student.unhas.ac.id');
-- to remove admin access later (refuses to demote the last admin):
select public.demote_admin('person@student.unhas.ac.id');
```

The person must already have an account. Both calls are written to the audit log.

**Demo only:** with `SEED_DEMO=true`, `pnpm db:reset` also creates `admin@estafet.demo` (password `Demo-Pass-2026!`). Production never seeds an admin.

**An admin account is for admin work only** (team decision, 2026-11-23). After sign-in an admin lands on `/admin`, and every user page and user action (dashboard, first-run screen, share wizard, requests, project workspace, project settings and decisions, "Laporan saya") sends them to `/admin`. Admins still see the public pages (home, Explore, teasers, legal pages), their own `/akun/privasi`, and the policy screen. The nav shows "Admin" instead of "Dasbor" and hides "Bagikan proyek", notifications and "Laporan saya". To share or continue a project, use a separate, non-admin account. Projects an admin already owns keep their data; they are managed through the admin pages or after `demote_admin`.

## Pages

| Page          | What you do there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**  | Queue cards that link to the right filtered list (open reports, hidden projects, failed runs in 24 h, expired advisor consents, requests pending 7+ days), key numbers, last 10 audit events. Demo rows are excluded unless you tick "Include demo data".                                                                                                                                                                                                                                           |
| **Projects**  | Find a project. Filters: status, moderation, field, demo. The detail page shows metadata, a teaser preview (titles only), evidence counts, files as metadata, requests, advisor consent state, lineage, and this project's audit history. Actions: **Hide**, **Remove**, **Restore**.                                                                                                                                                                                                               |
| **Reports**   | The queue of reports from public teaser pages. Open one for the panel: details, project preview, creators, advisor, earlier reports. Decide: **Dismiss**, **Mark in review**, **Hide project**, **Remove project**. Every outcome needs a resolution note.                                                                                                                                                                                                                                          |
| **Users**     | Search by name or email. **Suspend** (reason, optional end date) or **Restore**. You cannot suspend yourself.                                                                                                                                                                                                                                                                                                                                                                                       |
| **Pipeline**  | Synthesis runs, today against the daily cap, failure rate, and a MOCK MODE badge when the provider is `mock`. **Retry** a failed run or **Cancel** a stuck one. No document text is shown.                                                                                                                                                                                                                                                                                                          |
| **Email log** | Product emails from the outbox: sent, failed, waiting and skipped in the last 7 days, and the active email provider (a warning when it is `none` or `log`, so nothing is delivered). Open a row for the template, recipient, attempts and a plain explanation of the error code. **Send again** works only for a failed **essential** email (moderation, appeal outcome, revoked access, admin alerts) and needs a reason. Addresses and message text are never shown. Bounces are not tracked yet. |
| **Consents**  | Advisor consents. **Regenerate link** creates a new private link (shown once, the old one stops working). **Copy reminder text** gives a message the creator can send.                                                                                                                                                                                                                                                                                                                              |
| **Requests**  | Read-only view of continuation requests. Pending 7+ days and "approved, waiting for agreement" are highlighted. You can add an admin note. You cannot decide for the creators.                                                                                                                                                                                                                                                                                                                      |
| **Trials**    | Record onboarding sessions, see per-cohort results with n, the chart, CSV export and the methods paragraph. See `docs/trial-protocol.md`.                                                                                                                                                                                                                                                                                                                                                           |
| **Audit**     | Filter by actor, action, target type and date. Open a row for a before/after diff. Export the current filter as CSV. The log cannot be edited.                                                                                                                                                                                                                                                                                                                                                      |
| **Settings**  | Allowed email domains, registrations open, contact address, upload limit, synthesis daily cap, advisor link lifetime, demo banner. Each shows its source (set here, env default, built-in default). Changes apply immediately.                                                                                                                                                                                                                                                                      |

**Compact rows** in the top bar makes tables denser on wide screens; the choice stays in this browser. Filters, sort and page live in the address, so a filtered list can be bookmarked or shared.

Shortcuts: `/` search, `g` then `p`/`r`/`u`/`a`/`o` to jump, `?` for help, `Enter` on a focused row link opens it.

## How to handle a report (about 5 minutes)

1. **Reports**, filter `status = open`. Open the newest row.
2. Read the details and the project preview. Check "earlier reports on this project".
3. If it is clearly wrong or unsafe, press **Hide project** (reversible). Write a note the creators will read: it is sent to them as the reason.
4. If it is not an issue, **Dismiss** with a short note.
5. If you need time, **Mark in review** so teammates know.
6. Hiding takes the project off Explore and its public page (404) at once. Nothing is deleted. To undo: **Projects**, find the project (filter moderation = hidden), **Restore**.
7. Check **Audit**: you should see `report.hide` and `project.hidden` with your note.

Use **Remove** only for serious cases (for example personal data). It is also reversible by **Restore**, but needs a password check.

## Break glass policy

Emergency access to a private file is **only for legal or safety review**.

- Needs a reason (15+ characters), a password check, and typing `OPEN PRIVATE FILE`.
- One file at a time. The link works for **5 minutes**. A red banner with a countdown stays visible.
- The project's creators get a notification with your reason. `break_glass_access` and the audit log record it.
- Do not copy or share what you see unless the review requires it.

## Suspending a user

A suspended user cannot sign in or act (share, request, upload, download). Their published teasers stay visible unless you moderate them separately. They see a message with the contact address from Settings. Restore any time.

## Before the demo checklist

- [ ] `pnpm db:start`, `pnpm db:reset`, `pnpm dev:local` (or your normal dev command) and sign in as the demo admin.
- [ ] **Pipeline**: is the provider what you expect? In mock mode the badge says MOCK MODE and the banner "Simulated AI output (mock mode)" shows to creators. Switch the provider with `LLM_PROVIDER` and restart if you want live.
- [ ] **Settings**: check the upload limit and the synthesis daily cap (a low cap blocks a live demo). Set a **contact address**.
- [ ] **Consents**: no demo consent expired. Regenerate the links you will use.
- [ ] **Settings, Display**: decide whether the demo banner should show.
- [ ] **Overview**: queues are what you expect. Tick "Include demo data" to see the seeded numbers.
- [ ] Demo accounts work (`creator@`, `adopter@`, `alumni@`, `admin@estafet.demo`). `APP_ENV` is LOCAL or STAGING, never PRODUCTION, if you plan to use Purge demo data.

## Danger zone

**Purge demo data** deletes only rows marked demo (demo projects with their files, items, requests, lineage, and demo trial sessions). It works only outside PRODUCTION, needs a reason, a password check and typing `PURGE DEMO DATA`. It is the one exception to the append-only lineage rule, and the purge itself is audited. `pnpm db:reset` brings demo data back.
