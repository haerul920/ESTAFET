# Operations checklist

Tick each line the first time it is really done, and write the date and who did it. Nothing below has been done on a hosted environment yet unless a date is written next to it. "Local" means it was run on the developer stack.

## Before the first deploy to staging

- [ ] New Supabase project for staging; all `supabase/cloud-sql/` files run in order, one at a time. No demo data.
- [ ] First admin created with `select public.promote_admin(...)`.
- [ ] Supabase Auth: **Confirm email** is ON, site URL and redirect URL set, custom SMTP set, confirmation template pasted (`docs/email-templates/confirm-signup.html`).
- [ ] Host project for staging with the variables from `docs/environments.md`, `APP_ENV=STAGING`, a 32+ character `CRON_SECRET`.
- [ ] `pnpm config:check --file <staging env file>` prints OK.
- [ ] Deployed. `/api/health` answers `{"status":"ok","database":"up"}`.
- [ ] Staging answers `X-Robots-Tag: noindex` and `/robots.txt` disallows everything.

## Email

- [ ] Provider account created, sender domain verified.
- [ ] SPF, DKIM, DMARC published; a test mail shows PASS for all three (`docs/email.md`).
- [ ] A real notification (a new request) reaches an inbox in Indonesian, and again in English after changing the language in `/akun/privasi`.
- [ ] A forced failure (wrong key) shows `email.retry`, then `alert.email_failed` after five attempts.
- [ ] Local: templates render for every type in both languages (`tests/unit/email.test.ts`); the sender works against a fake SMTP server (`tests/db/r7-dispatch.test.ts`) (2026-11-22, local).

## Scheduled jobs

- [ ] Schedule created (Vercel Cron or `pg_cron`, `docs/runbook.md`).
- [ ] `curl` with the secret returns 200 for `/api/cron/emails` and `/api/cron/daily` on staging; without the secret returns 401.
- [ ] After a day, the host's logs show `cron.done` for `daily`.
- [ ] Local: secret check and every daily step on the local database (`tests/e2e/ops.spec.ts`) (2026-11-22, local).

## Security

- [ ] A header scan of the staging address (for example securityheaders.com): no high severity gaps. Record the grade.
- [ ] HSTS present on the staging and production responses (needs HTTPS; the build must see `APP_ENV`).
- [ ] Turnstile keys set and a guest report and a sign-up pass with the widget (never tested against Cloudflare yet).
- [ ] Rate limits tried by hand on staging: six wrong sign-ins, six sign-ups from one address.
- [ ] `pnpm audit --audit-level=high` clean in CI; gitleaks job green in CI (the workflow has not run on GitHub yet).
- [ ] No secrets in the repository or its history (checked locally with a pattern search, 2026-11-22; run gitleaks in CI as well).
- [ ] Decide on a malware scanner for uploads (`UPLOAD_SCAN_URL`) or accept the documented gap.

## Backups

- [ ] Backups switched on in the hosting dashboard; plan and retention written here: ______
- [ ] Off-site copy of the storage buckets scheduled (database backups do not include files).
- [ ] Weekly `pg_dump` copy stored encrypted off the hosting account.
- [ ] **Restore drill on staging** from a backup, with the verification steps from the runbook. Date: ______  Result: ______
- [ ] Local: `pnpm restore:drill` passed, 30 tables and 9,414 rows equal, 33 policies and the audit trigger intact (2026-11-22, local).

## Monitoring

- [ ] Uptime monitor on `/api/health` every minute, alert after two failures. Where alerts go: ______
- [ ] Log drain connected; a rule for more than 20 `request.error` lines in 5 minutes.
- [ ] `ALERT_WEBHOOK_URL` set and a test alert received.
- [ ] Error tracking decision: log-based only, or add Sentry. Decision: ______

## Content and legal (owner)

- [ ] Legal drafts reviewed by the campus (the "Draf" banners stay until the owner confirms).
- [ ] Contact address and security contact set in `/admin/settings`.
- [ ] Privacy data map open questions answered (`docs/privacy-data-map.md`).

## Before production

- [ ] Everything above done on staging, and the same steps repeated for the production project.
- [ ] Production boot refusal seen once on a production build: unsafe settings stop the process with exit code 1 (done locally on a production build, 2026-11-22).
- [ ] `LLM_PROVIDER` is live, with a real key tested once, and the global cap set to a number the budget can stand.
- [ ] Owner's explicit confirmation for each launch stage (phase R9).
