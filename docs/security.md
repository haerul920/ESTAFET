# Security

What protects ESTAFET, where it lives in the code, and what is **not** covered. Each row says how it was checked. "Tested" means an automated test in this repository passes on the local stack; "not tested" says why.

## Headers and CSP

| Control | Where | Status |
|---|---|---|
| `Content-Security-Policy` with a fresh nonce per request, `strict-dynamic`, no inline scripts, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri` and `form-action` limited to the site | `src/proxy.ts`, `src/lib/security-headers.ts` | Tested in a browser (`tests/e2e/security.spec.ts`): nonce differs per request, every script carries it, no violation on the main pages in Indonesian and English |
| `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, no `X-Powered-By` | `next.config.ts` | Tested (same spec) |
| `Strict-Transport-Security` (1 year, subdomains, no `preload`) | `next.config.ts`, production only | Not testable locally (no HTTPS). It is chosen **at build time** from `NODE_ENV` and `APP_ENV`, so build production with `APP_ENV=PRODUCTION` |
| `upgrade-insecure-requests` | CSP, outside development | Same as above |
| `noindex` for staging and demo | `X-Robots-Tag` in `src/proxy.ts`, `robots.txt`, page metadata | Tested (robots disallows everything outside production) |

**Known weakness:** `style-src` allows `'unsafe-inline'`, because Radix and Framer Motion write `style` attributes at run time and nonces cannot cover attributes. Scripts are strict. Removing this needs a different animation approach and is not planned.

**Not done:** CSP violation reporting (`report-to`), a header scan with an external tool (securityheaders.com or similar) against a deployed staging site. Run one before launch (`docs/operations-checklist.md`).

## Sign-in, sign-up and cookies

- Passwords and sessions belong to Supabase Auth. Cookies are the Supabase session cookie and the language cookie only (`@supabase/ssr`). The session cookie gets `SameSite=Lax`, and `Secure` when `APP_URL` is https (`sessionCookieOptions()` in `src/lib/supabase/keys.ts`). It is not `HttpOnly`, because the browser client reads the session from it. The language cookie is `SameSite=Lax` and not `Secure`-flagged by next-intl's default.
- Rate limits (database backed, `src/lib/rate-limit.ts`): sign-in 20 per 15 minutes per address and 8 per 15 minutes per email address; sign-up 5 per hour per address; resend confirmation 3 per hour per account; reports 5 per hour per address and 10 per day per account; uploads 30 per hour per account; AI runs per account per day, per project per hour, and for the whole platform per day. Addresses and email addresses are stored only as a one-way hash. If the database cannot answer, a limit **fails open** (and logs a warning) so nobody is locked out by an outage. Database tests cover the report limits; the others are exercised by the browser tests (which raise the limits on a local server only), not by a test of the limit itself.
- Bot check on sign-up and guest reports: Cloudflare Turnstile when keys are set, otherwise a hidden field plus a 3 second minimum fill time. **The Turnstile path has never been tested against Cloudflare.**
- Passwords: Supabase's minimum length (8 in the form). **No breach check** (haveibeenpwned) was added.
- CSRF: forms use Server Actions, which Next.js protects with an origin check. Route handlers that change data are the upload (`POST /api/projects/[id]/files`), the AI run and the cron jobs. The first two require the session cookie (`SameSite=Lax` blocks cross-site POSTs); the cron jobs require a bearer secret.

## Authorization

The database is the authority. Row level security is on for every table, privileged work is in `SECURITY DEFINER` functions that check who is calling, and the service role key is used only in server code after an explicit check (`src/lib/supabase/admin.ts` is `server-only`; a unit test keeps service-role code out of `app/**/admin`). The admin boundary (a visitor and a normal user are refused every `admin_*` function and view) is tested in `tests/db/admin.test.ts`; the rules for requests, access, moderation and the outbox have their own database tests (170+ in total).

**Not done yet (phase R8):** a systematic authorization test of every route and server action (user A against user B, suspended, unverified, revoked access, IDOR on every id).

## Uploads and downloads

| Control | Where | Status |
|---|---|---|
| Size limit (setting `max_upload_mb`), file count per project | `src/lib/ingest/limits.ts`, files route | Tested (unit) |
| Magic bytes, not the extension; PDF, Markdown, JPG, PNG, .docx, .xlsx and .pptx only | `src/lib/ingest/magic.ts` | Tested (unit, browser) |
| Office files: entry count and unpacked size limits, required parts, unsafe paths and macros refused, **never executed** | `src/lib/ingest/office.ts` | Tested (unit) |
| Pictures are decoded and written again (removes camera data), with a pixel limit | `src/lib/ingest/image.ts` | Tested (unit, browser) |
| Direct-to-storage upload: signed single-use address after the owner check; only the project's own waiting folder can be finished; the waiting file is deleted either way | `src/lib/ingest/upload-guard.ts`, files routes | Browser tested locally |
| Secret scan of names and extracted text (`.env`, keys, token patterns): skipped and reported. **A picture cannot be scanned before the AI reads it**; the reading is scanned before it is kept | `src/lib/ingest/secrets-scan.ts` | Tested (unit, database with a faked AI) |
| Content type is chosen by the server from the detected kind, never from the browser | files route | Reviewed, not separately tested |
| PDF preview: same access check as a download, PDF only, 5-minute address, frames allowed from the storage origin only | download route, `src/lib/security-headers.ts` | Browser tested locally (owner 200, guest 401, other account 403). Not tested against cloud storage |
| Malware scan hook: set `UPLOAD_SCAN_URL`; an infected answer, an error or a timeout rejects the file | `src/lib/ingest/scan.ts` | Tested against a local fake scanner (`tests/unit/scan.test.ts`). **No scanner service is bundled or deployed**, so by default uploads are not scanned for malware |
| Downloads: authorization first (row level security through the user's own client), then a 60 second signed URL with `download` (the browser saves it, never renders it) | download route | Reviewed. Break glass downloads last 5 minutes, one file, audited |

## Data in logs

Logs are one JSON line per event (`src/lib/log.ts`). Callers pass ids, counts and codes only, and a scrubber drops fields named like email, name, token, text, reason or body. Email errors keep a short code, never the address (`tests/db/r7-dispatch.test.ts` checks this). File contents and tokens are never logged.

## Supply chain and secrets

- CI runs `pnpm audit --audit-level=high` and, since R7, a secret scan with gitleaks (`.github/workflows/ci.yml`). **The workflow has not run on GitHub yet.**
- A search of the working tree and the full git history for key-shaped strings (Supabase secret keys, `sk-`, Google API keys, JWTs, private keys) found nothing except a test fixture. `.env.local` and `.env.localstack` are ignored; only `.env.example` is tracked.
- The service role key lives only in server environments. Rotate it in Supabase if it is ever shown anywhere it should not be.

## Reporting a vulnerability

Write to the contact address in `/admin/settings` (shown on the Contact page). Do not post details publicly first. [TEAM TO CONFIRM: a dedicated security address and response time before launch.]
