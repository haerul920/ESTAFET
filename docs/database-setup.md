# Database setup

ESTAFET uses Supabase (Postgres + Auth + Storage). The whole database is plain SQL in this repo:

| File | What it is |
|---|---|
| `supabase/migrations/20261119000001_schema.sql` | Enums, tables, state-rule functions, RLS policies, public views, storage buckets |
| `supabase/migrations/20261120000001_admin.sql` | Admin area: reports, audit log, settings, trial sessions, break glass, `is_admin()`, `admin_*` functions, admin views, moderation columns |
| `supabase/migrations/20261121000001_r1_enum_additions.sql`, `20261121000002_r1_access_model.sql` | Release R1: owners and co-owners, `project_access`, access modes and team quota, lifecycle, policy acceptance. See `docs/migrations-r1.md` |
| `supabase/seed.sql` | Demo data (all `is_demo = true`): 3 demo users, 8 projects, items with evidence, 2 requests |
| `supabase/setup-all.sql` | The migrations and the seed in one generated file (`node scripts/build-setup-all.mjs`), for pasting into the SQL Editor |
| `scripts/seed-storage.ts` | Uploads the demo files to Storage (SQL cannot upload file bytes) |
| `scripts/seed-admin.ts` | Creates the demo admin (only when `SEED_DEMO=true`; refuses non-local targets) |

## Option A: local stack (recommended, works offline)

Needs Docker Desktop running.

```bash
pnpm install
pnpm db:start        # supabase start (first run downloads images)
pnpm exec supabase status -o env     # copy API_URL, ANON_KEY, SERVICE_ROLE_KEY into .env.localstack (local) 
pnpm db:reset        # drops and recreates the DB, applies migrations + seed.sql, then uploads demo files
pnpm dev
```

`pnpm db:reset` = `supabase db reset` (migrations + seed) followed by `pnpm seed:storage` and `pnpm seed:admin`. These read `.env.localstack` and refuse a non-local target, so they never touch a cloud project. Run it any time you want a clean demo state.
Studio (table browser and SQL editor): http://127.0.0.1:54323 . Direct connection: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Option B: Supabase cloud project

1. Create a project at supabase.com. Authentication, Providers, Email: for a demo you can switch off "Confirm email".
2. Apply the SQL, using **either**:
   - **SQL Editor:** open `supabase/setup-all.sql`, paste it and run it once on the empty project. (Use only `supabase/migrations/...schema.sql` if you do not want demo data.)
   - **CLI:** `pnpm exec supabase login`, `pnpm exec supabase link --project-ref <ref>`, `pnpm exec supabase db push` (migrations only), then run `seed.sql` in the SQL Editor if you want demo data.
3. Put the project values in `.env.local` (the newer names `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` also work) (Project Settings, API): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never commit it).
4. Upload the demo files (only if you ran the seed): `ALLOW_REMOTE_SEED=true pnpm seed:storage` (the script refuses a remote project otherwise).
5. Make your first admin: run `select public.promote_admin('you@example.com');` in the SQL Editor. Set `APP_ENV=PRODUCTION` (or STAGING) so "Purge demo data" stays off. Never set `SEED_DEMO=true` on a real project.
6. Set `APP_URL` to your site URL so consent links are correct.

Demo data is synthetic. Do not seed a production project that real students use.

## Verify the setup

Run these in the SQL Editor (or `docker exec supabase_db_estafet psql -U postgres -c "..."`).

```sql
-- 1. All tables exist and every one has RLS on (expect 12 rows, rowsecurity = true)
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;

-- 2. Policies per table
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;

-- 3. Both storage buckets exist and are private (expect public = false)
select id, public from storage.buckets where id in ('project-files', 'extracted-text');

-- 4. Seed data (expect 8 projects, 6 published, 3 demo users)
select status, count(*) from public.projects group by status order by 1;
select count(*) as demo_users from auth.users where email like '%@estafet.demo';

-- 5. The public view shows only published teasers (this is all anonymous visitors can read)
select slug, objectives_done, objectives_total, tasks_count from public.public_project_teaser order by published_at desc;
```

## Useful queries

```sql
-- Items waiting for review, per project
select p.title, count(*) as pending
from public.draft_items i join public.projects p on p.id = i.project_id
where i.review_status = 'pending' group by p.title;

-- Items whose evidence could not be found
select p.title, i.title, i.evidence_status
from public.draft_items i join public.projects p on p.id = i.project_id
where i.evidence_status <> 'matched' and i.origin = 'ai';

-- Requests and who decides them
select p.title, r.adopter_team_name, r.status, r.created_at
from public.continuation_requests r join public.projects p on p.id = r.project_id
order by r.created_at desc;

-- Has a request unlocked the private files? (both sides accepted the current agreement version)
select r.id, r.status, public.request_unlocked(r.id) as unlocked
from public.continuation_requests r;

-- Append-only lineage timeline of one project
select type, created_at, payload
from public.lineage_events
where project_id = (select id from public.projects where slug = 'mangrove-cover-classifier')
order by created_at;

-- Synthesis runs (mode shows live or mock)
select provider, mode, status, error, created_at from public.synthesis_runs order by created_at desc limit 10;

-- Advisor consent status (the token itself is never stored, only its hash)
select p.title, c.status, c.expires_at, c.decided_at
from public.advisor_consents c join public.projects p on p.id = c.project_id;
```

## Rules enforced in SQL (call through RPC)

| Function | Purpose |
|---|---|
| `publish_project(project_id)` | Advisor approved, team confirmed, no pending items, at least one kept item, caller is a creator |
| `create_continuation_request(...)` | Published project, verified tasks, one open request per team |
| `decide_request(request_id, 'approved' or 'declined', note)` | Creators only |
| `accept_agreement(request_id)` | Both sides accepted, so files unlock and the handover is logged |
| `issue_advisor_consent(project_id, token_hash, expires_at)` | Creator stores a token hash |
| `decide_advisor_consent(token_hash, decision, comment)` | **Service role only**, single decision |

Direct writes to `status`, `published_at` and `lineage_events` are blocked by column privileges and a trigger. See `docs/architecture.md` for the full policy table.

## Tests against the database

`pnpm test:db` runs 74 checks against the local stack (it refuses a non-local URL), covering the admin boundary (non-admins and visitors rejected by every `admin_*` function, view and policy), moderation, suspension, break glass, settings audit, append-only audit log, the last-admin rule and the trial summary against a fixture, as well as the earlier rules: non-members cannot read private files, a project cannot be published without advisor approval or with pending items, files unlock only after approval plus both agreement acceptances, and lineage rows cannot be updated or deleted.

## Troubleshooting

- `supabase start` fails: start Docker Desktop first, then retry.
- `relation ... already exists` when pasting `setup-all.sql`: the project is not empty. Use `pnpm db:reset` locally, or run it on a fresh cloud project.
- Demo files missing in the workspace after a reset: run `pnpm seed:storage`.
- Sign-up says "Check your email": email confirmation is on. Switch it off for a local or demo project, or confirm the address.
