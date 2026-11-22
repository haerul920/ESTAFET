# Migration for the R9 email log

File: `supabase/migrations/20261126000001_r9_email_log.sql` (cloud step `12_r9_email_log.sql`). It only adds things.

| Addition | Why |
|---|---|
| `admin_email_log_v` (admins only through `is_admin()`, no grant for visitors) | The admin email log (`/admin/emails`). Template, language, essential or not, status, attempts, the short error code, times, the recipient's name and whether the email came from a notification or a report outcome. **No address and no message content**, like the outbox itself |
| `admin_resend_email(id, reason)` | Puts a `failed` **essential** email back in the queue with a fresh set of 5 attempts. Needs an admin and a reason of 15+ characters, and writes the audit row `email.resend` in the same transaction. Refuses other emails with the hint `email_not_resendable`, a missing one with `email_not_found` |

Not included: **bounces**. No provider webhook is connected yet, so "sent" means the provider accepted the email.

**Cloud project:** run `12_r9_email_log.sql` alone in the SQL Editor, after step 11. With the CLI: `pnpm exec supabase db push`.

**Undo:**

```sql
drop function if exists public.admin_resend_email(uuid, text);
drop view if exists public.admin_email_log_v;
```

Tests: `tests/db/r9-email-log.test.ts` (local stack only).
