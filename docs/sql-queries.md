# Supabase: where data lives and the queries you need

ESTAFET stores **everything** in Supabase. Nothing is kept in files on the server, in browser storage or in memory between requests.

| What | Where in Supabase |
|---|---|
| Accounts and sign-in | Auth (`auth.users`) plus `public.profiles` (created by a trigger on sign-up) |
| Projects, members, access, requests, drafted items, consents, reports, settings, audit log, trials, notifications | Postgres tables in schema `public` (see `docs/database-setup.md`) |
| Rate limits (reports, consent links, synthesis) | Table `public.rate_limit_hits`, checked by `public.check_rate_limit()` |
| Uploaded files (PDF, Markdown, ZIP code tree) | Storage bucket `project-files` (private) |
| Extracted text (per page) | Storage bucket `extracted-text` (private) |
| Business rules (publish, take access, decide request, revoke, moderation) | SQL functions, enforced again by Row Level Security |

Only temporary values stay outside the database: React state while a form is open, and the session cookie that Supabase Auth sets.

## 1. Create the database (once)

Use **one** of these. Full steps are in `docs/database-setup.md`.

1. **Supabase cloud, easiest:** open `supabase/cloud-sql/README.md` and follow it: paste the numbered files into the SQL Editor one at a time, in order. Skip the optional demo data for a real site.
2. **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
3. **Local:** `pnpm db:start` then `pnpm db:reset`.

Then set these in `.env.local` (Project Settings, API) and never commit them:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role or secret key, server only>
```

## 2. Check that it is set up correctly

```sql
-- Every table has Row Level Security on (rowsecurity must be true for all rows).
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;

-- Policies per table.
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;

-- Both buckets exist and are private (public must be false).
select id, public from storage.buckets where id in ('project-files', 'extracted-text');

-- The public views exist.
select viewname from pg_views where schemaname = 'public' and viewname like 'public_%' order by 1;

-- Projects by lifecycle status (demo seed gives published and draft rows).
select status, count(*) from public.projects group by status order by 1;
```

## 3. First admin

Admins are never created from the interface. Sign up in the app first, then run this once in the SQL Editor:

```sql
-- (write) makes an existing account an admin
select public.promote_admin('you@example.com');
```

## 4. Everyday read queries

```sql
-- What visitors see on Explore (public teaser view, only published and not moderated).
select slug, title, kind, field, year, access_mode, max_active_adopters, active_adopters,
       objectives_done, objectives_total, tasks_count, published_at
from public.public_project_teaser
order by published_at desc;

-- Projects with their owners.
select p.slug, p.title, p.status, p.access_mode, p.moderation_status,
       string_agg(pr.full_name, ', ' order by pr.full_name) as owners
from public.projects p
join public.project_members m on m.project_id = p.id and m.status = 'active'
join public.profiles pr on pr.id = m.profile_id
group by p.id
order by p.created_at desc;

-- Drafts waiting for review, with progress.
select p.slug, p.title,
       count(*) filter (where d.review_status <> 'pending') as reviewed,
       count(*) as total
from public.projects p
join public.draft_items d on d.project_id = p.id
where p.status = 'draft'
group by p.id
order by p.created_at desc;

-- Requests waiting for an owner decision, oldest first.
select r.created_at, p.title, r.adopter_team_name, r.purpose, r.target_date, r.expires_at
from public.continuation_requests r
join public.projects p on p.id = r.project_id
where r.status = 'pending'
order by r.created_at;

-- Who holds access to each project right now, and how many teams.
select p.title, count(*) as people_with_access,
       count(distinct coalesce(a.request_id, a.id)) as teams,
       p.max_active_adopters as team_limit
from public.project_access a
join public.projects p on p.id = a.project_id
where a.status = 'active'
group by p.id
order by p.title;

-- Advisor approvals still open or expired.
select p.title, c.status, c.expires_at, c.expires_at < now() as expired
from public.advisor_consents c
join public.projects p on p.id = c.project_id
where c.status = 'pending'
order by c.expires_at;

-- Failed AI drafting runs (the error is a readable message, never file content).
select started_at, provider, model, mode, error
from public.synthesis_runs
where status = 'failed'
order by started_at desc
limit 20;

-- Open reports, newest first.
select created_at, reason, status, left(details, 120) as details
from public.reports
where status in ('open', 'in_review')
order by created_at desc;

-- Storage used per project (bytes from the file records).
select p.title, count(f.id) as files, coalesce(sum(f.size_bytes), 0) as bytes
from public.projects p
left join public.project_files f on f.project_id = p.id
group by p.id
order by bytes desc;

-- Last admin actions (the audit log is append-only).
select created_at, action, target_type, reason
from public.audit_log
order by created_at desc
limit 50;

-- Accounts that have not confirmed their email yet.
select email, created_at
from auth.users
where email_confirmed_at is null
order by created_at desc;
```

## 5. Housekeeping

```sql
-- (write) expire requests that nobody answered in time. Safe to run any time.
select public.expire_requests();

-- (write) clear old rate limit rows (check_rate_limit also does this on every call).
delete from public.rate_limit_hits where created_at < now() - interval '1 day';
```

Backup from your computer (needs the database password from Project Settings, Database):

```bash
pg_dump "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" --schema=public -Fc -f estafet-backup.dump
```

Storage files are not in that dump. Back them up from the Storage page, or with the Storage API.

## 6. Try a rule the way a signed-in user would

This shows Row Level Security at work. Replace the id with a real `auth.users.id`. It only reads, and the transaction is rolled back.

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<user-uuid>","role":"authenticated"}', true);

-- Sees only projects they own or that are public.
select slug, status from public.projects order by slug;

rollback;
```

## 7. How the app talks to these tables

Reads and simple writes use supabase-js with the signed-in person's own session, so RLS decides what comes back. Rules that must hold are SQL functions called with `supabase.rpc(...)`. Examples:

```ts
// Read: the person's own access, filtered by RLS.
const { data } = await supabase.from("project_access").select("project_id, status").eq("status", "active");

// Rule: publish a project (checks consent, review, advisor, policies in SQL).
const { error } = await supabase.rpc("publish_project", { p_project_id: projectId });

// Rule: take access to an open project after accepting the agreement.
const { error } = await supabase.rpc("take_access", { p_project_id: projectId, p_agreement_version: 1 });
```

The service role key is used only on the server: for advisor links (the token is checked by its hash), file upload and signed download URLs, AI drafting, and the admin functions. It is never sent to the browser.
