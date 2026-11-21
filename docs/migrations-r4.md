# Migrations for release R4 (flows)

Files: `supabase/migrations/20261122000001_r4_enum_additions.sql` and `20261122000002_r4_flows.sql`. Both only add things, except two functions that are replaced (see below). There is no automatic down migration; to undo, drop the objects listed here (nothing else references them except the two replaced functions).

| Addition | Why |
|---|---|
| `projects.fill_mode` (`ai`, `manual`, null) and `set_fill_mode()` | "Isi manual tanpa AI": owners write the items by hand and nothing goes to an AI provider |
| `project_watchers`, `watch_project()`, `unwatch_project()`, `notify_watchers()` (internal) | "Beri tahu saya": one notification when access opens again or a team slot frees up, then the wish is used up |
| `request_messages`, `post_request_message()` | A short thread (500 characters per message, 40 messages per request) between the requesting team and the owners. Closed once the request is decided |
| `backlog_progress`, `set_item_progress()`, lineage type `item_progress` | Access holders mark verified next tasks "Dikerjakan" or "Selesai"; it shows in the lineage and the owners are told |
| `remind_expiring_requests()` | Reminds the owners once, 3 days before a pending request expires. Service role only. **Nothing calls it on a schedule yet** (scheduling is R7) |
| `ownership_transfers`, `propose/respond/cancel_ownership_transfer()`, lineage type `ownership_transferred` | Handing over ownership needs the recipient to confirm |

Replaced functions (same signatures, so nothing else changes):

- `set_access_settings()` and `revoke_access()` now also notify watchers.
- `ask_request_question()` now writes into the thread.
- `invite_co_owner()` now works on a published project too (CLAUDE.md 14.4: owners may invite co-owners at any time). Only an archived project stays closed. The invited person still has to accept.

All new rules have database tests in `tests/db/r4.test.ts`. Browsers can call the rule functions (they check who is calling) but not `notify_watchers()` or `remind_expiring_requests()`.
