# R1 migration notes: one account type and the access model

Migrations: `20261121000001_r1_enum_additions.sql` (enum values only) and `20261121000002_r1_access_model.sql` (everything else).
Plan and reasons: `docs/release-plan.md` section 2. Rules: `CLAUDE.md` sections 14.3, 14.4 and 14.5.

## What changed

| Before | After |
|---|---|
| `profiles` has no role column (already true) | unchanged. `is_admin` stays. |
| `project_members.role` is `creator` or `adopter` | `owner` or `co_owner`, with `status` `invited`, `active` or `left` |
| Adopters were rows in `project_members` | Adopters are rows in `project_access`, one per person who accepted the attribution agreement |
| Files unlocked when one creator and one adopter accepted for a request | A person gets access by accepting for themselves, in `open` mode directly, or after an approved request |
| `projects.status`: draft, awaiting_advisor, verifying, published, adopted, archived | draft, published, unpublished, archived. The wizard stage is worked out from consent and items. "Continued" is shown when an access row is active. |
| No access settings | `access_mode` (`open`, `by_request`, `paused`), `max_active_adopters` (1, 3 or NULL for unlimited), `advisor_mode` |
| Requests never expired | `expires_at` (30 days by default) and the `expired` status |
| No policy records | `policies` and `policy_acceptances` (versioned) |

New database functions: `invite_co_owner`, `respond_co_owner_invite`, `declare_no_advisor`, `publish_project` (unpublish and republish rules), `unpublish_project`, `archive_project`, `set_access_settings`, `take_access`, `accept_agreement` (now per person), `revoke_access`, `expire_requests` (service role only), `accept_current_policies`.
Removed: `is_project_creator`, `is_project_member`, `request_unlocked`, `has_unlocked`, `add_team_member`.
Errors from these functions carry a `hint` (for example `quota_full`, `email_unverified`) so the interface can translate them in phase R2.

## Decisions taken during R1 that you should know about

* **Advisor approval holds back publishing, not reading.** The AI draft needs every active team member's consent, no longer the advisor's approval (`CLAUDE.md` 14.5 and the owner summary, decision 4). `CLAUDE.md` section 8 still says "advisor and team"; section 14 supersedes it.
* **Only the person who takes access signs the agreement.** Owners no longer accept it. Their consent is the approval and the sharing confirmation. `agreement_acceptances` is kept as read-only history. The terms text was reworded to match ("The owners confirmed, when they shared the project, ..."). The version stays 1 because nothing has been published.
* **Quota counts teams, not people.** Two teammates from one request count once. An open-mode person counts once.
* **Quota is checked** when a request is created, when it is approved (by counting active access), and when the first person of a request accepts.
* **A revoked person cannot take access again by themselves** (open mode or a new request). The owners can ask them to apply again only by lifting the revoke, which is not built.
* **Verified email is enforced in the database** for sharing, publishing, taking access, requesting and deciding. Local Supabase auto-confirms emails (`enable_confirmations = false`), so every local account counts as verified. Hosted projects must turn confirmations on (phase R7).
* **Access holders see only kept items.** Previously an approved team could read every item, including removed ones.
* **Invitations**: an invited co-owner is not a member until they accept, so they cannot read the project.

## Dry run on legacy-shaped data

`node scripts/migrate-r1-dry-run.mjs` resets the LOCAL database to the schema before R1, loads the old seed plus extra legacy rows (`supabase/dry-run/`), applies the R1 migrations, checks 19 invariants, then restores the normal local database with `pnpm db:reset`. It touches only the local container.

Invariants checked: project, request and lineage counts unchanged; every project has exactly one owner and it is the original creator; a second creator became a co-owner; no adopter rows remain; a fully signed request became one access row per person who accepted; a half-signed request created none; two people from one team count as one team; `adopted` became `published`; `awaiting_advisor` and `verifying` became `draft`; the public teaser lists the same projects; migrated projects keep today's behaviour (`by_request`, limit 3); old pending requests got a fresh expiry window; backups hold the pre-R1 rows and are not reachable by API roles; the old status values are gone; no policy acceptance was invented.

Last run: passed (19 of 19) on 2026-11-21.

## Rollback

There is **no automatic down migration**. Postgres cannot drop enum values and the cutover recreates two enum types, so a faithful down script would repeat most of the base schema. What exists instead:

1. **Before any real data exists (today):** `supabase db reset --version 20261120000001` returns the local or staging database to the schema before R1, and `pnpm db:reset` restores the current state.
2. **Copies of the data that changed** are kept in schema `r1_backup` (`project_members`, `projects_status`, `agreement_acceptances`, `continuation_requests`). It is not exposed through the API. Drop it after a release has been stable.
3. **Once there is production data:** take a `pg_dump` immediately before applying these migrations and restore that dump to roll back. After the first production write, prefer a forward fix.

This is a deviation from the release plan, which promised down scripts. It is recorded in the R1 report.

## Not part of R1 (later phases)

Owner settings page and the access-mode controls in the interface (R4), "Beri tahu saya" and the watch list (R4), the Indonesian interface (R2), report reasons, auto-hold and appeals (R5), policy text, forced re-acceptance, data export and deletion (R5), admin queues for the new states (R6), scheduled jobs for `expire_requests` (R7).
Until R4 there is no screen that changes `access_mode` or the team limit. The seed sets the Campus Waste Sorting Assistant to `open` so both modes can be tried, and the database tests change settings through `set_access_settings`.
