-- ESTAFET database, step 02 of 24: admin.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 01 succeeded.
-- Generated from supabase/migrations/20261120000001_admin.sql. Do not edit by hand.

-- ESTAFET admin area (CLAUDE.md section 13). Additive to the base schema.
-- Additions beyond 13.3 are marked "(added)": profiles.suspended_until, settings key contact_email.

create type public.moderation_status as enum ('ok', 'hidden', 'removed');
create type public.report_reason as enum ('copyright', 'personal_data', 'inaccurate', 'inappropriate', 'other');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type public.trial_cohort as enum ('baseline', 'estafet');

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column is_admin boolean not null default false,
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add column suspended_until timestamptz; -- (added) optional end date of a suspension

alter table public.projects
  add column moderation_status public.moderation_status not null default 'ok',
  add column moderation_reason text,
  add column moderated_by uuid references public.profiles (id),
  add column moderated_at timestamptz;
create index projects_moderation_idx on public.projects (moderation_status);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reporter_contact text,
  reason public.report_reason not null,
  details text not null default '',
  status public.report_status not null default 'open',
  resolution_note text,
  handled_by uuid references public.profiles (id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_project_idx on public.reports (project_id);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  before jsonb,
  after jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.trial_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_code text not null check (participant_code ~ '^[A-Za-z0-9_-]{1,12}$'), -- pseudonym only (P01)
  cohort public.trial_cohort not null,
  project_id uuid references public.projects (id) on delete set null,
  started_at timestamptz not null default now(),
  minutes_to_understand numeric check (minutes_to_understand is null or minutes_to_understand >= 0),
  completed boolean not null default false,
  correct_answers int check (correct_answers is null or correct_answers >= 0),
  total_questions int check (total_questions is null or total_questions > 0),
  sus_score numeric check (sus_score is null or (sus_score >= 0 and sus_score <= 100)),
  notes text,
  consent_confirmed boolean not null check (consent_confirmed),
  is_demo boolean not null default false,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (correct_answers is null or total_questions is null or correct_answers <= total_questions)
);
create index trial_sessions_cohort_idx on public.trial_sessions (cohort, started_at desc);

create table public.break_glass_access (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_id uuid references public.project_files (id) on delete set null,
  reason text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index break_glass_project_idx on public.break_glass_access (project_id, created_at desc);

create trigger reports_touch before update on public.reports for each row execute function public.touch_updated_at();
create trigger trial_sessions_touch before update on public.trial_sessions for each row execute function public.touch_updated_at();

-- Audit log is append-only: no update, no delete, no truncate.
create function public.audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only' using errcode = 'P0001';
end $$;
create trigger audit_no_change before update or delete on public.audit_log for each row execute function public.audit_append_only();
create trigger audit_no_truncate before truncate on public.audit_log for each statement execute function public.audit_append_only();

-- Lineage stays append-only, with ONE documented exception: "Purge demo data" (non-production only)
-- sets a transaction-local flag. The purge itself is written to audit_log.
create or replace function public.lineage_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('estafet.purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'lineage_events is append-only' using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------------------
-- Admin identity helpers
-- ---------------------------------------------------------------------------
create function public.is_suspended(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.suspended_at is not null and (p.suspended_until is null or p.suspended_until > now())
    from public.profiles p where p.id = uid
  ), false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin and not public.is_suspended(p.id) from public.profiles p where p.id = auth.uid()), false)
$$;

create function public.assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
end $$;

create function public.require_reason(p_reason text) returns void
language plpgsql immutable as $$
begin
  if length(trim(coalesce(p_reason, ''))) < 15 then
    raise exception 'A reason of at least 15 characters is required' using errcode = 'P0001';
  end if;
end $$;

-- Internal helper: one audit row. The server passes a hashed client address in the x-estafet-ip-hash header.
create function public.write_audit(p_action text, p_target_type text, p_target_id uuid, p_reason text, p_before jsonb, p_after jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text;
begin
  begin
    v_ip := nullif(current_setting('request.headers', true)::json ->> 'x-estafet-ip-hash', '');
  exception when others then
    v_ip := null;
  end;
  insert into public.audit_log (actor_id, action, target_type, target_id, reason, before, after, ip_hash)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_reason, p_before, p_after, v_ip);
end $$;

-- Suspended users cannot act, even through SECURITY DEFINER functions (auth.uid() is the JWT user).
create function public.block_suspended_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.is_suspended(auth.uid()) then
    raise exception 'Your account is suspended. Contact the ESTAFET team.' using errcode = '42501';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  for t in select unnest(array['projects','draft_items','continuation_requests','agreement_acceptances','advisor_consents','project_members','reports']) loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.block_suspended_actor()', t || '_suspended', t);
  end loop;
end $$;

-- Hidden or removed projects cannot receive new requests.
create function public.block_moderated_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.projects where id = new.project_id and moderation_status <> 'ok') then
    raise exception 'This project is not open for continuation requests' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger requests_moderation before insert on public.continuation_requests
  for each row execute function public.block_moderated_request();

-- The last admin cannot be demoted. Admins cannot remove their own flag.
create function public.profiles_admin_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_admin and not new.is_admin then
    if auth.uid() = old.id then
      raise exception 'You cannot remove your own admin access' using errcode = 'P0001';
    end if;
    if (select count(*) from public.profiles where is_admin and id <> old.id) = 0 then
      raise exception 'The last admin cannot be demoted' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_admin_flag before update of is_admin on public.profiles
  for each row execute function public.profiles_admin_guard();

-- Admin promotion and demotion: SERVICE ROLE only, never through the UI.
create function public.promote_admin(p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'No account uses that email' using errcode = 'P0002'; end if;
  update public.profiles set is_admin = true where id = v_id;
  insert into public.audit_log (actor_id, action, target_type, target_id, reason, after)
  values (null, 'admin.promote', 'user', v_id, 'Promoted with the service role', jsonb_build_object('is_admin', true));
end $$;

create function public.demote_admin(p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'No account uses that email' using errcode = 'P0002'; end if;
  update public.profiles set is_admin = false where id = v_id; -- the trigger protects the last admin
  insert into public.audit_log (actor_id, action, target_type, target_id, reason, after)
  values (null, 'admin.demote', 'user', v_id, 'Demoted with the service role', jsonb_build_object('is_admin', false));
end $$;

-- ---------------------------------------------------------------------------
-- admin_* mutations: change + audit row in ONE transaction
-- ---------------------------------------------------------------------------
create function public.apply_moderation(p_project uuid, p_status public.moderation_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype; r record; v_action text;
begin
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if v.moderation_status = p_status then
    raise exception 'The project is already %', p_status using errcode = 'P0001';
  end if;
  update public.projects
    set moderation_status = p_status,
        moderation_reason = case when p_status = 'ok' then null else p_reason end,
        moderated_by = auth.uid(), moderated_at = now()
    where id = p_project;
  v_action := case p_status when 'ok' then 'restored' when 'hidden' then 'hidden' else 'removed' end;
  perform public.write_audit('project.' || v_action, 'project', p_project, p_reason,
    jsonb_build_object('moderation_status', v.moderation_status), jsonb_build_object('moderation_status', p_status));
  for r in select profile_id from public.project_members where project_id = p_project and role = 'creator' loop
    perform public.notify(r.profile_id, 'moderation',
      jsonb_build_object('project_id', p_project, 'title', v.title, 'action', v_action, 'reason', p_reason));
  end loop;
end $$;

create function public.admin_set_project_moderation(p_project uuid, p_status public.moderation_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  perform public.apply_moderation(p_project, p_status, p_reason);
end $$;

create function public.admin_handle_report(p_report uuid, p_action text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare q public.reports%rowtype; v_status public.report_status;
begin
  perform public.assert_admin();
  perform public.require_reason(p_note);
  select * into q from public.reports where id = p_report for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  if p_action not in ('dismiss', 'in_review', 'hide', 'remove') then
    raise exception 'Unknown action' using errcode = 'P0001';
  end if;
  if q.status in ('resolved', 'dismissed') then
    raise exception 'This report is already closed' using errcode = 'P0001';
  end if;
  if p_action in ('hide', 'remove') then
    perform public.apply_moderation(q.project_id, case p_action when 'hide' then 'hidden' else 'removed' end::public.moderation_status, p_note);
  end if;
  v_status := case p_action when 'dismiss' then 'dismissed' when 'in_review' then 'in_review' else 'resolved' end;
  update public.reports
    set status = v_status, resolution_note = p_note, handled_by = auth.uid(),
        handled_at = case when v_status in ('resolved', 'dismissed') then now() else handled_at end
    where id = p_report;
  perform public.write_audit('report.' || p_action, 'report', p_report, p_note,
    jsonb_build_object('status', q.status), jsonb_build_object('status', v_status));
end $$;

create function public.admin_suspend_user(p_user uuid, p_reason text, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v public.profiles%rowtype;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_user = auth.uid() then raise exception 'You cannot suspend yourself' using errcode = 'P0001'; end if;
  if p_until is not null and p_until <= now() then raise exception 'The end date must be in the future' using errcode = 'P0001'; end if;
  select * into v from public.profiles where id = p_user for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  update public.profiles set suspended_at = now(), suspended_reason = p_reason, suspended_until = p_until where id = p_user;
  perform public.write_audit('user.suspend', 'user', p_user, p_reason,
    jsonb_build_object('suspended', v.suspended_at is not null), jsonb_build_object('suspended', true, 'until', p_until));
end $$;

create function public.admin_restore_user(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  update public.profiles set suspended_at = null, suspended_reason = null, suspended_until = null where id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  perform public.write_audit('user.restore', 'user', p_user, p_reason, jsonb_build_object('suspended', true), jsonb_build_object('suspended', false));
end $$;

-- Break glass: logs the access, audits it, tells the creators. Returns the storage path for the server to sign (5 min).
create function public.admin_break_glass(p_project uuid, p_file uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.project_files%rowtype; v_title text; v_id uuid; v_exp timestamptz := now() + interval '5 minutes'; r record;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  select * into f from public.project_files where id = p_file and project_id = p_project;
  if not found or f.storage_path = '' then raise exception 'File not found' using errcode = 'P0002'; end if;
  select title into v_title from public.projects where id = p_project;
  insert into public.break_glass_access (admin_id, project_id, file_id, reason, expires_at)
    values (auth.uid(), p_project, p_file, p_reason, v_exp) returning id into v_id;
  perform public.write_audit('break_glass.open', 'file', p_file, p_reason, null,
    jsonb_build_object('project_id', p_project, 'file', f.original_name, 'expires_at', v_exp));
  for r in select profile_id from public.project_members where project_id = p_project and role = 'creator' loop
    perform public.notify(r.profile_id, 'break_glass',
      jsonb_build_object('project_id', p_project, 'title', v_title, 'file', f.original_name, 'reason', p_reason));
  end loop;
  return jsonb_build_object('access_id', v_id, 'expires_at', v_exp);
end $$;

-- Returns the storage path for an open (not expired) break glass access owned by the calling admin.
create function public.admin_break_glass_get(p_access uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b public.break_glass_access%rowtype; f public.project_files%rowtype;
begin
  perform public.assert_admin();
  select * into b from public.break_glass_access where id = p_access and admin_id = auth.uid();
  if not found then raise exception 'Access not found' using errcode = 'P0002'; end if;
  if b.expires_at <= now() then raise exception 'This emergency access has expired' using errcode = 'P0001'; end if;
  select * into f from public.project_files where id = b.file_id;
  return jsonb_build_object('storage_path', f.storage_path, 'file_name', f.original_name, 'kind', f.kind,
    'expires_at', b.expires_at, 'project_id', b.project_id, 'reason', b.reason);
end $$;

create function public.admin_update_setting(p_key text, p_value jsonb, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_key not in ('allowed_email_domains', 'max_upload_mb', 'synthesis_daily_cap', 'advisor_token_ttl_days',
                   'show_demo_banner', 'registrations_open', 'contact_email') then
    raise exception 'Unknown setting' using errcode = 'P0001';
  end if;
  select value into v_before from public.app_settings where key = p_key;
  insert into public.app_settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.write_audit('setting.update', 'setting', null, p_reason,
    jsonb_build_object('key', p_key, 'value', v_before), jsonb_build_object('key', p_key, 'value', p_value));
end $$;

create function public.admin_regenerate_consent(p_project uuid, p_token_hash text, p_expires timestamptz, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  update public.advisor_consents set status = 'withdrawn', decided_at = now() where project_id = p_project and status = 'pending';
  insert into public.advisor_consents (project_id, token_hash, expires_at) values (p_project, p_token_hash, p_expires) returning id into v_id;
  update public.projects set status = 'awaiting_advisor' where id = p_project and status = 'draft';
  perform public.write_audit('consent.regenerate', 'project', p_project, p_reason, null, jsonb_build_object('consent_id', v_id, 'expires_at', p_expires));
  return v_id;
end $$;

create function public.admin_cancel_run(p_run uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.synthesis_runs%rowtype;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  select * into v from public.synthesis_runs where id = p_run for update;
  if not found then raise exception 'Run not found' using errcode = 'P0002'; end if;
  if v.status not in ('queued', 'running') then raise exception 'Only a queued or running run can be cancelled' using errcode = 'P0001'; end if;
  update public.synthesis_runs set status = 'failed', error = 'Cancelled by an admin', finished_at = now() where id = p_run;
  perform public.write_audit('run.cancel', 'synthesis_run', p_run, p_reason, jsonb_build_object('status', v.status), jsonb_build_object('status', 'failed'));
end $$;

-- Generic audited action for work the server does itself (for example retrying a synthesis run).
create function public.admin_log_action(p_action text, p_target_type text, p_target_id uuid, p_reason text, p_before jsonb, p_after jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  perform public.write_audit(p_action, p_target_type, p_target_id, p_reason, p_before, p_after);
end $$;

create function public.admin_add_note(p_target_type text, p_target_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Write a note first' using errcode = 'P0001'; end if;
  if p_target_type not in ('request', 'project', 'user') then raise exception 'Unknown target' using errcode = 'P0001'; end if;
  perform public.write_audit('note.add', p_target_type, p_target_id, trim(p_note), null, null);
end $$;

create function public.admin_trial_save(p_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_before jsonb;
begin
  perform public.assert_admin();
  if p_id is null then
    insert into public.trial_sessions (participant_code, cohort, project_id, started_at, minutes_to_understand, completed,
      correct_answers, total_questions, sus_score, notes, consent_confirmed, is_demo, recorded_by)
    values (
      p_data ->> 'participant_code', (p_data ->> 'cohort')::public.trial_cohort, nullif(p_data ->> 'project_id', '')::uuid,
      coalesce(nullif(p_data ->> 'started_at', '')::timestamptz, now()), nullif(p_data ->> 'minutes_to_understand', '')::numeric,
      coalesce((p_data ->> 'completed')::boolean, false), nullif(p_data ->> 'correct_answers', '')::int,
      nullif(p_data ->> 'total_questions', '')::int, nullif(p_data ->> 'sus_score', '')::numeric, nullif(p_data ->> 'notes', ''),
      coalesce((p_data ->> 'consent_confirmed')::boolean, false), coalesce((p_data ->> 'is_demo')::boolean, false), auth.uid())
    returning id into v_id;
    perform public.write_audit('trial.create', 'trial_session', v_id, null, null, to_jsonb((select t from public.trial_sessions t where id = v_id)));
  else
    select to_jsonb(t) into v_before from public.trial_sessions t where id = p_id;
    if v_before is null then raise exception 'Session not found' using errcode = 'P0002'; end if;
    update public.trial_sessions set
      participant_code = p_data ->> 'participant_code', cohort = (p_data ->> 'cohort')::public.trial_cohort,
      project_id = nullif(p_data ->> 'project_id', '')::uuid,
      started_at = coalesce(nullif(p_data ->> 'started_at', '')::timestamptz, started_at),
      minutes_to_understand = nullif(p_data ->> 'minutes_to_understand', '')::numeric,
      completed = coalesce((p_data ->> 'completed')::boolean, false), correct_answers = nullif(p_data ->> 'correct_answers', '')::int,
      total_questions = nullif(p_data ->> 'total_questions', '')::int, sus_score = nullif(p_data ->> 'sus_score', '')::numeric,
      notes = nullif(p_data ->> 'notes', ''), consent_confirmed = coalesce((p_data ->> 'consent_confirmed')::boolean, false),
      is_demo = coalesce((p_data ->> 'is_demo')::boolean, false)
    where id = p_id;
    perform public.write_audit('trial.update', 'trial_session', p_id, null, v_before, to_jsonb((select t from public.trial_sessions t where id = p_id)));
  end if;
  return v_id;
end $$;

create function public.admin_demo_storage_paths() returns setof text
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
    select f.storage_path from public.project_files f join public.projects p on p.id = f.project_id where p.is_demo and f.storage_path <> ''
    union all
    select f.extracted_text_path from public.project_files f join public.projects p on p.id = f.project_id where p.is_demo and f.extracted_text_path is not null;
end $$;

-- Purge demo data: only rows with is_demo = true. p_allow is false in production (the server decides).
create function public.admin_purge_demo(p_reason text, p_allow boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_projects int; n_trials int;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if not coalesce(p_allow, false) then
    raise exception 'Purging demo data is not allowed in this environment' using errcode = '42501';
  end if;
  perform set_config('estafet.purge', 'on', true);
  delete from public.lineage_events where project_id in (select id from public.projects where is_demo);
  delete from public.notifications where payload ->> 'project_id' in (select id::text from public.projects where is_demo);
  delete from public.trial_sessions where is_demo;
  get diagnostics n_trials = row_count;
  delete from public.projects where is_demo;
  get diagnostics n_projects = row_count;
  perform public.write_audit('purge.demo', 'platform', null, p_reason, null, jsonb_build_object('projects', n_projects, 'trial_sessions', n_trials));
  return jsonb_build_object('projects', n_projects, 'trial_sessions', n_trials);
end $$;

-- ---------------------------------------------------------------------------
-- Read side for the admin UI: views and functions gated by is_admin(). Metadata only.
-- ---------------------------------------------------------------------------
create view public.admin_projects_v as
select p.id, p.slug, p.title, p.status, p.moderation_status, p.moderation_reason, p.is_demo, p.field, p.year,
  p.created_at, p.updated_at, p.published_at,
  coalesce((select string_agg(pr.full_name, ', ' order by m.created_at) from public.project_members m
            join public.profiles pr on pr.id = m.profile_id where m.project_id = p.id and m.role = 'creator'), '') as creators,
  (select count(*) from public.reports r where r.project_id = p.id and r.status in ('open', 'in_review'))::int as open_reports
from public.projects p where public.is_admin();

create view public.admin_users_v as
select pr.id, pr.full_name, u.email, pr.university, pr.faculty, pr.is_admin, pr.suspended_at, pr.suspended_reason, pr.suspended_until,
  (pr.suspended_at is not null and (pr.suspended_until is null or pr.suspended_until > now())) as suspended, u.last_sign_in_at, pr.created_at,
  (select count(*) from public.project_members m where m.profile_id = pr.id and m.role = 'creator')::int as projects_count,
  (select count(*) from public.continuation_requests r where r.created_by = pr.id)::int as requests_count
from public.profiles pr join auth.users u on u.id = pr.id where public.is_admin();

create view public.admin_reports_v as
select r.id, r.project_id, p.title as project_title, p.slug as project_slug, p.moderation_status, r.reason, r.details, r.status,
  r.resolution_note, r.reporter_contact, r.reporter_id, r.handled_by, h.full_name as handler_name, r.handled_at, r.created_at,
  (select count(*) from public.reports o where o.project_id = r.project_id and o.id <> r.id)::int as other_reports
from public.reports r join public.projects p on p.id = r.project_id left join public.profiles h on h.id = r.handled_by
where public.is_admin();

create view public.admin_runs_v as
select s.id, s.project_id, p.title as project_title, s.provider, s.model, s.mode, s.status, s.error, s.input_hash,
  s.created_at, s.started_at, s.finished_at, s.requested_by,
  extract(epoch from (coalesce(s.finished_at, now()) - coalesce(s.started_at, s.created_at)))::int as duration_seconds,
  (select count(*) from public.draft_items i where i.run_id = s.id)::int as items_total,
  (select count(*) from public.draft_items i where i.run_id = s.id and i.evidence_status = 'matched')::int as items_matched,
  (select count(*) from public.draft_items i where i.run_id = s.id and i.evidence_status = 'partial')::int as items_partial,
  (select count(*) from public.draft_items i where i.run_id = s.id and i.evidence_status = 'not_found')::int as items_not_found,
  p.is_demo
from public.synthesis_runs s join public.projects p on p.id = s.project_id where public.is_admin();

create view public.admin_consents_v as
select c.id, c.project_id, p.title as project_title, p.advisor_name, c.status, c.expires_at, c.decided_at, c.created_at, p.is_demo,
  (c.status = 'pending' and c.expires_at < now()) as expired,
  extract(day from (now() - c.created_at))::int as age_days
from public.advisor_consents c join public.projects p on p.id = c.project_id where public.is_admin();

create view public.admin_requests_v as
select r.id, r.project_id, p.title as project_title, r.adopter_team_name, r.status, r.created_at, p.is_demo,
  r.plan, r.purpose, r.target_date, r.fit_note, r.decision_note, jsonb_array_length(r.members) + 1 as team_size,
  greatest(r.updated_at, coalesce(r.decided_at, r.updated_at)) as last_change,
  (r.status = 'pending' and r.created_at < now() - interval '7 days') as stale,
  (r.status = 'approved' and not public.request_unlocked(r.id)) as waiting_agreement,
  public.request_unlocked(r.id) as unlocked
from public.continuation_requests r join public.projects p on p.id = r.project_id where public.is_admin();

create view public.admin_audit_v as
select a.id, a.actor_id, coalesce(pr.full_name, 'System') as actor_name, a.action, a.target_type, a.target_id, a.reason,
  a.before, a.after, a.created_at
from public.audit_log a left join public.profiles pr on pr.id = a.actor_id where public.is_admin();

create view public.admin_trials_v as
select t.id, t.participant_code, t.cohort, t.project_id, p.title as project_title, t.started_at, t.minutes_to_understand, t.completed,
  t.correct_answers, t.total_questions, t.sus_score, t.notes, t.consent_confirmed, t.is_demo, t.created_at
from public.trial_sessions t left join public.projects p on p.id = t.project_id where public.is_admin();

-- Overview numbers. Demo rows are excluded unless asked for.
create function public.admin_overview(p_include_demo boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'open_reports', (select count(*) from public.reports r join public.projects p on p.id = r.project_id
                     where r.status in ('open', 'in_review') and (p_include_demo or not p.is_demo)),
    'hidden_projects', (select count(*) from public.projects p where p.moderation_status <> 'ok' and (p_include_demo or not p.is_demo)),
    'failed_runs_24h', (select count(*) from public.synthesis_runs s join public.projects p on p.id = s.project_id
                        where s.status = 'failed' and s.created_at > now() - interval '24 hours' and (p_include_demo or not p.is_demo)),
    'expired_consents', (select count(*) from public.advisor_consents c join public.projects p on p.id = c.project_id
                         where c.status = 'pending' and c.expires_at < now() and (p_include_demo or not p.is_demo)),
    'stale_requests', (select count(*) from public.continuation_requests r join public.projects p on p.id = r.project_id
                       where r.status = 'pending' and r.created_at < now() - interval '7 days' and (p_include_demo or not p.is_demo)),
    'projects_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                           (select status, count(*) n from public.projects p where p_include_demo or not p.is_demo group by status) s),
    'requests_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                           (select r.status, count(*) n from public.continuation_requests r join public.projects p on p.id = r.project_id
                            where p_include_demo or not p.is_demo group by r.status) s),
    'users_total', (select count(*) from public.profiles),
    'users_suspended', (select count(*) from public.profiles pr where public.is_suspended(pr.id)),
    'demo_projects', (select count(*) from public.projects where is_demo)
  ) into v;
  return v;
end $$;

-- Trial summary per cohort. Minutes statistics use COMPLETED sessions only.
create function public.admin_trial_summary(p_include_demo boolean default false)
returns table (
  cohort public.trial_cohort, n int, completed_n int, median_minutes numeric, mean_minutes numeric, completion_rate numeric,
  mean_score numeric, mean_sus numeric, within30_n int, within30_share numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select t.cohort,
    count(*)::int,
    (count(*) filter (where t.completed))::int,
    round((percentile_cont(0.5) within group (order by t.minutes_to_understand) filter (where t.completed and t.minutes_to_understand is not null))::numeric, 2),
    round((avg(t.minutes_to_understand) filter (where t.completed and t.minutes_to_understand is not null))::numeric, 2),
    round(count(*) filter (where t.completed)::numeric / count(*), 3),
    round((avg(t.correct_answers::numeric / t.total_questions) filter (where t.total_questions > 0 and t.correct_answers is not null))::numeric, 3),
    round((avg(t.sus_score))::numeric, 1),
    (count(*) filter (where t.completed and t.minutes_to_understand <= 30))::int,
    round(count(*) filter (where t.completed and t.minutes_to_understand <= 30)::numeric / count(*), 3)
  from public.trial_sessions t
  where p_include_demo or not t.is_demo
  group by t.cohort order by t.cohort;
end $$;

create function public.admin_project_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'project', to_jsonb(p) - 'advisor_email',
    'creators', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.full_name)), '[]'::jsonb)
                 from public.project_members m join public.profiles pr on pr.id = m.profile_id where m.project_id = p.id and m.role = 'creator'),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'title', i.title, 'effort', i.effort,
                 'objective_status', i.objective_status) order by i.position), '[]'::jsonb)
              from public.draft_items i where i.project_id = p.id and i.review_status = 'kept'),
    'evidence', jsonb_build_object(
      'matched', (select count(*) from public.draft_items i where i.project_id = p.id and i.evidence_status = 'matched' and i.origin = 'ai'),
      'partial', (select count(*) from public.draft_items i where i.project_id = p.id and i.evidence_status = 'partial' and i.origin = 'ai'),
      'not_found', (select count(*) from public.draft_items i where i.project_id = p.id and i.evidence_status = 'not_found' and i.origin = 'ai')),
    'files', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.original_name, 'kind', f.kind, 'size_bytes', f.size_bytes,
                'page_count', f.page_count, 'skipped', jsonb_array_length(f.skipped_sensitive), 'status', f.ingest_status,
                'stored', f.storage_path <> '') order by f.created_at), '[]'::jsonb) from public.project_files f where f.project_id = p.id),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'team', r.adopter_team_name, 'status', r.status, 'created_at', r.created_at)
                 order by r.created_at desc), '[]'::jsonb) from public.continuation_requests r where r.project_id = p.id),
    'consent', (select to_jsonb(c) - 'token_hash' from public.advisor_consents c where c.project_id = p.id
                order by (c.status = 'approved') desc, c.created_at desc limit 1),
    'lineage', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'created_at', e.created_at) order by e.created_at), '[]'::jsonb)
                from public.lineage_events e where e.project_id = p.id),
    'audit', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from
              (select a.id, a.action, a.reason, a.created_at, coalesce(pr.full_name, 'System') as actor_name
               from public.audit_log a left join public.profiles pr on pr.id = a.actor_id
               where a.target_id = p.id or a.after ->> 'project_id' = p.id::text order by a.created_at desc limit 25) x)
  ) into v from public.projects p where p.id = p_id;
  return v;
end $$;

create function public.admin_user_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare v jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'profile', jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'email', u.email, 'university', pr.university, 'faculty', pr.faculty,
                'study_program', pr.study_program, 'is_admin', pr.is_admin, 'suspended', public.is_suspended(pr.id),
                'suspended_at', pr.suspended_at, 'suspended_reason', pr.suspended_reason, 'suspended_until', pr.suspended_until,
                'last_sign_in_at', u.last_sign_in_at, 'created_at', pr.created_at),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status, 'moderation_status', p.moderation_status)), '[]'::jsonb)
                 from public.project_members m join public.projects p on p.id = m.project_id where m.profile_id = pr.id),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'team', r.adopter_team_name, 'status', r.status, 'project', p.title)), '[]'::jsonb)
                 from public.continuation_requests r join public.projects p on p.id = r.project_id where r.created_by = pr.id),
    'audit', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from
              (select a.id, a.action, a.reason, a.created_at from public.audit_log a
               where a.target_id = pr.id or a.actor_id = pr.id order by a.created_at desc limit 25) x)
  ) into v from public.profiles pr join auth.users u on u.id = pr.id where pr.id = p_id;
  return v;
end $$;

create function public.admin_search(p_q text) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare q text := '%' || replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform public.assert_admin();
  if length(trim(coalesce(p_q, ''))) < 2 then return jsonb_build_object('projects', '[]'::jsonb, 'users', '[]'::jsonb, 'reports', '[]'::jsonb); end if;
  return jsonb_build_object(
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'sub', x.slug)), '[]'::jsonb)
                 from (select id, title, slug from public.projects where title ilike q or slug ilike q order by updated_at desc limit 5) x),
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.full_name, 'sub', x.email)), '[]'::jsonb)
              from (select pr.id, pr.full_name, u.email from public.profiles pr join auth.users u on u.id = pr.id
                    where pr.full_name ilike q or u.email ilike q limit 5) x),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'sub', x.reason)), '[]'::jsonb)
                from (select r.id, p.title, r.reason::text as reason from public.reports r join public.projects p on p.id = r.project_id
                      where p.title ilike q order by r.created_at desc limit 5) x));
end $$;

-- ---------------------------------------------------------------------------
-- Public side: views hide moderated projects everywhere (Explore, teaser, search)
-- ---------------------------------------------------------------------------
create or replace view public.public_project_teaser as
select
  p.id, p.slug, p.title, p.summary, p.kind, p.field, p.year, p.stop_reason, p.status,
  p.advisor_name, p.is_demo, p.published_at, p.stopped_note, p.tech, p.team_size,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept')::int as objectives_total,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept' and i.objective_status = 'done')::int as objectives_done,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'next_task' and i.review_status = 'kept')::int as tasks_count
from public.projects p
where p.status in ('published', 'adopted') and p.moderation_status = 'ok';

create or replace view public.public_teaser_items as
select
  i.id, i.project_id, i.kind, i.title, i.description, i.effort, i.lesson_type, i.objective_status, i.position,
  (
    select f.original_name || case when f.kind = 'markdown' then ', section ' else ', p.' end || (i.evidence -> 0 ->> 'page')
    from public.project_files f
    where f.id = nullif(i.evidence -> 0 ->> 'file_id', '')::uuid
  ) as source_label
from public.draft_items i
join public.projects p on p.id = i.project_id
where p.status in ('published', 'adopted') and p.moderation_status = 'ok' and i.review_status = 'kept';

create or replace view public.public_project_lineage as
select e.id, e.project_id, e.type, e.created_at, (e.payload ->> 'team') as team
from public.lineage_events e
join public.projects p on p.id = e.project_id
where p.status in ('published', 'adopted') and p.moderation_status = 'ok' and e.type in ('created', 'published', 'continued');

-- ---------------------------------------------------------------------------
-- RLS on the new tables. Admin policies are the only client access; writes go through admin_* functions.
-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_settings enable row level security;
alter table public.trial_sessions enable row level security;
alter table public.break_glass_access enable row level security;

create policy reports_admin_select on public.reports for select to authenticated using (public.is_admin());
create policy audit_admin_select on public.audit_log for select to authenticated using (public.is_admin());
create policy settings_admin_select on public.app_settings for select to authenticated using (public.is_admin());
create policy trials_admin_select on public.trial_sessions for select to authenticated using (public.is_admin());
create policy break_glass_admin_select on public.break_glass_access for select to authenticated using (public.is_admin());

revoke insert, update, delete, truncate on public.reports, public.audit_log, public.app_settings, public.trial_sessions,
  public.break_glass_access from authenticated, anon;
revoke select on public.reports, public.audit_log, public.app_settings, public.trial_sessions, public.break_glass_access from anon;
revoke select on public.admin_projects_v, public.admin_users_v, public.admin_reports_v, public.admin_runs_v, public.admin_consents_v,
  public.admin_requests_v, public.admin_audit_v, public.admin_trials_v from anon;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and (p.proname like 'admin\_%' or p.proname in ('is_admin', 'is_suspended', 'assert_admin', 'require_reason', 'write_audit',
           'apply_moderation', 'promote_admin', 'demote_admin', 'block_suspended_actor', 'block_moderated_request',
           'profiles_admin_guard', 'audit_append_only'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function public.is_admin() to authenticated;
grant execute on function
  public.admin_set_project_moderation(uuid, public.moderation_status, text), public.admin_handle_report(uuid, text, text),
  public.admin_suspend_user(uuid, text, timestamptz), public.admin_restore_user(uuid, text),
  public.admin_break_glass(uuid, uuid, text), public.admin_break_glass_get(uuid), public.admin_update_setting(text, jsonb, text),
  public.admin_regenerate_consent(uuid, text, timestamptz, text), public.admin_cancel_run(uuid, text),
  public.admin_log_action(text, text, uuid, text, jsonb, jsonb), public.admin_add_note(text, uuid, text),
  public.admin_trial_save(uuid, jsonb), public.admin_demo_storage_paths(), public.admin_purge_demo(text, boolean),
  public.admin_overview(boolean), public.admin_trial_summary(boolean), public.admin_project_detail(uuid),
  public.admin_user_detail(uuid), public.admin_search(text)
to authenticated;
grant execute on function public.promote_admin(text), public.demote_admin(text) to service_role;
grant select on public.admin_projects_v, public.admin_users_v, public.admin_reports_v, public.admin_runs_v, public.admin_consents_v,
  public.admin_requests_v, public.admin_audit_v, public.admin_trials_v to authenticated;
