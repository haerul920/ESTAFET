# Environments and configuration

ESTAFET runs in four environments. Each one has **its own Supabase project** and its own set of variables. Never point two environments at the same database.

| Environment | `APP_ENV` | Purpose | Supabase | AI | Email | Search engines |
|---|---|---|---|---|---|---|
| Local | `LOCAL` | Development, tests | Local Docker stack (`pnpm db:start`) | `mock` | `log` (prints a line) | closed |
| Demo | `DEMO` | The site the STACK 2026 judges use | Its own hosted project, with demo data | `mock` allowed, banner "Simulated AI output" | optional | closed (`noindex`) |
| Staging | `STAGING` | Rehearsal of every release, restore drills, load tests | Its own hosted project, **no demo data** | live or `mock` | real provider, a test sender address | closed (`noindex`) |
| Production | `PRODUCTION` | The public product | Its own hosted project | live only | real provider | open |

If `APP_ENV` is not set, a local Supabase URL means `LOCAL` and anything else is treated as `PRODUCTION`, so a forgotten variable errs on the safe side.

## What the server refuses at boot

`src/instrumentation.ts` runs `assertConfig()` (`src/lib/config.ts`) when the server starts. In `STAGING`, `DEMO` and `PRODUCTION` any problem below stops the boot, and the message names each variable (never a value). `LOCAL` only logs them.

| Rule | Production | Staging, Demo |
|---|---|---|
| Supabase URL, public key and service key are set | required | required |
| Supabase URL is not a local address | required | required |
| `APP_URL` is a public `https` address | required | required |
| `CRON_SECRET` has at least 32 characters | required | required |
| `LLM_PROVIDER` is not `mock` | **required** | allowed |
| `SEED_DEMO` is not `true` | **required** | allowed |
| Turnstile site and secret key | required | warning |
| `EMAIL_PROVIDER` is `smtp` or `resend` | required | `none` warns, `log` allowed |
| A live provider has its API key and `LLM_MODEL` | required | required |
| Number settings are valid numbers | required | required |
| `RATE_LIMIT_MULTIPLIER` (tests only) is not set | required | required |

Check a file or the current environment **before** deploying:

```bash
pnpm config:check                          # the current environment
pnpm config:check --file .env.production   # a dotenv file on top of it
```

It prints every problem and exits with 1 if the server would refuse to start. Unit tests (`tests/unit/config.test.ts`) cover each rule.

## Variables

Secrets are never committed. `.env.example` lists every name.

| Variable | Needed for | Notes |
|---|---|---|
| `APP_ENV` | all | `LOCAL`, `DEMO`, `STAGING`, `PRODUCTION`. Read at run time, and the build must see the same value for the HSTS header (see `docs/security.md`) |
| `APP_URL` | all deployed | Public address, used in emails, the sitemap and canonical links |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `..._PUBLISHABLE_KEY`) | all | Public by design |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | all | Server only. Never in the browser |
| `CRON_SECRET` | deployed | 32+ random characters. Vercel Cron sends it automatically |
| `LLM_PROVIDER`, `LLM_MODEL`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` | AI drafts | Production needs a live provider |
| `SYNTHESIS_DAILY_CAP` | cost | Live AI runs per person per 24 h (default 20, also editable in `/admin/settings`) |
| `SYNTHESIS_GLOBAL_DAILY_CAP` | cost | Live AI runs for everyone together per 24 h (default 300) |
| `EMAIL_PROVIDER`, `EMAIL_FROM` | email | `smtp` or `resend` (see `docs/email.md`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | email (smtp) | |
| `RESEND_API_KEY` | email (resend) | |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | bot check | Production requires both |
| `UPLOAD_SCAN_URL` | uploads | Optional malware scanner (see `docs/security.md`) |
| `ALERT_WEBHOOK_URL` | alerts | Slack or Discord compatible webhook |
| `MAX_UPLOAD_MB`, `ALLOWED_EMAIL_DOMAINS`, `REPORT_HOLD_THRESHOLD`, `HOLD_REVIEW_DAYS` | behaviour | Defaults; `/admin/settings` overrides them |
| `SEED_DEMO` | local, demo | Never `true` in production |
| `RATE_LIMIT_MULTIPLIER` | local tests | Raises rate limits for browser tests. Refused outside `LOCAL` |

## Setting up staging (first time)

1. Create a **new Supabase project** for staging. Run the numbered files in `supabase/cloud-sql/` one by one in the SQL Editor (see that folder's README). Do **not** run `99_OPTIONAL_demo_data.sql`.
2. Create the first admin: `select public.promote_admin('you@example.com');`
3. In Supabase, **Authentication, Providers, Email**: turn on **Confirm email**. Add the redirect URL `https://<staging address>/**` under **URL Configuration**. Set the site URL to the staging address.
4. Configure SMTP for Supabase Auth and paste the confirmation template (see `docs/email.md`).
5. Create a Vercel project (or a Vercel *environment*) for staging. Set the variables above with `APP_ENV=STAGING`. Add the same `CRON_SECRET` to the project.
6. Run `pnpm config:check --file <your staging env file>`, then deploy.
7. Open `/api/health`: it must answer `{"status":"ok","database":"up"}`.
8. Follow `docs/operations-checklist.md`.

Production repeats the same steps with its own Supabase project, `APP_ENV=PRODUCTION`, a live AI provider and Turnstile keys.

## The demo environment

The demo is for the judges. It uses `APP_ENV=DEMO`, `LLM_PROVIDER=mock`, and may run `pnpm db:reset` style seeding (`SEED_DEMO=true`, `99_OPTIONAL_demo_data.sql`). Every demo row has `is_demo = true` and the UI shows "Data contoh" and "Simulated AI output (mock mode)". The demo site is `noindex` and must never share a database with staging or production.
