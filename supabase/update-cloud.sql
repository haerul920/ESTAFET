-- =====================================================================================
-- ESTAFET: SATU FILE UNTUK MEMPERBARUI DATABASE SUPABASE CLOUD
-- =====================================================================================
-- Cara pakai: Supabase > SQL Editor > New query > tempel SELURUH isi file ini > Run.
-- Syarat: langkah 01 sampai 10 dari folder supabase/cloud-sql sudah pernah dijalankan.
-- Aman dijalankan lebih dari sekali, juga kalau langkah 11 sampai 13 sudah pernah dijalankan.
-- Semuanya dalam satu transaksi: kalau ada satu yang gagal, tidak ada yang berubah.
--
-- Yang mengubah data yang sudah ada: proyek bermode "Dijeda" dipindah ke "Dengan persetujuan",
-- dan batas unggah lama 25 MB yang tersimpan diubah menjadi 50 MB.
-- Tidak ada proyek, akun, atau berkas yang dihapus.
--
-- Dibuat dari file di supabase/migrations. Jangan edit dengan tangan.

begin;

-- Berhenti lebih awal dengan pesan jelas kalau langkah 01 sampai 10 belum ada.
do $check$
begin
  if to_regclass('public.projects') is null or to_regclass('public.backlog_progress') is null
     or to_regclass('public.moderation_appeals') is null or to_regclass('public.admin_users_v') is null then
    raise exception 'Jalankan dulu langkah 01 sampai 10 dari folder supabase/cloud-sql.';
  end if;
end
$check$;

-- -------------------------------------------------------------------------------------
-- 20261125000001_r7_production.sql
-- -------------------------------------------------------------------------------------
-- R7: production readiness.
--   1. profiles: email notification preference and language (for the language of emails)
--   2. email_outbox: every email waits here until the sender (a scheduled job) delivers it, with retries
--   3. enqueue_emails(): turns notifications and report outcomes into outbox rows, honouring preferences
--   4. claim_emails() and finish_email(): the sender's two calls (service role only)
--   5. housekeeping(): removes old outbox rows and old rate limit rows
--   6. set_email_preferences(): a person changes their own preference and language
-- Everything is added. There is no destructive change. To undo: drop the objects above and the two profile columns.

-- ---------------------------------------------------------------- 1. profiles
alter table public.profiles
  add column if not exists email_notifications boolean not null default true,
  add column if not exists locale text not null default 'id';

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check check (locale in ('id', 'en'));

-- ---------------------------------------------------------------- 2. outbox
-- The address is NOT stored here. The sender looks it up when it delivers, so a changed address is respected
-- and a deleted account leaves no address behind.
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  dedupe_key text not null unique,
  template text not null,
  locale text not null default 'id' check (locale in ('id', 'en')),
  payload jsonb not null default '{}'::jsonb,
  essential boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_outbox_due_idx on public.email_outbox (next_attempt_at) where status in ('pending', 'sending');
create index if not exists email_outbox_status_idx on public.email_outbox (status, created_at desc);

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ---------------------------------------------------------------- 3. enqueue
-- Which notifications become an email. "Essential" ones (safety and account) ignore the person's preference;
-- the rest are marked `skipped` when the person turned email off. Only the last 3 days are looked at, so switching
-- this on never sends a flood of old news.
create or replace function public.enqueue_emails() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; c integer;
begin
  insert into public.email_outbox (user_id, dedupe_key, template, locale, payload, essential, status)
  select nt.user_id, 'n:' || nt.id, nt.type, p.locale, nt.payload,
         nt.type in ('moderation', 'appeal_outcome', 'access_revoked', 'admin_hold', 'admin_hold_overdue', 'admin_appeal'),
         case when p.email_notifications
                   or nt.type in ('moderation', 'appeal_outcome', 'access_revoked', 'admin_hold', 'admin_hold_overdue', 'admin_appeal')
              then 'pending' else 'skipped' end
  from public.notifications nt
  join public.profiles p on p.id = nt.user_id
  where nt.created_at > now() - interval '3 days'
    and nt.type in ('new_request', 'request_decision', 'agreement_accepted', 'moderation', 'appeal_outcome',
                    'access_revoked', 'team_invite', 'ownership_offer', 'admin_hold', 'admin_hold_overdue', 'admin_appeal')
  on conflict (dedupe_key) do nothing;
  get diagnostics c = row_count;
  n := n + c;

  -- The reporter hears the outcome of their own report (signed-in reporters only). Guests left no address.
  insert into public.email_outbox (user_id, dedupe_key, template, locale, payload, essential, status)
  select r.reporter_id, 'r:' || r.id || ':' || r.status, 'report_outcome', p.locale,
         jsonb_build_object('reference', r.reference, 'outcome', r.status::text), false,
         case when p.email_notifications then 'pending' else 'skipped' end
  from public.reports r
  join public.profiles p on p.id = r.reporter_id
  where r.status in ('resolved', 'dismissed')
    and r.handled_at > now() - interval '3 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics c = row_count;
  return n + c;
end $$;

-- ---------------------------------------------------------------- 4. sender calls
-- Hands out due rows and marks them `sending`. A row stuck in `sending` for 10 minutes (the sender crashed) is handed out again.
create or replace function public.claim_emails(p_limit integer default 25) returns setof public.email_outbox
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select id from public.email_outbox
    where (status = 'pending' and next_attempt_at <= now())
       or (status = 'sending' and next_attempt_at <= now() - interval '10 minutes')
    order by next_attempt_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, next_attempt_at = now()
    from due
   where o.id = due.id
  returning o.*;
end $$;

-- Records the result. A failure is retried with a growing delay (5, 15, 45, 135 minutes) and is final after 5 attempts.
-- `p_error` is a short code or class name, never the address or the message text.
create or replace function public.finish_email(p_id uuid, p_ok boolean, p_error text default null) returns text
language plpgsql security definer set search_path = public as $$
declare o public.email_outbox%rowtype; v_status text;
begin
  select * into o from public.email_outbox where id = p_id for update;
  if not found then return 'missing'; end if;
  if p_ok then
    update public.email_outbox set status = 'sent', sent_at = now(), last_error = null where id = p_id;
    return 'sent';
  end if;
  v_status := case when o.attempts >= 5 then 'failed' else 'pending' end;
  update public.email_outbox
     set status = v_status,
         last_error = left(coalesce(p_error, 'error'), 120),
         next_attempt_at = now() + (interval '5 minutes' * power(3, greatest(o.attempts - 1, 0)))
   where id = p_id;
  return v_status;
end $$;

-- ---------------------------------------------------------------- 5. housekeeping
create or replace function public.housekeeping() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_mail integer; v_rate integer;
begin
  delete from public.email_outbox where status in ('sent', 'skipped') and created_at < now() - interval '90 days';
  get diagnostics v_mail = row_count;
  delete from public.rate_limit_hits where created_at < now() - interval '2 days';
  get diagnostics v_rate = row_count;
  return jsonb_build_object('emails_removed', v_mail, 'rate_hits_removed', v_rate);
end $$;

-- ---------------------------------------------------------------- 6. a person's own preference
create or replace function public.set_email_preferences(p_enabled boolean, p_locale text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501', hint = 'sign_in'; end if;
  update public.profiles
     set email_notifications = coalesce(p_enabled, email_notifications),
         locale = case when p_locale in ('id', 'en') then p_locale else locale end
   where id = auth.uid();
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.enqueue_emails() from public, anon, authenticated;
revoke execute on function public.claim_emails(integer) from public, anon, authenticated;
revoke execute on function public.finish_email(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.housekeeping() from public, anon, authenticated;
grant execute on function public.enqueue_emails() to service_role;
grant execute on function public.claim_emails(integer) to service_role;
grant execute on function public.finish_email(uuid, boolean, text) to service_role;
grant execute on function public.housekeeping() to service_role;
revoke execute on function public.set_email_preferences(boolean, text) from public, anon;
grant execute on function public.set_email_preferences(boolean, text) to authenticated;

-- -------------------------------------------------------------------------------------
-- 20261126000001_r9_email_log.sql
-- -------------------------------------------------------------------------------------
-- R9: admin email log (PROMPTS_RELEASE.md, R6 item 10).
--   1. admin_email_log_v: a read-only view of the outbox for admins. Like the outbox, it holds NO email address and
--      no message text: template, language, status, attempts, the short error code, times and the recipient's name.
--   2. admin_resend_email(): puts a FAILED, ESSENTIAL email back in the queue, with a reason and an audit row.
-- Bounces are not tracked: no provider webhook exists yet, so the log can only say what the provider accepted.
-- Additive only. Rollback: drop function public.admin_resend_email(uuid, text); drop view public.admin_email_log_v;

-- ---------------------------------------------------------------- 1. view
create or replace view public.admin_email_log_v as
select o.id, o.template, o.locale, o.essential, o.status, o.attempts, o.last_error,
       o.created_at, o.sent_at, o.next_attempt_at, o.user_id,
       p.full_name as recipient_name,
       case when o.dedupe_key like 'r:%' then 'report' else 'notification' end as source
from public.email_outbox o
join public.profiles p on p.id = o.user_id
where public.is_admin();

revoke all on public.admin_email_log_v from anon;
grant select on public.admin_email_log_v to authenticated;

-- ---------------------------------------------------------------- 2. send again
-- Only essential emails (moderation, appeal outcome, revoked access, admin alerts) that ended as `failed`.
-- The row is queued again with a fresh set of 5 attempts; the next run of /api/cron/emails picks it up.
create or replace function public.admin_resend_email(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.email_outbox%rowtype;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  select * into o from public.email_outbox where id = p_id for update;
  if not found then
    raise exception 'Email not found' using errcode = 'P0002', hint = 'email_not_found';
  end if;
  if not o.essential or o.status <> 'failed' then
    raise exception 'Only a failed essential email can be sent again' using errcode = 'P0001', hint = 'email_not_resendable';
  end if;
  update public.email_outbox
     set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
   where id = p_id;
  perform public.write_audit('email.resend', 'email', p_id, p_reason,
    jsonb_build_object('template', o.template, 'status', o.status, 'attempts', o.attempts, 'last_error', o.last_error),
    jsonb_build_object('status', 'pending', 'attempts', 0));
end $$;

revoke all on function public.admin_resend_email(uuid, text) from public, anon;
grant execute on function public.admin_resend_email(uuid, text) to authenticated;

-- -------------------------------------------------------------------------------------
-- 20261126000002_pending_team_invites.sql
-- -------------------------------------------------------------------------------------
-- Pending team invitations by email for people who have not created an ESTAFET account yet.
-- When they register (or sign in), their pending invitations automatically become project_members rows
-- with status = 'invited' and a 'team_invite' notification.

create table if not exists public.pending_team_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);
create index if not exists pending_team_invites_email_idx on public.pending_team_invites (lower(email));
create index if not exists pending_team_invites_project_idx on public.pending_team_invites (project_id);

alter table public.pending_team_invites enable row level security;
drop policy if exists pending_team_invites_select on public.pending_team_invites;
create policy pending_team_invites_select on public.pending_team_invites for select to authenticated
  using (public.is_project_owner(project_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.invite_co_owner(p_project_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user uuid;
  v_title text;
  v_status public.project_status;
  v_email text := lower(trim(coalesce(p_email, '')));
  m public.project_members%rowtype;
begin
  perform public.assert_verified();
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can invite co-owners' using errcode = '42501', hint = 'not_owner';
  end if;
  select status, title into v_status, v_title from public.projects where id = p_project_id;
  if v_status = 'archived' then
    raise exception 'An archived project cannot be changed' using errcode = 'P0001', hint = 'archived';
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    insert into public.pending_team_invites (project_id, email, invited_by, created_at)
    values (p_project_id, v_email, auth.uid(), now())
    on conflict (project_id, email) do update
      set invited_by = auth.uid(), created_at = now();
    return;
  end if;
  if v_user = auth.uid() then
    raise exception 'You are already on this project' using errcode = 'P0001', hint = 'already_member';
  end if;
  select * into m from public.project_members where project_id = p_project_id and profile_id = v_user;
  if found and m.status = 'active' then
    raise exception 'That person is already on the team' using errcode = 'P0001', hint = 'already_member';
  end if;
  delete from public.pending_team_invites where project_id = p_project_id and lower(email) = v_email;
  insert into public.project_members (project_id, profile_id, role, status, invited_by, invited_at, consented_at)
  values (p_project_id, v_user, 'co_owner', 'invited', auth.uid(), now(), null)
  on conflict (project_id, profile_id) do update
    set status = 'invited', role = 'co_owner', invited_by = auth.uid(), invited_at = now(), responded_at = null, consented_at = null;
  perform public.notify(v_user, 'team_invite', jsonb_build_object('project_id', p_project_id, 'title', v_title));
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; v_title text;
begin
  insert into public.profiles (id, full_name, faculty, study_program)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'faculty',
    new.raw_user_meta_data ->> 'study_program'
  )
  on conflict (id) do nothing;

  if new.email is not null then
    for r in
      delete from public.pending_team_invites
      where lower(email) = lower(trim(new.email))
      returning project_id, invited_by, created_at
    loop
      insert into public.project_members (project_id, profile_id, role, status, invited_by, invited_at, consented_at)
      values (r.project_id, new.id, 'co_owner', 'invited', r.invited_by, r.created_at, null)
      on conflict (project_id, profile_id) do nothing;

      select title into v_title from public.projects where id = r.project_id;
      perform public.notify(new.id, 'team_invite', jsonb_build_object('project_id', r.project_id, 'title', coalesce(v_title, '')));
    end loop;
  end if;

  return new;
end $$;

grant execute on function public.invite_co_owner(uuid, text) to authenticated;
revoke execute on function public.invite_co_owner(uuid, text) from anon;

-- -------------------------------------------------------------------------------------
-- 20261127000001_suggestions_not_binding.sql
-- -------------------------------------------------------------------------------------
-- The next steps of a project are suggestions of the original team (CLAUDE.md 15.13). A team that asks to
-- continue may pick some of them, or none, and follow its own plan. Replaces only the function; no data changes.

create or replace function public.create_continuation_request(
  p_project_id uuid, p_team_name text, p_members jsonb, p_task_ids uuid[],
  p_plan text, p_purpose public.request_purpose, p_target_date date, p_fit_note text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v public.projects%rowtype; v_id uuid; r record; v_count int;
  v_cool int := public.setting_int('reapply_cooldown_days', 7);
  v_exp int := public.setting_int('request_expiry_days', 30);
begin
  perform public.assert_verified();
  select * into v from public.projects where id = p_project_id;
  if not found or v.status <> 'published' or v.moderation_status <> 'ok' then
    raise exception 'This project is not open for continuation requests' using errcode = 'P0001', hint = 'not_available';
  end if;
  if public.is_project_owner(p_project_id) then
    raise exception 'Owners cannot request their own project' using errcode = '42501', hint = 'own_project';
  end if;
  if v.access_mode = 'paused' then
    raise exception 'The owners paused new requests for now' using errcode = 'P0001', hint = 'paused';
  end if;
  if v.access_mode = 'open' then
    raise exception 'This project opens without approval. Continue it directly' using errcode = 'P0001', hint = 'open_mode';
  end if;
  if public.has_access(p_project_id) then
    raise exception 'You already have access to this project' using errcode = 'P0001', hint = 'already_has_access';
  end if;
  if exists (select 1 from public.project_access where project_id = p_project_id and profile_id = auth.uid() and status = 'revoked') then
    raise exception 'The owners revoked your access to this project' using errcode = 'P0001', hint = 'access_revoked';
  end if;
  if exists (select 1 from public.continuation_requests
             where project_id = p_project_id and created_by = auth.uid() and status in ('pending', 'approved')) then
    raise exception 'Your team already has an open request for this project' using errcode = 'P0001', hint = 'open_request';
  end if;
  if exists (select 1 from public.continuation_requests
             where project_id = p_project_id and created_by = auth.uid() and status = 'declined'
               and decided_at > now() - make_interval(days => v_cool)) then
    raise exception 'You can apply again % days after a decline', v_cool using errcode = 'P0001', hint = 'reapply_cooldown';
  end if;
  if not public.quota_available(p_project_id) then
    raise exception 'The team quota for this project is full' using errcode = 'P0001', hint = 'quota_full';
  end if;
  select count(*) into v_count from public.draft_items
    where project_id = p_project_id and kind = 'next_task' and review_status = 'kept' and id = any (p_task_ids);
  -- Choosing none is fine. Whatever is chosen has to be a published suggestion of this project.
  if v_count <> coalesce(array_length(p_task_ids, 1), 0) then
    raise exception 'Choose only suggestions of this project' using errcode = 'P0001', hint = 'no_task';
  end if;
  insert into public.continuation_requests
    (project_id, adopter_team_name, members, task_ids, plan, purpose, target_date, fit_note, created_by, expires_at)
  values (p_project_id, p_team_name, coalesce(p_members, '[]'::jsonb), coalesce(p_task_ids, '{}'), p_plan, p_purpose, p_target_date,
          coalesce(p_fit_note, ''), auth.uid(), now() + make_interval(days => v_exp))
  returning id into v_id;
  perform public.log_lineage(p_project_id, 'requested', auth.uid(), v_id, jsonb_build_object('team', p_team_name));
  for r in select profile_id from public.project_members where project_id = p_project_id and status = 'active' loop
    perform public.notify(r.profile_id, 'new_request', jsonb_build_object('project_id', p_project_id, 'request_id', v_id, 'title', v.title, 'team', p_team_name));
  end loop;
  return v_id;
end $$;

-- -------------------------------------------------------------------------------------
-- 20261128000001_delete_draft_project.sql
-- -------------------------------------------------------------------------------------
-- An owner can delete a draft that nobody else depends on (CLAUDE.md 15.21).
-- All rules live here, so the screen cannot be the only guard.

-- Lineage stays append-only, with TWO documented exceptions: "Purge demo data" (non-production only), and an owner
-- deleting a draft that was never published. Each sets a transaction-local flag inside its own function. Clients
-- cannot set the flag, and RLS gives them no delete on this table in any case.
create or replace function public.lineage_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and (
    coalesce(current_setting('estafet.purge', true), '') = 'on'
    or coalesce(current_setting('estafet.delete_draft', true), '') = old.project_id::text
  ) then
    return old;
  end if;
  raise exception 'lineage_events is append-only' using errcode = 'P0001';
end $$;

create or replace function public.delete_draft_project(p_project uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_project public.projects%rowtype; v_originals jsonb; v_texts jsonb;
begin
  perform public.assert_verified();
  if public.is_suspended(auth.uid()) then
    raise exception 'This account is suspended' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = p_project for update;
  if not found or not exists (
    select 1 from public.project_members
    where project_id = p_project and profile_id = auth.uid() and status = 'active' and role = 'owner'
  ) then
    raise exception 'Only the owner can delete this project' using errcode = '42501', hint = 'delete_not_owner';
  end if;
  if v_project.status <> 'draft' or v_project.published_at is not null
     or exists (select 1 from public.lineage_events where project_id = p_project and type = 'published') then
    raise exception 'Only a draft that was never published can be deleted' using errcode = 'P0001', hint = 'delete_not_draft';
  end if;
  if v_project.moderation_status <> 'ok' or exists (select 1 from public.reports where project_id = p_project) then
    raise exception 'This project is under review' using errcode = 'P0001', hint = 'delete_under_review';
  end if;
  if exists (select 1 from public.project_access where project_id = p_project)
     or exists (select 1 from public.continuation_requests where project_id = p_project) then
    raise exception 'Other people depend on this project' using errcode = 'P0001', hint = 'delete_has_history';
  end if;

  select coalesce(jsonb_agg(storage_path) filter (where storage_path is not null), '[]'::jsonb),
         coalesce(jsonb_agg(extracted_text_path) filter (where extracted_text_path is not null), '[]'::jsonb)
    into v_originals, v_texts
    from public.project_files where project_id = p_project;

  perform set_config('estafet.delete_draft', p_project::text, true);
  delete from public.lineage_events where project_id = p_project;
  delete from public.notifications where payload ->> 'project_id' = p_project::text;
  -- Files, items, runs and members go with the project through ON DELETE CASCADE.
  delete from public.projects where id = p_project;
  perform set_config('estafet.delete_draft', '', true);

  return jsonb_build_object('originals', v_originals, 'texts', v_texts);
end $$;

revoke execute on function public.delete_draft_project(uuid) from public, anon;
grant execute on function public.delete_draft_project(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- 20261128000002_remove_paused_access.sql
-- -------------------------------------------------------------------------------------
-- The "paused" access mode is removed from the product (CLAUDE.md 15.22). Projects that were paused go back to
-- "by_request", so their owners still decide about every team. The enum value stays in the database, marked retired,
-- and this constraint stops anything from choosing it again.
update public.projects set access_mode = 'by_request' where access_mode = 'paused';

alter table public.projects drop constraint if exists projects_access_mode_not_paused;
alter table public.projects add constraint projects_access_mode_not_paused check (access_mode <> 'paused');

-- -------------------------------------------------------------------------------------
-- 20261128000003_avatars_bucket.sql
-- -------------------------------------------------------------------------------------
-- Profile photos (CLAUDE.md 15.25). A private bucket with no client policies: only server code reads and writes it,
-- after checking who is signed in. Photos are re-encoded to a small JPEG in the browser before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

-- -------------------------------------------------------------------------------------
-- 20261128000004_progress_by_adopters_only.sql
-- -------------------------------------------------------------------------------------
-- Only the team that continues a project records the progress of its tasks (CLAUDE.md 15.27). Owners can read it.
create or replace function public.set_item_progress(p_item uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare it public.draft_items%rowtype;
begin
  perform public.assert_verified();
  select * into it from public.draft_items where id = p_item;
  if not found then raise exception 'Item not found' using errcode = 'P0002'; end if;
  if it.kind <> 'next_task' or it.review_status <> 'kept' then
    raise exception 'Only a verified next task can be marked' using errcode = 'P0001', hint = 'not_a_task';
  end if;
  if public.is_project_owner(it.project_id) then
    raise exception 'Only the team that continues this project can change its progress'
      using errcode = '42501', hint = 'owner_view_only';
  end if;
  if not public.has_access(it.project_id) then
    raise exception 'You do not have access to this project' using errcode = '42501', hint = 'no_access';
  end if;
  if p_status not in ('in_progress', 'done', 'none') then
    raise exception 'Unknown status' using errcode = 'P0001', hint = 'bad_status';
  end if;
  if p_status = 'none' then
    delete from public.backlog_progress where item_id = p_item;
  else
    insert into public.backlog_progress (item_id, project_id, status, updated_by)
      values (p_item, it.project_id, p_status::public.progress_status, auth.uid())
      on conflict (item_id) do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform public.log_lineage(it.project_id, 'item_progress', auth.uid(), null,
    jsonb_build_object('item_id', p_item, 'title', it.title, 'status', p_status));
    perform public.notify(m.profile_id, 'item_progress',
      jsonb_build_object('project_id', it.project_id, 'title', (select title from public.projects where id = it.project_id),
                         'slug', (select slug from public.projects where id = it.project_id), 'task', it.title, 'status', p_status))
      from public.project_members m where m.project_id = it.project_id and m.status = 'active';
end $$;

-- -------------------------------------------------------------------------------------
-- 20261129000001_admin_decides_and_roles.sql
-- -------------------------------------------------------------------------------------
-- Reports never change a project on their own: an admin looks and decides (CLAUDE.md 15.30).
-- The automatic hold is switched off. submit_report() still calls this function, which now does nothing.
create or replace function public.evaluate_report_hold(p_project uuid, p_reason public.report_reason) returns boolean
language sql stable security definer set search_path = public as $$
  select false
$$;
revoke execute on function public.evaluate_report_hold(uuid, public.report_reason) from public, anon, authenticated;

-- Admins can give and take the admin role from the Users page (CLAUDE.md 15.31, replaces the rule in 13.4).
-- Same safeguards as other sensitive actions: admin only, a written reason, audited in the same transaction.
-- The server also asks for the password again. Nobody can change their own role, and the profiles trigger still
-- protects the last admin.
create or replace function public.admin_set_role(p_user uuid, p_admin boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.profiles%rowtype;
begin
  -- One role change at a time, checked after the wait: two admins cannot remove each other at the same moment.
  perform pg_advisory_xact_lock(hashtext('estafet.admin_role'));
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = 'P0001', hint = 'own_role';
  end if;
  select * into v from public.profiles where id = p_user for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if v.is_admin = p_admin then
    raise exception 'This account already has that role' using errcode = 'P0001', hint = 'same_role';
  end if;
  if p_admin and public.is_suspended(p_user) then
    raise exception 'A suspended account cannot become an admin' using errcode = 'P0001', hint = 'role_suspended';
  end if;
  update public.profiles set is_admin = p_admin where id = p_user;
  perform public.write_audit(case when p_admin then 'user.promote' else 'user.demote' end, 'user', p_user, p_reason,
    jsonb_build_object('is_admin', v.is_admin), jsonb_build_object('is_admin', p_admin));
end $$;
revoke execute on function public.admin_set_role(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_role(uuid, boolean, text) to authenticated;

-- -------------------------------------------------------------------------------------
-- 20261129000002_legal_documents.sql
-- -------------------------------------------------------------------------------------
-- Admins write the Terms, Privacy Policy, Community Guidelines and Attribution page in the app (CLAUDE.md 15.36).
-- Every publication is a new revision. Published text is history: it is never changed or deleted. Until a document
-- has a revision, the app shows its built-in text.
create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  doc text not null check (doc in ('terms', 'privacy', 'guidelines', 'attribution')),
  revision integer not null check (revision > 0),
  content jsonb not null,
  published_at timestamptz not null default now(),
  unique (doc, revision)
);
alter table public.legal_documents enable row level security;
drop policy if exists legal_documents_select on public.legal_documents;
create policy legal_documents_select on public.legal_documents for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to anon, authenticated;

create or replace function public.legal_documents_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'legal_documents is append-only' using errcode = 'P0001';
end $$;
drop trigger if exists legal_documents_no_change on public.legal_documents;
create trigger legal_documents_no_change before update or delete on public.legal_documents
  for each row execute function public.legal_documents_append_only();

-- Publishes one document. For the Terms and the Privacy Policy it also publishes the next policy version, in the same
-- transaction, so everyone accepts the new text. Who did it and why is in the audit log.
create or replace function public.admin_publish_document(p_doc text, p_content jsonb, p_reason text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_revision integer; v_lang text; v_text jsonb;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_doc is null or p_doc not in ('terms', 'privacy', 'guidelines', 'attribution') then
    raise exception 'Unknown document' using errcode = 'P0001', hint = 'document_invalid';
  end if;
  if p_content is null or octet_length(p_content::text) > 200000 then
    raise exception 'The document is empty or too long' using errcode = 'P0001', hint = 'document_invalid';
  end if;
  foreach v_lang in array array['id', 'en'] loop
    v_text := p_content -> v_lang;
    if coalesce(trim(v_text ->> 'title'), '') = '' or coalesce(jsonb_typeof(v_text -> 'sections'), '') <> 'array' then
      raise exception 'Both languages need a title and sections' using errcode = 'P0001', hint = 'document_invalid';
    end if;
    if jsonb_array_length(v_text -> 'sections') not between 1 and 30 then
      raise exception 'A document has 1 to 30 sections' using errcode = 'P0001', hint = 'document_invalid';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtext('estafet.legal.' || p_doc));
  select coalesce(max(revision), 0) + 1 into v_revision from public.legal_documents where doc = p_doc;
  insert into public.legal_documents (doc, revision, content) values (p_doc, v_revision, p_content);
  if p_doc in ('terms', 'privacy') then
    perform public.admin_publish_policy(p_doc::public.policy_kind,
      coalesce(public.current_policy_version(p_doc::public.policy_kind), 0) + 1, p_reason);
  end if;
  perform public.write_audit('document.publish', 'document', null, p_reason, null,
    jsonb_build_object('doc', p_doc, 'revision', v_revision));
  return v_revision;
end $$;
revoke execute on function public.admin_publish_document(text, jsonb, text) from public, anon;
grant execute on function public.admin_publish_document(text, jsonb, text) to authenticated;

-- -------------------------------------------------------------------------------------
-- 20261129000003_project_translations.sql
-- -------------------------------------------------------------------------------------
-- Cached machine translations of the PUBLIC text of published projects (CLAUDE.md 15.39). Only the server reads and
-- writes this table, after it has loaded the text through the public teaser views.
create table if not exists public.project_translations (
  project_id uuid not null references public.projects (id) on delete cascade,
  lang text not null check (lang in ('id', 'en')),
  -- A fingerprint of the text that was translated. When the text changes, the translation is out of date.
  source_hash text not null,
  content jsonb not null,
  -- True when the text was already in this language, so nothing is shown as translated.
  same_language boolean not null default false,
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, lang)
);
alter table public.project_translations enable row level security;
revoke all on public.project_translations from anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 20261130000001_upload_file_kinds.sql
-- -------------------------------------------------------------------------------------
-- New kinds of upload: pictures, Word, Excel and PowerPoint (CLAUDE.md 15.40). ZIP uploads are no longer accepted;
-- 'code_tree' stays for the files older projects already have.
alter type public.file_kind add value if not exists 'image';
alter type public.file_kind add value if not exists 'word';
alter type public.file_kind add value if not exists 'spreadsheet';
alter type public.file_kind add value if not exists 'slides';

-- -------------------------------------------------------------------------------------
-- 20261130000002_upload_limit_50mb.sql
-- -------------------------------------------------------------------------------------
-- The upload limit is 50 MB (CLAUDE.md 15.40). A saved setting overrides the app's default, so the old value has to
-- move too. A setting an admin chose on purpose, other than the old default, is left alone, but never above 50.
update public.app_settings set value = to_jsonb(50), updated_at = now()
  where key = 'max_upload_mb' and ((value #>> '{}')::numeric = 25 or (value #>> '{}')::numeric > 50);

update storage.buckets set file_size_limit = 52428800, public = false where id in ('project-files', 'extracted-text');

-- -------------------------------------------------------------------------------------
-- 20261130000003_project_kinds.sql
-- -------------------------------------------------------------------------------------
-- Two more types of work (CLAUDE.md 15.41): community service, and "other".
-- "research" keeps its value; only its label changed in the app.
alter type public.project_kind add value if not exists 'community_service';
alter type public.project_kind add value if not exists 'other';

commit;

-- Supaya API Supabase langsung mengenali fungsi dan tabel baru.
notify pgrst, 'reload schema';

-- Hasil pengecekan: semua baris harus berstatus OK.
select bagian, case when ada then 'OK' else 'BELUM' end as status
from (values
  ('Antrean email', to_regclass('public.email_outbox') is not null),
  ('Undangan untuk email belum terdaftar', to_regclass('public.pending_team_invites') is not null),
  ('Saran tidak wajib dipilih', pg_get_functiondef('public.create_continuation_request'::regproc) like '%Choose only suggestions of this project%'),
  ('Hapus draf', to_regprocedure('public.delete_draft_project(uuid)') is not null),
  ('Mode Dijeda dihapus', exists (select 1 from pg_constraint where conname = 'projects_access_mode_not_paused')),
  ('Penyimpanan foto profil', exists (select 1 from storage.buckets where id = 'avatars' and not public)),
  ('Status tugas hanya oleh tim penerus', pg_get_functiondef('public.set_item_progress'::regproc) like '%owner_view_only%'),
  ('Laporan diputuskan admin (tanpa tahan otomatis)', pg_get_functiondef('public.evaluate_report_hold'::regproc) not like '%apply_moderation_core%'),
  ('Ubah peran dari halaman Pengguna', to_regprocedure('public.admin_set_role(uuid, boolean, text)') is not null),
  ('Editor dokumen kebijakan', to_regclass('public.legal_documents') is not null and to_regprocedure('public.admin_publish_document(text, jsonb, text)') is not null),
  ('Terjemahan otomatis', to_regclass('public.project_translations') is not null),
  ('Jenis berkas baru (gambar, Word, Excel, PowerPoint)', (select count(*) from pg_enum where enumtypid = 'public.file_kind'::regtype and enumlabel in ('image','word','spreadsheet','slides')) = 4),
  ('Jenis pekerjaan baru (Pengabdian, Lainnya)', (select count(*) from pg_enum where enumtypid = 'public.project_kind'::regtype and enumlabel in ('community_service','other')) = 2),
  ('Batas unggah 50 MB', not exists (select 1 from public.app_settings where key = 'max_upload_mb' and (value #>> '{}')::numeric in (25) ) and (select file_size_limit from storage.buckets where id = 'project-files') = 52428800)
) as hasil(bagian, ada);
