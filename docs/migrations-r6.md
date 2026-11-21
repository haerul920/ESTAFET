# Migration for release R6 (admin panel v2)

File: `supabase/migrations/20261124000001_r6_admin_v2.sql` (cloud step `10_r6_admin_v2.sql`). It only adds things, except `admin_overview`, which is replaced. There is no automatic down migration; to undo, drop the objects listed here.

| Addition | Why |
|---|---|
| `announcements` (no policies, no direct access), `active_announcements()`, `admin_announcements_v`, `admin_save_announcement()`, `admin_end_announcement()` | Site-wide banner with Indonesian and English text, start and end time, severity and a dismissible flag. Visitors read only `active_announcements()` (no author). Every write is audited with a reason |
| `admin_bulk_dismiss_spam(ids, note)` | Dismiss up to 50 reports at once, but only reports with the reason `spam`. One audit row per report. If any report is not spam, nothing changes |
| `admin_policies_v` | Policy versions with how many people accepted each (publishing a version already existed: `admin_publish_policy`) |
| `admin_force_sign_out(user, reason)` | Deletes all sessions of a person. An access token that was already issued stays valid until it expires (at most an hour). Refuses the admin's own account |
| `admin_overview()` (replaced) | Adds new reports in 24 h, held and overdue holds, open appeals, projects by moderation state, access mode, reports by reason and outcome, median days from start to published. Drops the retired advisor counter |

New error hints: `bad_range`, `too_many`, `not_spam`, `self_action` (messages in both languages; a unit test checks that every hint raised in SQL has a message).

All new rules have database tests in `tests/db/r6.test.ts`, and the admin boundary test (`tests/db/admin.test.ts`) lists the new functions and views, so a normal user and a visitor are rejected.

## Not in this migration

- **Email log:** needs the email provider (R7).
- **Spot checks of the "no advisor" path and expired advisor links:** removed with the advisor role (CLAUDE.md 15.1).
- **Per-user synthesis quota overrides and cost counters:** not built.
