# Migration for release R7 (production readiness)

File: `supabase/migrations/20261125000001_r7_production.sql` (cloud step `11_r7_production.sql`). It only adds things. There is no automatic down migration; to undo, drop the objects listed here and the two profile columns.

| Addition | Why |
|---|---|
| `profiles.email_notifications` (default true), `profiles.locale` (`id` or `en`, default `id`) | A person's choice of notification emails and the language of their emails |
| `email_outbox` (no policies, no direct access) | Every email waits here until the sender delivers it. Stores the kind, language and content of the notification, **never the address** |
| `enqueue_emails()` (service role) | Copies notifications that deserve an email, and the outcome of reports from signed-in reporters, into the outbox. Only the last 3 days. Honours the preference, except for essential safety emails; a skipped one is stored as `skipped` so it is not looked at again |
| `claim_emails(limit)`, `finish_email(id, ok, error)` (service role) | The sender's two calls. Claiming uses `for update skip locked`, so two runs never send the same row; a row stuck in `sending` for 10 minutes is handed out again. A failure is retried after 5, 15, 45 and 135 minutes and is final after 5 attempts. The stored error is a short code |
| `housekeeping()` (service role) | Deletes sent and skipped outbox rows older than 90 days and rate limit rows older than 2 days |
| `set_email_preferences(enabled, locale)` | A signed-in person changes their own preference and language. An unknown language is ignored |

No new error hint was added.

Rules that have database tests (`tests/db/r7.test.ts`, 12 tests, and `tests/db/r7-dispatch.test.ts`, 5 tests): a visitor and a signed-in person cannot call the sender functions or read the table; a listed notification is queued once and an unlisted type is not; no address is stored; the language comes from the profile; the preference is respected except for essential emails; a reporter hears the outcome; claiming, success, retry with a growing delay, final failure and recovery of a stuck row; housekeeping keeps recent mail; the full sender against a fake SMTP server on this machine.

## Not in this migration

- The schedule itself (Vercel Cron or `pg_cron`): see `docs/runbook.md`.
- Supabase Auth settings (confirm email, SMTP, template): dashboard settings, see `docs/email.md`.
