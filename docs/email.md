# Email

ESTAFET sends two kinds of email, from two different places:

| Kind | Sent by | Configured in |
|---|---|---|
| **Account email** (confirm your address, reset password) | **Supabase Auth** | Supabase dashboard: Authentication, SMTP and Email Templates |
| **Product email** (new request, decision, agreement, moderation, appeal, report outcome, co-owner invite, admin alerts) | **ESTAFET** (`src/lib/email/`) | Environment variables below |

Use the **same sender domain** for both, so SPF, DKIM and DMARC are set once.

## How product email works

1. The database writes a notification (as it always did). Every 10 minutes the scheduled job `/api/cron/emails` calls `enqueue_emails()`, which copies the notifications that deserve an email (and the outcome of reports from signed-in reporters) into the table `email_outbox`.
2. The same job claims due rows, renders the template in the person's language, and sends it through the provider.
3. A failure is retried after 5, 15, 45 and 135 minutes. After 5 attempts the row is `failed` and an alert is raised (see `docs/runbook.md`).
4. The outbox stores **no email address**. The address is read from the account at send time, so a changed or deleted address is respected. Only the last 3 days of notifications are considered, so switching email on never sends old news.

**Preferences.** `/akun/privasi` lets people turn notification emails off and choose the email language (default Indonesian). **Essential** emails ignore the switch and say so in their footer: moderation decisions, appeal outcomes, revoked access and admin alerts. The list is in `ESSENTIAL_TEMPLATES` (`src/lib/email/templates.ts`) and a unit test checks that the database uses the same list.

| Template | To | Essential |
|---|---|---|
| `new_request` | project owners | no |
| `request_decision` | the person who asked | no |
| `agreement_accepted` | the other side | no |
| `moderation` (hold, hide, remove, restore) | project owners | yes |
| `appeal_outcome` | the person who appealed | yes |
| `access_revoked` | the person whose access was revoked | yes |
| `team_invite`, `ownership_offer` | the invited person | no |
| `report_outcome` | a signed-in reporter | no |
| `admin_hold`, `admin_hold_overdue`, `admin_appeal` | admins | yes |

There is no email for "advisor consent": the advisor role was removed (CLAUDE.md 15.1).

## Choosing a provider

Set `EMAIL_PROVIDER` and `EMAIL_FROM` (for example `ESTAFET <halo@your-domain>`).

- `smtp`: any SMTP service. Set `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS or 465 TLS), `SMTP_USER`, `SMTP_PASSWORD`.
- `resend`: set `RESEND_API_KEY`.
- `log`: prints the subject and sends nothing. For local work and staging. Refused in production.

Another provider is one more `case` in `src/lib/email/provider.ts`.

## Preview the templates (not in production)

Run the app and open `/api/dev/email-preview`. It lists every template in Indonesian and English with invented data; add `&format=text` for the plain text version. The route answers 404 in production.

## SPF, DKIM, DMARC

Do this at your DNS host for the **sending domain**. The exact records come from your provider's dashboard; the steps are always the same.

1. **SPF.** Publish one TXT record on the domain that lists your provider, for example `v=spf1 include:<provider's include> ~all`. A domain can have only **one** SPF record, so merge the includes if you already have one.
2. **DKIM.** The provider gives you one or more CNAME or TXT records (for example `selector._domainkey`). Publish them exactly, then press "Verify" in the provider's dashboard.
3. **DMARC.** Start in monitoring mode: a TXT record on `_dmarc.<domain>` with `v=DMARC1; p=none; rua=mailto:<an address you read>`. After a few weeks of clean reports, move to `p=quarantine`, later `p=reject`.
4. **Check.** Send a test to a Gmail address, open "Show original", and confirm `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. Repeat for the Supabase Auth sender.

Nothing here has been verified against a real domain yet: no DNS or provider exists for the project at this point.

## Supabase Auth emails

In the Supabase dashboard:

1. **Authentication, SMTP Settings:** turn on custom SMTP and enter the same provider. Without it Supabase uses a shared sender with a very low hourly limit, which is not enough for a public site.
2. **Authentication, Providers, Email:** turn on **Confirm email**. (Local Supabase confirms every address automatically. A hosted project must turn this on, or the "verified" gate means nothing.)
3. **Authentication, Email Templates, Confirm signup:** paste `docs/email-templates/confirm-signup.html` (Indonesian and English in one message, because Supabase allows one template per type) and set the subject to `Konfirmasi emailmu di ESTAFET / Confirm your email on ESTAFET`.
4. **Authentication, URL Configuration:** site URL = `APP_URL`; add `APP_URL/**` as a redirect URL.

## Alerts

`email_failed` (a message that failed after all attempts) is raised by the dispatcher, with the count only. See `docs/runbook.md`, "Alerts".
