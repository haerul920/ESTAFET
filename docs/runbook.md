# Runbook

How to deploy, schedule jobs, watch the site, restore data, and handle incidents. Written for the team that runs ESTAFET. Read `docs/environments.md` first.

> **Honesty note.** Everything here was written and, where marked, run on the **local** stack. No hosted staging or production project exists yet, so the hosted steps (backups in the Supabase dashboard, the uptime monitor, the alert webhook, a Vercel deploy) have **not been executed**. The checklist in `docs/operations-checklist.md` is where each one is ticked off the first time.

## Who to contact

[TEAM TO CONFIRM before launch]

| Role | Name | How to reach | Covers |
|---|---|---|---|
| Owner (decides on launch, legal text, takedowns) | | | everything |
| On-call engineer | | | outages, deploys, restores |
| Moderation lead | | | reports, appeals, holds |
| Campus contact | | | legal review, student complaints |

## Deploy

1. Merge to the release branch only when CI is green (lint, types, unit tests, i18n check, database tests, overlap audit, audit, secret scan).
2. If the release has a new file in `supabase/migrations/`, run its matching file from `supabase/cloud-sql/` in the SQL Editor **before** deploying the code that needs it. Run files one at a time; the release notes in `docs/migrations-rN.md` say what each one adds. Migrations only add, so the old code keeps working until the new code goes live.
3. `pnpm config:check --file <env file>` for the target environment.
4. Deploy (Vercel: push to the branch connected to that environment).
5. Check `https://<address>/api/health` answers `{"status":"ok","database":"up"}`, open the home page and one project page, sign in as an admin and open `/admin`.
6. Watch the logs for `request.error` and `alert.*` lines for ten minutes.

## Roll back

- **Code:** redeploy the previous build (Vercel: Deployments, previous one, Promote).
- **Database:** there is no automatic down migration. Each `docs/migrations-rN.md` lists the objects a release added; because releases only add, the previous code runs on the newer schema. Drop an added object only when you know nothing uses it. If data was damaged, use **Restore** below.

## Scheduled jobs

Two routes do all the periodic work. Both need the header `Authorization: Bearer <CRON_SECRET>` and are safe to run twice.

| Route | When | Does |
|---|---|---|
| `/api/cron/emails` | every 10 minutes | queues new emails, sends due ones, retries failures |
| `/api/cron/daily` | once a day, 03:00 WITA (19:00 UTC) | expires old requests (`expire_requests`), reminds owners 3 days before a request expires, alerts admins about holds past their review target (`escalate_overdue_holds`), finishes account deletions after the 30 day grace period, removes old outbox and rate limit rows (`housekeeping`) |

The daily AI cap needs no reset job: the caps count runs in the last 24 hours.

**Option A, Vercel Cron.** `vercel.json` already lists both. Set `CRON_SECRET` in the Vercel project and Vercel sends the header itself. Cron jobs that run more than once a day need a paid Vercel plan; on a free plan only the daily job can be scheduled, so use option B for the email job.

**Option B, Supabase `pg_cron` calling the routes** (works on any host). In the SQL Editor of the project, with your own address and secret:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('estafet-emails', '*/10 * * * *', $$
  select net.http_get(url := 'https://YOUR-ADDRESS/api/cron/emails',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET'))
$$);
select cron.schedule('estafet-daily', '0 19 * * *', $$
  select net.http_get(url := 'https://YOUR-ADDRESS/api/cron/daily',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET'))
$$);
```

The secret ends up in `cron.job`, so only database admins can read it. To stop a job: `select cron.unschedule('estafet-emails');`.

**Run a job by hand:** `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<address>/api/cron/daily`. The answer lists each step and whether it worked (HTTP 500 if any step failed).

**Account deletions by hand** (if the daily job keeps failing on one account): `pnpm deletions:process` with the project's keys. It prints account ids only.

Tested locally: the routes refuse a missing or wrong secret, run every step on the local database, and an unknown job is a 404 (`tests/e2e/ops.spec.ts`). The `pg_cron` and Vercel schedules themselves have **not** been run.

## Watch the site

**Uptime.** Point an uptime monitor (UptimeRobot, Better Stack, or the host's own) at `https://<address>/api/health` every minute. It answers 200 when the app reaches its database and 503 otherwise, and says nothing about versions or people. Alert on two failures in a row.

**Logs.** The app writes one JSON line per event to standard output (`src/lib/log.ts`): `level`, `event`, ids, counts, never email addresses, names, file contents or tokens. Connect the host's log drain to a log service. Useful events: `request.error` (an unhandled error with its route and class), `email.failed`, `email.retry`, `cron.step_failed`, `rate_limit.unavailable`, `upload_scan.error`, `alert.*`.

**Error tracking.** ESTAFET does not bundle Sentry. Unhandled errors are captured by `onRequestError` (`src/instrumentation.ts`) as `request.error` lines with the route, method and error class, which a log drain can alert on. If you want stack traces and grouping, add the Sentry Next.js SDK later; it needs a Sentry project and was not set up.

**Alerts.** `alert()` writes an `alert.<code>` error line and, when `ALERT_WEBHOOK_URL` is set, posts one short message to a Slack or Discord compatible webhook. Suggested rules:

| Condition | Where it comes from | Do |
|---|---|---|
| Error spike | more than 20 `request.error` lines in 5 minutes (a log-drain rule) | open the logs, find the route, roll back if the last deploy caused it |
| Failed emails | `alert.email_failed` (a message failed 5 times) | check the provider's dashboard and `EMAIL_PROVIDER` variables, then `select template, last_error, count(*) from email_outbox where status = 'failed' group by 1, 2;` |
| Scheduled job failed | `alert.cron_failed` or HTTP 500 from the route | run the job by hand and read the step that failed |
| AI cap reached | `alert.synthesis_cap` (once a day) | decide whether to raise `SYNTHESIS_GLOBAL_DAILY_CAP`; owners see a friendly message and can fill in by hand |
| Failed AI runs | `/admin/pipeline` shows failures; the overview lists failed runs | check the provider status and keys |
| Holds past their target | admin alert emails and the overview | a moderator decides |

Nothing in this table has been wired to a real webhook, drain or monitor yet.

## Backups and restore

**What is backed up.** The database (accounts, projects, files' records, requests, agreements, lineage, audit log) and file storage (`project-files`, `extracted-text`) are in the project's Supabase. Turn on backups in the dashboard: **Database, Backups** (daily backups, and Point in Time Recovery as an add-on, both depend on the plan). **Not yet done:** choosing the plan and enabling them, and an off-site copy of the storage buckets (Supabase's database backups do **not** include the files in Storage; copy them with `supabase storage cp` or an S3 sync on a schedule).

**Extra copy you control.** Weekly, from a trusted machine, with the connection string of the *direct* database connection (Settings, Database):

```bash
pg_dump "$DATABASE_URL" -Fc -n public -n auth -n storage -f estafet-$(date +%F).dump
```

Keep it encrypted and off the hosting account. It contains personal data.

**Restore procedure (hosted).**

1. Decide the target: restore into a **new** project first (never over the live one), so you can inspect it.
2. Dashboard restore: **Database, Backups**, pick the point in time. Or from a dump: create a new project, run the numbered files in `supabase/cloud-sql/` (schema and functions), then `pg_restore --data-only --disable-triggers -d "$NEW_URL" -n public -n auth estafet.dump`; re-create storage objects from the off-site copy.
3. Verify: row counts of the main tables against the source (`select count(*)` on `profiles`, `projects`, `continuation_requests`, `audit_log`), sign in as a test admin, open a project and download a file.
4. Switch the app: change `NEXT_PUBLIC_SUPABASE_URL` and the keys in the host, redeploy, run `/api/health`.
5. Tell users what period of data may be missing if the restore point was before the incident.

**Restore drill (local, tested).** `pnpm restore:drill` dumps the local database, restores the dump into a scratch database, compares the row count of every table in `public` and of `auth.users`, checks that row level security, all policies and the audit-log trigger survived, and drops the scratch database. Last run: 30 tables, 9,414 rows, all equal, 33 policies, passed in 23 seconds (local Docker, 2026-11-22). **Not yet done:** the same drill on a hosted staging project. Do it once before launch and every quarter, and write the date in `docs/operations-checklist.md`.

## Incidents

Severity: **high** = data exposed or the site is down; **medium** = a feature is broken for many people; **low** = one person or a cosmetic problem.

**The site is down or slow.** Check `/api/health` (503 means the database is unreachable), the host's status page and Supabase's status page. If the last deploy is to blame, roll back. Post an announcement in `/admin/announcements` if the admin area still works.

**Personal data or private files may have been exposed.** (1) Stop the leak: unpublish or hide the project (`/admin/projects`), revoke the access, rotate any key that may have leaked (Supabase keys, `CRON_SECRET`, email and AI provider keys) and redeploy. (2) Preserve evidence: do not delete audit rows; export `/admin/audit`. (3) Find out who and what: the audit log and `break_glass_access` show admin access; storage access logs show downloads. (4) Tell the owner, the affected people and, where required, the campus data contact, plainly and soon. [TEAM TO CONFIRM: who decides on notifying the authorities and the legal basis for deadlines.] (5) Write a short post-mortem.

**Abuse wave (spam reports, fake sign-ups).** Turn off registrations in `/admin/settings` (existing users keep working), dismiss spam in bulk in `/admin/reports` (spam reason only), check Turnstile is on, lower the rate limits in code if needed.

**A wrong automatic hold.** A project held by reports is hidden from public lists with a neutral notice. A moderator reviews it within the target (default 3 days) and restores, hides or removes it with a written reason; the owner can appeal.

**Emails are not arriving.** Check `alert.email_failed`, `email_outbox` (`pending` rows with `last_error`), the provider dashboard and SPF/DKIM/DMARC (`docs/email.md`). Remember Supabase Auth emails (confirmation) are sent by Supabase's SMTP settings, not by the app.

**A key leaked.** Rotate it in its dashboard, update the host's variables, redeploy, and check logs for use of the old key. The service role key bypasses row level security, so treat it as the most serious.

## Admin access

Admins are promoted only with SQL run by the project owner: `select public.promote_admin('person@example.com');`. There is no screen for it. The last admin cannot be demoted, and nobody can suspend themselves.
