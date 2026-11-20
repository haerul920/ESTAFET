-- ESTAFET: full database setup (schema + admin area + demo seed) in ONE file.
-- For the Supabase SQL Editor (cloud) or: psql "$DATABASE_URL" -f supabase/setup-all.sql
-- Source of truth: supabase/migrations/*.sql then supabase/seed.sql. Run on an EMPTY database.
-- Seed is optional and all demo rows are is_demo = true. Skip PART 3 for a real deployment.

-- ===================== PART 1: SCHEMA =====================
-- ESTAFET schema: tables, enums, state-rule functions, RLS, public views, storage buckets.
-- Additive columns beyond CLAUDE.md section 6 are marked "(added)" so reviewers can find them.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.project_kind as enum ('student_program', 'hackathon', 'research');
create type public.stop_reason as enum ('funding_not_granted', 'team_graduated', 'time_or_people', 'other');
create type public.project_status as enum ('draft', 'awaiting_advisor', 'verifying', 'published', 'adopted', 'archived');
create type public.member_role as enum ('creator', 'adopter');
create type public.consent_status as enum ('pending', 'approved', 'declined', 'withdrawn');
create type public.file_kind as enum ('pdf', 'markdown', 'code_tree');
create type public.run_mode as enum ('live', 'mock');
create type public.run_status as enum ('queued', 'running', 'done', 'failed');
create type public.item_kind as enum ('objective', 'completed', 'next_task', 'lesson');
create type public.effort as enum ('small', 'medium', 'large');
create type public.lesson_type as enum ('methodology', 'evaluation_feedback', 'funding_feedback', 'blocker');
create type public.evidence_status as enum ('matched', 'not_found', 'partial');
create type public.item_origin as enum ('ai', 'creator');
create type public.review_status as enum ('pending', 'kept', 'removed');
create type public.request_purpose as enum ('competition', 'research', 'course', 'other');
create type public.request_status as enum ('pending', 'approved', 'declined', 'withdrawn');
create type public.agreement_side as enum ('creator', 'adopter');
create type public.lineage_type as enum (
  'created', 'advisor_approved', 'published', 'requested', 'approved',
  'agreement_signed', 'continued', 'resubmitted',
  'declined', 'advisor_withdrawn' -- (added) every transition is logged, including negative ones
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Version of the Attribution Agreement terms currently in force (mirrored in src/lib/agreement/terms.ts).
create function public.current_agreement_version() returns int
language sql immutable as $$ select 1 $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  university text not null default 'Universitas Hasanuddin',
  faculty text,
  study_program text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  kind public.project_kind not null default 'student_program',
  field text not null default '',
  year int not null default extract(year from now())::int,
  stop_reason public.stop_reason not null default 'other',
  status public.project_status not null default 'draft',
  advisor_name text not null default '',
  advisor_email text not null default '',
  created_by uuid not null references public.profiles (id),
  is_demo boolean not null default false,
  published_at timestamptz,
  stopped_note text not null default '',            -- (added) "Where it stopped" note on the teaser
  tech text[] not null default '{}',                -- (added) "Built with" chips, from synthesis `tech`
  team_size int not null default 1 check (team_size between 1 and 12), -- (added) shown as "team of N"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_status_idx on public.projects (status);
create index projects_created_by_idx on public.projects (created_by);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index project_members_profile_idx on public.project_members (profile_id);

create table public.advisor_consents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  token_hash text not null unique,
  status public.consent_status not null default 'pending',
  comment text,
  expires_at timestamptz not null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index advisor_consents_project_idx on public.advisor_consents (project_id);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.file_kind not null,
  storage_path text not null,
  original_name text not null,
  size_bytes bigint not null default 0,
  page_count int,
  extracted_text_path text,
  skipped_sensitive jsonb not null default '[]'::jsonb,
  ingest_status text not null default 'ready' check (ingest_status in ('ready', 'check')), -- (added)
  ingest_note text not null default '',                                                    -- (added)
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_files_project_idx on public.project_files (project_id);

create table public.synthesis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  provider text not null,
  model text not null default '',
  mode public.run_mode not null,
  status public.run_status not null default 'queued',
  input_hash text not null default '',
  error text,
  requested_by uuid references public.profiles (id), -- (added) per-user rate limit
  summary_draft text,                                -- (added) the model's drafted summary, offered to the creator
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index synthesis_runs_project_idx on public.synthesis_runs (project_id, created_at desc);
create index synthesis_runs_user_idx on public.synthesis_runs (requested_by, created_at desc);

create table public.draft_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  run_id uuid references public.synthesis_runs (id) on delete set null,
  kind public.item_kind not null,
  title text not null,
  description text not null default '',
  effort public.effort,
  lesson_type public.lesson_type,
  objective_status text check (objective_status in ('done', 'in_progress', 'not_started')), -- (added) objectives only
  evidence jsonb not null default '[]'::jsonb, -- [{ file_id, page, quote }], quote at most 25 words
  evidence_status public.evidence_status not null default 'not_found',
  origin public.item_origin not null default 'ai',
  review_status public.review_status not null default 'pending',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index draft_items_project_idx on public.draft_items (project_id, position);

create table public.continuation_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  adopter_team_name text not null,
  members jsonb not null default '[]'::jsonb, -- [{ email }] teammates besides the requester
  task_ids uuid[] not null default '{}',
  plan text not null,
  purpose public.request_purpose not null,
  target_date date,
  fit_note text not null default '',
  status public.request_status not null default 'pending',
  decision_note text,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index continuation_requests_project_idx on public.continuation_requests (project_id);
create index continuation_requests_creator_idx on public.continuation_requests (created_by);

create table public.agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.continuation_requests (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  side public.agreement_side not null,
  agreement_version int not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, profile_id, agreement_version)
);

create table public.lineage_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id), -- no cascade: lineage is append-only
  type public.lineage_type not null,
  actor_id uuid references public.profiles (id),
  request_id uuid references public.continuation_requests (id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lineage_events_project_idx on public.lineage_events (project_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- (added) DB-backed rate limiting for the advisor endpoint and other server routes.
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on public.rate_limit_hits (key, created_at desc);

-- updated_at triggers
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','projects','project_members','advisor_consents','project_files','synthesis_runs',
    'draft_items','continuation_requests','agreement_acceptances','lineage_events','notifications'
  ]) loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- Lineage is append-only.
create function public.lineage_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'lineage_events is append-only' using errcode = 'P0001';
end $$;
create trigger lineage_no_update before update or delete on public.lineage_events
  for each row execute function public.lineage_append_only();
create trigger lineage_no_truncate before truncate on public.lineage_events
  for each statement execute function public.lineage_append_only();

-- ---------------------------------------------------------------------------
-- Access helper functions (SECURITY DEFINER so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create function public.is_project_creator(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and profile_id = auth.uid() and role = 'creator'
  )
$$;

create function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members where project_id = pid and profile_id = auth.uid()
  )
$$;

create function public.project_is_editable(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects
    where id = pid and status in ('draft', 'awaiting_advisor', 'verifying')
  )
$$;

-- True when the caller belongs to the requesting team (requester or listed teammate email).
create function public.is_request_team(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.continuation_requests r
    where r.id = rid and (
      r.created_by = auth.uid()
      or exists (
        select 1 from jsonb_array_elements(r.members) m
        where lower(m ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  )
$$;

create function public.can_see_request(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_request_team(rid) or exists (
    select 1 from public.continuation_requests r
    where r.id = rid and public.is_project_creator(r.project_id)
  )
$$;

-- Unlock rule: request approved AND both sides accepted the current agreement version.
create function public.request_unlocked(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.continuation_requests r
    where r.id = rid and r.status = 'approved'
      and exists (select 1 from public.agreement_acceptances a
                  where a.request_id = r.id and a.side = 'creator'
                    and a.agreement_version = public.current_agreement_version())
      and exists (select 1 from public.agreement_acceptances a
                  where a.request_id = r.id and a.side = 'adopter'
                    and a.agreement_version = public.current_agreement_version())
  )
$$;

create function public.has_unlocked(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.continuation_requests r
    where r.project_id = pid and public.request_unlocked(r.id) and public.is_request_team(r.id)
  )
$$;

create function public.can_read_private(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_project_creator(pid) or public.has_unlocked(pid)
$$;

create function public.notify(p_user uuid, p_type text, p_payload jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, payload) values (p_user, p_type, p_payload)
$$;

create function public.log_lineage(p_project uuid, p_type public.lineage_type, p_actor uuid, p_request uuid, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.lineage_events (project_id, type, actor_id, request_id, payload)
  values (p_project, p_type, p_actor, p_request, coalesce(p_payload, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------------------
-- Triggers: profile on sign up, slug + creator membership on project insert
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, faculty, study_program)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'faculty',
    new.raw_user_meta_data ->> 'study_program'
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.projects_before_insert() returns trigger
language plpgsql as $$
declare base text; candidate text;
begin
  if new.slug is null or new.slug = '' then
    base := trim(both '-' from lower(regexp_replace(new.title, '[^a-zA-Z0-9]+', '-', 'g')));
    if base = '' then base := 'project'; end if;
    candidate := base;
    while exists (select 1 from public.projects where slug = candidate) loop
      candidate := base || '-' || substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 5);
    end loop;
    new.slug := candidate;
  end if;
  return new;
end $$;
create trigger projects_slug before insert on public.projects
  for each row execute function public.projects_before_insert();

create function public.projects_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, profile_id, role)
  values (new.id, new.created_by, 'creator')
  on conflict do nothing;
  perform public.log_lineage(new.id, 'created', new.created_by, null, jsonb_build_object('title', new.title));
  return new;
end $$;
create trigger projects_members after insert on public.projects
  for each row execute function public.projects_after_insert();

-- ---------------------------------------------------------------------------
-- State-rule functions (called through RPC; the only way to change status fields)
-- ---------------------------------------------------------------------------

-- Team: add a creator by account email.
create function public.add_team_member(p_project_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not public.is_project_creator(p_project_id) then
    raise exception 'Only a creator can add team members' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No ESTAFET account uses that email yet. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  insert into public.project_members (project_id, profile_id, role)
  values (p_project_id, v_user, 'creator') on conflict do nothing;
  perform public.notify(v_user, 'team_invite', jsonb_build_object('project_id', p_project_id));
  update public.projects p set team_size = (
    select count(*) from public.project_members m where m.project_id = p.id and m.role = 'creator'
  ) where p.id = p_project_id;
end $$;

create function public.remove_team_member(p_project_id uuid, p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_project_creator(p_project_id) then
    raise exception 'Only a creator can remove team members' using errcode = '42501';
  end if;
  if p_profile = (select created_by from public.projects where id = p_project_id) then
    raise exception 'The project owner cannot be removed' using errcode = 'P0001';
  end if;
  delete from public.project_members where project_id = p_project_id and profile_id = p_profile and role = 'creator';
  update public.projects p set team_size = (
    select count(*) from public.project_members m where m.project_id = p.id and m.role = 'creator'
  ) where p.id = p_project_id;
end $$;

create function public.confirm_team_consent(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.project_members set consented_at = now()
  where project_id = p_project_id and profile_id = auth.uid() and role = 'creator' and consented_at is null;
  if not found and not public.is_project_creator(p_project_id) then
    raise exception 'You are not a creator of this project' using errcode = '42501';
  end if;
end $$;

-- Advisor consent: a creator stores the HASH of a freshly generated token.
create function public.issue_advisor_consent(p_project_id uuid, p_token_hash text, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_project_creator(p_project_id) then
    raise exception 'Only a creator can request advisor approval' using errcode = '42501';
  end if;
  if not public.project_is_editable(p_project_id) then
    raise exception 'This project can no longer be changed' using errcode = 'P0001';
  end if;
  update public.advisor_consents set status = 'withdrawn', decided_at = now()
    where project_id = p_project_id and status = 'pending';
  insert into public.advisor_consents (project_id, token_hash, expires_at)
    values (p_project_id, p_token_hash, p_expires_at) returning id into v_id;
  update public.projects set status = 'awaiting_advisor'
    where id = p_project_id and status = 'draft';
  return v_id;
end $$;

-- Advisor decision. Called ONLY by the server with the service role (see revoke below).
create function public.decide_advisor_consent(p_token_hash text, p_decision text, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.advisor_consents%rowtype; v_title text; r record;
begin
  select * into c from public.advisor_consents where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('ok', false, 'state', 'not_found'); end if;
  select title into v_title from public.projects where id = c.project_id;

  if p_decision = 'withdrawn' then
    if c.status <> 'approved' then
      return jsonb_build_object('ok', false, 'state', 'invalid');
    end if;
    update public.advisor_consents set status = 'withdrawn', comment = coalesce(nullif(p_comment, ''), comment), decided_at = now() where id = c.id;
    update public.projects set status = 'awaiting_advisor' where id = c.project_id and status = 'verifying';
    perform public.log_lineage(c.project_id, 'advisor_withdrawn', null, null, '{}'::jsonb);
    for r in select profile_id from public.project_members where project_id = c.project_id and role = 'creator' loop
      perform public.notify(r.profile_id, 'advisor_decision', jsonb_build_object('project_id', c.project_id, 'title', v_title, 'decision', 'withdrawn'));
    end loop;
    return jsonb_build_object('ok', true, 'state', 'withdrawn');
  end if;

  if c.status <> 'pending' then
    return jsonb_build_object('ok', false, 'state', 'decided', 'status', c.status);
  end if;
  if c.expires_at < now() then
    return jsonb_build_object('ok', false, 'state', 'expired');
  end if;
  if p_decision not in ('approved', 'declined') then
    return jsonb_build_object('ok', false, 'state', 'invalid');
  end if;

  update public.advisor_consents
    set status = p_decision::public.consent_status, comment = nullif(p_comment, ''), decided_at = now()
    where id = c.id;
  if p_decision = 'approved' then
    update public.projects set status = 'verifying' where id = c.project_id and status in ('draft', 'awaiting_advisor');
    perform public.log_lineage(c.project_id, 'advisor_approved', null, null, jsonb_build_object('comment', coalesce(p_comment, '')));
  end if;
  for r in select profile_id from public.project_members where project_id = c.project_id and role = 'creator' loop
    perform public.notify(r.profile_id, 'advisor_decision',
      jsonb_build_object('project_id', c.project_id, 'title', v_title, 'decision', p_decision, 'comment', coalesce(p_comment, '')));
  end loop;
  return jsonb_build_object('ok', true, 'state', p_decision);
end $$;

-- Publish rule: advisor approved, no pending items, at least one kept item, team confirmed, caller is a creator.
create function public.publish_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype;
begin
  select * into v from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.is_project_creator(p_project_id) then
    raise exception 'Only a creator can publish this project' using errcode = '42501';
  end if;
  if v.status in ('published', 'adopted', 'archived') then
    raise exception 'This project is already published' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.advisor_consents where project_id = p_project_id and status = 'approved') then
    raise exception 'Advisor approval is required before publishing' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.project_members where project_id = p_project_id and role = 'creator' and consented_at is null) then
    raise exception 'Every team member must confirm before publishing' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.draft_items where project_id = p_project_id and review_status = 'pending') then
    raise exception 'Review every drafted item before publishing' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.draft_items where project_id = p_project_id and review_status = 'kept') then
    raise exception 'Keep at least one item before publishing' using errcode = 'P0001';
  end if;
  update public.projects set status = 'published', published_at = now() where id = p_project_id;
  perform public.log_lineage(p_project_id, 'published', auth.uid(), null, '{}'::jsonb);
end $$;

-- Continuation request from an adopter team.
create function public.create_continuation_request(
  p_project_id uuid, p_team_name text, p_members jsonb, p_task_ids uuid[],
  p_plan text, p_purpose public.request_purpose, p_target_date date, p_fit_note text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype; v_id uuid; r record; v_count int;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v from public.projects where id = p_project_id;
  if not found or v.status <> 'published' then
    raise exception 'This project is not open for continuation requests' using errcode = 'P0001';
  end if;
  if public.is_project_creator(p_project_id) then
    raise exception 'Creators cannot request their own project' using errcode = '42501';
  end if;
  if exists (select 1 from public.continuation_requests
             where project_id = p_project_id and created_by = auth.uid() and status in ('pending', 'approved')) then
    raise exception 'Your team already has an open request for this project' using errcode = 'P0001';
  end if;
  select count(*) into v_count from public.draft_items
    where project_id = p_project_id and kind = 'next_task' and review_status = 'kept' and id = any (p_task_ids);
  if coalesce(array_length(p_task_ids, 1), 0) = 0 or v_count <> array_length(p_task_ids, 1) then
    raise exception 'Choose at least one verified task from this project' using errcode = 'P0001';
  end if;
  insert into public.continuation_requests
    (project_id, adopter_team_name, members, task_ids, plan, purpose, target_date, fit_note, created_by)
  values (p_project_id, p_team_name, coalesce(p_members, '[]'::jsonb), p_task_ids, p_plan, p_purpose, p_target_date, coalesce(p_fit_note, ''), auth.uid())
  returning id into v_id;
  perform public.log_lineage(p_project_id, 'requested', auth.uid(), v_id, jsonb_build_object('team', p_team_name));
  for r in select profile_id from public.project_members where project_id = p_project_id and role = 'creator' loop
    perform public.notify(r.profile_id, 'new_request', jsonb_build_object('project_id', p_project_id, 'request_id', v_id, 'title', v.title, 'team', p_team_name));
  end loop;
  return v_id;
end $$;

-- Creator decision. Only creators; approved or declined.
create function public.decide_request(p_request_id uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.continuation_requests%rowtype; v_title text;
begin
  select * into q from public.continuation_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if not public.is_project_creator(q.project_id) then
    raise exception 'Only a creator of this project can decide' using errcode = '42501';
  end if;
  if q.status <> 'pending' then
    raise exception 'This request was already decided' using errcode = 'P0001';
  end if;
  if p_decision not in ('approved', 'declined') then
    raise exception 'Unknown decision' using errcode = 'P0001';
  end if;
  select title into v_title from public.projects where id = q.project_id;
  update public.continuation_requests
    set status = p_decision::public.request_status, decision_note = nullif(p_note, ''), decided_by = auth.uid(), decided_at = now()
    where id = q.id;
  perform public.log_lineage(q.project_id, case when p_decision = 'approved' then 'approved' else 'declined' end::public.lineage_type,
    auth.uid(), q.id, jsonb_build_object('note', coalesce(p_note, '')));
  perform public.notify(q.created_by, 'request_decision',
    jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title, 'decision', p_decision, 'note', coalesce(p_note, '')));
end $$;

create function public.ask_request_question(p_request_id uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.continuation_requests%rowtype; v_title text;
begin
  select * into q from public.continuation_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if not public.is_project_creator(q.project_id) then
    raise exception 'Only a creator of this project can ask questions' using errcode = '42501';
  end if;
  if coalesce(trim(p_message), '') = '' then
    raise exception 'Write your question first' using errcode = 'P0001';
  end if;
  select title into v_title from public.projects where id = q.project_id;
  perform public.notify(q.created_by, 'request_question',
    jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title, 'message', p_message));
end $$;

create function public.withdraw_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q public.continuation_requests%rowtype;
begin
  select * into q from public.continuation_requests where id = p_request_id for update;
  if not found or q.created_by <> auth.uid() then
    raise exception 'Only the requester can withdraw a request' using errcode = '42501';
  end if;
  if q.status <> 'pending' then
    raise exception 'Only a pending request can be withdrawn' using errcode = 'P0001';
  end if;
  update public.continuation_requests set status = 'withdrawn' where id = q.id;
  perform public.log_lineage(q.project_id, 'declined', auth.uid(), q.id, jsonb_build_object('withdrawn', true));
end $$;

-- Accept the Attribution Agreement. When both sides have accepted, files unlock and the handover is logged.
create function public.accept_agreement(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q public.continuation_requests%rowtype; v_side public.agreement_side; was boolean; now_unlocked boolean;
  v_title text; r record;
begin
  select * into q from public.continuation_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if q.status <> 'approved' then
    raise exception 'The agreement opens after the creators approve the request' using errcode = 'P0001';
  end if;
  if public.is_project_creator(q.project_id) then v_side := 'creator';
  elsif public.is_request_team(q.id) then v_side := 'adopter';
  else raise exception 'You are not part of this request' using errcode = '42501';
  end if;
  select title into v_title from public.projects where id = q.project_id;

  was := public.request_unlocked(q.id);
  insert into public.agreement_acceptances (request_id, profile_id, side, agreement_version)
    values (q.id, auth.uid(), v_side, public.current_agreement_version())
    on conflict do nothing;
  now_unlocked := public.request_unlocked(q.id);

  if v_side = 'creator' then
    perform public.notify(q.created_by, 'agreement_accepted', jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title, 'side', 'creator'));
  else
    for r in select profile_id from public.project_members where project_id = q.project_id and role = 'creator' loop
      perform public.notify(r.profile_id, 'agreement_accepted', jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title, 'side', 'adopter'));
    end loop;
  end if;

  if now_unlocked and not was then
    update public.projects set status = 'adopted' where id = q.project_id and status = 'published';
    insert into public.project_members (project_id, profile_id, role, consented_at)
      values (q.project_id, q.created_by, 'adopter', now()) on conflict do nothing;
    perform public.log_lineage(q.project_id, 'agreement_signed', auth.uid(), q.id, jsonb_build_object('version', public.current_agreement_version()));
    perform public.log_lineage(q.project_id, 'continued', q.created_by, q.id, jsonb_build_object('team', q.adopter_team_name));
    perform public.notify(q.created_by, 'files_unlocked', jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title));
    for r in select profile_id from public.project_members where project_id = q.project_id and role = 'creator' loop
      perform public.notify(r.profile_id, 'files_unlocked', jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title));
    end loop;
  end if;
  return jsonb_build_object('side', v_side, 'unlocked', now_unlocked);
end $$;

-- Rate limiter backed by a table. Server-only (service role).
create function public.check_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from public.rate_limit_hits where created_at < now() - interval '1 day';
  select count(*) into v_count from public.rate_limit_hits
    where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then return false; end if;
  insert into public.rate_limit_hits (key) values (p_key);
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is callable by anon; mutations only by signed-in users.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function
  public.current_agreement_version(),
  public.is_project_creator(uuid), public.is_project_member(uuid), public.project_is_editable(uuid),
  public.is_request_team(uuid), public.can_see_request(uuid), public.request_unlocked(uuid),
  public.has_unlocked(uuid), public.can_read_private(uuid),
  public.add_team_member(uuid, text), public.remove_team_member(uuid, uuid), public.confirm_team_consent(uuid),
  public.issue_advisor_consent(uuid, text, timestamptz), public.publish_project(uuid),
  public.create_continuation_request(uuid, text, jsonb, uuid[], text, public.request_purpose, date, text),
  public.decide_request(uuid, text, text), public.ask_request_question(uuid, text),
  public.withdraw_request(uuid), public.accept_agreement(uuid)
to authenticated;
grant execute on function public.current_agreement_version() to anon;
-- Server-only: advisor decision and rate limiting (service role bypasses these grants).
grant execute on function public.decide_advisor_consent(text, text, text), public.check_rate_limit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled on every table
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.advisor_consents enable row level security;
alter table public.project_files enable row level security;
alter table public.synthesis_runs enable row level security;
alter table public.draft_items enable row level security;
alter table public.continuation_requests enable row level security;
alter table public.agreement_acceptances enable row level security;
alter table public.lineage_events enable row level security;
alter table public.notifications enable row level security;
alter table public.rate_limit_hits enable row level security;

-- profiles: readable by signed-in users (names are needed for credit lines); edit your own.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects: members read the full row; creators insert and edit basics while editable.
create policy projects_select_member on public.projects for select to authenticated
  using (created_by = auth.uid() or public.is_project_member(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (created_by = auth.uid());
create policy projects_update_creator on public.projects for update to authenticated
  using (public.is_project_creator(id) and public.project_is_editable(id))
  with check (public.is_project_creator(id));

-- project_members: see yourself and, as a creator, your team. Changes go through functions.
create policy members_select on public.project_members for select to authenticated
  using (profile_id = auth.uid() or public.is_project_creator(project_id));

-- advisor_consents: creators can see status (the token hash column is not granted, see below).
create policy consents_select on public.advisor_consents for select to authenticated
  using (public.is_project_creator(project_id));

-- project_files: creators, and adopters only after the unlock rule. Writes are server-side only.
create policy files_select on public.project_files for select to authenticated
  using (public.can_read_private(project_id));

create policy runs_select on public.synthesis_runs for select to authenticated
  using (public.is_project_creator(project_id));

-- draft_items: creators work on them while the project is editable; adopters read after unlock.
create policy items_select on public.draft_items for select to authenticated
  using (public.can_read_private(project_id));
create policy items_insert_creator on public.draft_items for insert to authenticated
  with check (public.is_project_creator(project_id) and public.project_is_editable(project_id) and origin = 'creator');
create policy items_update_creator on public.draft_items for update to authenticated
  using (public.is_project_creator(project_id) and public.project_is_editable(project_id))
  with check (public.is_project_creator(project_id));

-- continuation_requests and agreement acceptances: visible to both sides, written by functions.
create policy requests_select on public.continuation_requests for select to authenticated
  using (public.can_see_request(id));
create policy acceptances_select on public.agreement_acceptances for select to authenticated
  using (public.can_see_request(request_id));

-- lineage: members of the project and the requesting team can read; nobody writes directly.
create policy lineage_select on public.lineage_events for select to authenticated
  using (public.is_project_member(project_id) or (request_id is not null and public.can_see_request(request_id)));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Column-level privileges close the gaps RLS cannot express (status fields change only via functions).
revoke update on public.projects from authenticated;
grant update (title, summary, kind, field, year, stop_reason, advisor_name, advisor_email, stopped_note, tech)
  on public.projects to authenticated;
revoke update on public.draft_items from authenticated;
grant update (title, description, effort, lesson_type, objective_status, review_status, position)
  on public.draft_items to authenticated;
revoke insert on public.draft_items from authenticated;
grant insert (project_id, kind, title, description, effort, lesson_type, objective_status, evidence, evidence_status, origin, review_status, position)
  on public.draft_items to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke select on public.advisor_consents from authenticated;
grant select (id, project_id, status, comment, expires_at, decided_at, created_at) on public.advisor_consents to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, university, faculty, study_program, avatar_url) on public.profiles to authenticated;
revoke insert, delete, truncate on public.profiles, public.project_members, public.advisor_consents,
  public.project_files, public.synthesis_runs, public.continuation_requests, public.agreement_acceptances,
  public.lineage_events, public.notifications, public.rate_limit_hits from authenticated, anon;
revoke delete, truncate on public.projects, public.draft_items from authenticated, anon;
revoke all on public.rate_limit_hits from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Public teaser views (the only thing anonymous visitors can read)
-- ---------------------------------------------------------------------------
create view public.public_project_teaser as
select
  p.id, p.slug, p.title, p.summary, p.kind, p.field, p.year, p.stop_reason, p.status,
  p.advisor_name, p.is_demo, p.published_at, p.stopped_note, p.tech, p.team_size,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept')::int as objectives_total,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept' and i.objective_status = 'done')::int as objectives_done,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'next_task' and i.review_status = 'kept')::int as tasks_count
from public.projects p
where p.status in ('published', 'adopted');

-- Kept items of published projects. Evidence quotes are NOT exposed: only a source label.
create view public.public_teaser_items as
select
  i.id, i.project_id, i.kind, i.title, i.description, i.effort, i.lesson_type, i.objective_status, i.position,
  (
    select f.original_name || case when f.kind = 'markdown' then ', section ' else ', p.' end || (i.evidence -> 0 ->> 'page')
    from public.project_files f
    where f.id = nullif(i.evidence -> 0 ->> 'file_id', '')::uuid
  ) as source_label
from public.draft_items i
join public.projects p on p.id = i.project_id
where p.status in ('published', 'adopted') and i.review_status = 'kept';

create view public.public_project_lineage as
select e.id, e.project_id, e.type, e.created_at, (e.payload ->> 'team') as team
from public.lineage_events e
join public.projects p on p.id = e.project_id
where p.status in ('published', 'adopted') and e.type in ('created', 'published', 'continued');

grant select on public.public_project_teaser, public.public_teaser_items, public.public_project_lineage to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private buckets, no client policies (access only via server-issued signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('project-files', 'project-files', false, 52428800),
  ('extracted-text', 'extracted-text', false, 52428800)
on conflict (id) do update set public = false;

-- ===================== PART 2: ADMIN AREA =====================
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

-- ===================== PART 3: DEMO SEED (optional) =====================
-- ESTAFET demo seed. ALL data here is synthetic and labeled is_demo = true.
-- Names are fictional. Demo password for every demo account: Demo-Pass-2026!
-- Private files for the demo projects are uploaded by `pnpm seed:storage` (see README).

-- ---------------------------------------------------------------------------
-- Demo users (GoTrue-compatible rows). The on_auth_user_created trigger creates the profiles.
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in select * from (values
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'creator@estafet.demo', 'Demo Creator', 'Forestry', 'Forest Management'),
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'adopter@estafet.demo', 'Demo Adopter', 'Marine Science and Fisheries', 'Marine Science'),
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'alumni@estafet.demo', 'Demo Alumni', 'Engineering', 'Informatics')
  ) as t(id, email, full_name, faculty, program)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Demo-Pass-2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.full_name, 'faculty', u.faculty, 'study_program', u.program),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Demo projects. The creator owns 1, 7, 8. The alumni account owns 2 to 6.
-- ---------------------------------------------------------------------------
insert into public.projects
  (id, slug, title, summary, kind, field, year, stop_reason, status, advisor_name, advisor_email, created_by, is_demo, published_at, stopped_note, tech, team_size)
values
  ('b0000000-0000-4000-8000-000000000001', 'mangrove-cover-classifier', 'Mangrove Cover Classifier',
   'A model that classifies mangrove cover from drone images, meant to help coastal teams monitor change between seasons. The team built the data pipeline and a first baseline, then stopped after the first funding review.',
   'research', 'Forestry', 2025, 'funding_not_granted', 'published', 'Dr. Sari Demo (fictional)', 'advisor.demo@example.invalid',
   'c0000000-0000-4000-8000-000000000001', true, now() - interval '3 days',
   'Funding was not granted after the first review. Reviewers asked for a clearer sampling plan.',
   array['Python', 'Drone imagery', 'Image segmentation'], 3),
  ('b0000000-0000-4000-8000-000000000002', 'campus-waste-sorting-assistant', 'Campus Waste Sorting Assistant',
   'A phone app that suggests the right bin from a photo of an item.',
   'hackathon', 'Engineering', 2025, 'team_graduated', 'published', 'Dr. Budi Demo (fictional)', 'advisor.demo@example.invalid',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '12 days',
   'The core team graduated before the app could be tested with real campus bins.',
   array['Flutter', 'Image classification', 'TensorFlow Lite'], 4),
  ('b0000000-0000-4000-8000-000000000003', 'fish-freshness-indicator', 'Fish Freshness Indicator',
   'Estimates freshness from a smartphone photo of the fish eye.',
   'student_program', 'Marine Science and Fisheries', 2024, 'funding_not_granted', 'published', 'Dr. Laila Demo (fictional)', 'advisor.demo@example.invalid',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '20 days',
   'The program did not renew funding, so the field validation never happened.',
   array['Python', 'Color analysis', 'Smartphone photos'], 3),
  ('b0000000-0000-4000-8000-000000000004', 'village-clinic-queue-tracker', 'Village Clinic Queue Tracker',
   'Shows patients a live queue number for a community health post.',
   'student_program', 'Public Health', 2024, 'time_or_people', 'published', 'Dr. Hana Demo (fictional)', 'advisor.demo@example.invalid',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '25 days',
   'The team could not keep up with clinic visits and coursework at the same time.',
   array['Next.js', 'SMS gateway', 'Postgres'], 4),
  ('b0000000-0000-4000-8000-000000000005', 'study-group-matcher', 'Study Group Matcher',
   'Pairs students by course and free time slots.',
   'hackathon', 'Engineering', 2025, 'time_or_people', 'published', 'Dr. Budi Demo (fictional)', 'advisor.demo@example.invalid',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '30 days',
   'Only two of five teammates stayed after the hackathon weekend.',
   array['TypeScript', 'Constraint matching'], 5),
  ('b0000000-0000-4000-8000-000000000006', 'seaweed-drying-monitor', 'Seaweed Drying Monitor',
   'Sensor node that logs humidity and temperature on drying racks.',
   'research', 'Marine Science and Fisheries', 2024, 'team_graduated', 'published', 'Dr. Laila Demo (fictional)', 'advisor.demo@example.invalid',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '40 days',
   'The research team graduated before the second drying season.',
   array['ESP32', 'Humidity sensors', 'Data logging'], 3),
  ('b0000000-0000-4000-8000-000000000007', 'coral-reef-photo-counter', 'Coral Reef Photo Counter',
   'Counts coral colonies in reef photos to speed up survey work.',
   'research', 'Marine Science and Fisheries', 2025, 'funding_not_granted', 'verifying', 'Dr. Laila Demo (fictional)', 'advisor.demo@example.invalid',
   'c0000000-0000-4000-8000-000000000001', true, null,
   'The survey grant was not renewed after the first season.',
   array['Python', 'Object detection'], 3),
  ('b0000000-0000-4000-8000-000000000008', 'solar-dryer-controller', 'Solar Dryer Controller',
   'Controls vents on a solar dryer based on temperature and humidity.',
   'student_program', 'Engineering', 2024, 'team_graduated', 'awaiting_advisor', 'Dr. Budi Demo (fictional)', 'advisor.demo@example.invalid',
   'c0000000-0000-4000-8000-000000000001', true, null,
   '', array[]::text[], 3);

-- Team consent for projects that passed that step.
update public.project_members set consented_at = now()
  where project_id in (select id from public.projects where status <> 'draft');

-- ---------------------------------------------------------------------------
-- Private file records (objects are uploaded by `pnpm seed:storage`)
-- ---------------------------------------------------------------------------
insert into public.project_files (id, project_id, kind, storage_path, original_name, size_bytes, page_count, extracted_text_path, ingest_status, ingest_note, created_by)
select f.id, f.project_id, f.kind::public.file_kind,
       f.project_id || '/' || f.id || '-' || f.name,
       f.name, 0, f.pages, f.project_id || '/' || f.id || '.json', 'ready',
       case when f.kind = 'pdf' then 'Text extracted from ' || f.pages || ' pages.' else 'Parsed ' || f.pages || ' sections.' end,
       p.created_by
from (values
  ('f0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'pdf', 'proposal.pdf', 18),
  ('f0000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'pdf', 'review-feedback.pdf', 3),
  ('f0000000-0000-4000-8000-000000000003'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'pdf', 'report.pdf', 14),
  ('f0000000-0000-4000-8000-000000000004'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'markdown', 'notes.md', 5),
  ('f0000000-0000-4000-8000-000000000011'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000012'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000021'::uuid, 'b0000000-0000-4000-8000-000000000003'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000022'::uuid, 'b0000000-0000-4000-8000-000000000003'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000031'::uuid, 'b0000000-0000-4000-8000-000000000004'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000032'::uuid, 'b0000000-0000-4000-8000-000000000004'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000041'::uuid, 'b0000000-0000-4000-8000-000000000005'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000042'::uuid, 'b0000000-0000-4000-8000-000000000005'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000051'::uuid, 'b0000000-0000-4000-8000-000000000006'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000052'::uuid, 'b0000000-0000-4000-8000-000000000006'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000061'::uuid, 'b0000000-0000-4000-8000-000000000007'::uuid, 'pdf', 'survey-report.pdf', 12),
  ('f0000000-0000-4000-8000-000000000062'::uuid, 'b0000000-0000-4000-8000-000000000007'::uuid, 'markdown', 'field-notes.md', 5)
) as f(id, project_id, kind, name, pages)
join public.projects p on p.id = f.project_id;

-- ---------------------------------------------------------------------------
-- Drafted items with evidence. `ev` = matched | not_found. The seed-storage script writes each
-- matched quote into the cited page, so the evidence checker finds it (verified by `pnpm seed:verify`).
-- ---------------------------------------------------------------------------
create temp table _seed_items (
  slug text, kind text, title text, descr text, effort text, lesson text, obj text,
  fname text, page int, quote text, ev text, review text, ord int
);

insert into _seed_items values
-- Mangrove Cover Classifier (published): 5 objectives, 2 completed, 4 next tasks, 3 lessons
('mangrove-cover-classifier','objective','Collect drone imagery of two coastal sites','','','','done','proposal.pdf',4,'Drone imagery will be collected at two coastal sites during the dry season.','matched','kept',1),
('mangrove-cover-classifier','objective','Label a first image set','','','','done','notes.md',3,'Labeled so far: canopy, water, bare mud.','matched','kept',2),
('mangrove-cover-classifier','objective','Train a baseline segmentation model','','','','done','report.pdf',8,'A baseline segmentation model reached 0.81 mean accuracy on the test split.','matched','kept',3),
('mangrove-cover-classifier','objective','Validate on a held-out site','','','','not_started','proposal.pdf',7,'The model will be validated on a held-out site not seen during training.','matched','kept',4),
('mangrove-cover-classifier','objective','Write a monitoring guide for field staff','','','','not_started','proposal.pdf',9,'A short monitoring guide for field staff will be produced in the final month.','matched','kept',5),
('mangrove-cover-classifier','completed','Drone image data pipeline','Imagery is tiled, cleaned and versioned by flight date.','','','','report.pdf',5,'Every flight is tiled into 512 pixel patches and stored with its flight date.','matched','kept',6),
('mangrove-cover-classifier','completed','First baseline model','A segmentation baseline with a documented training recipe.','','','','report.pdf',8,'A baseline segmentation model reached 0.81 mean accuracy on the test split.','matched','kept',7),
('mangrove-cover-classifier','next_task','Write a sampling plan that justifies the site choice','Reviewers said the choice of sites was not justified.','small','','','review-feedback.pdf',2,'The choice of the two coastal sites is not justified against the wider region.','matched','kept',8),
('mangrove-cover-classifier','next_task','Label more images for the mangrove edge class','The edge class had the fewest labels and the weakest results.','medium','','','notes.md',3,'TODO: edge class needs far more labeled images before results mean anything.','matched','kept',9),
('mangrove-cover-classifier','next_task','Re-run the baseline with a split by site','The first split mixed images from the same site across train and test.','medium','','','report.pdf',12,'Images from the same site appear in both the training and test sets.','matched','kept',10),
('mangrove-cover-classifier','next_task','Draft the monitoring guide for field staff','Planned in the proposal but not started.','large','','','proposal.pdf',9,'A short monitoring guide for field staff will be produced in the final month.','matched','kept',11),
('mangrove-cover-classifier','lesson','Splitting by site, not by image, gives a more honest accuracy estimate.','','','methodology','','report.pdf',12,'A split by site would give a more honest estimate of generalization.','matched','kept',12),
('mangrove-cover-classifier','lesson','The sampling plan needs to explain why these sites represent the region.','','','evaluation_feedback','','review-feedback.pdf',2,'The choice of the two coastal sites is not justified against the wider region.','matched','kept',13),
('mangrove-cover-classifier','lesson','Flight permits delayed the second site by several weeks.','','','blocker','','report.pdf',6,'Flight permits for the second site arrived six weeks later than planned.','matched','kept',14),

-- Campus Waste Sorting Assistant: 2 of 5 objectives done, 5 tasks
('campus-waste-sorting-assistant','objective','Collect photos of common campus waste','','','','done','final-report.pdf',3,'We collected 1,200 photos of items found in campus bins.','matched','kept',1),
('campus-waste-sorting-assistant','objective','Train an item classifier','','','','done','final-report.pdf',5,'The classifier reaches 74 percent accuracy on five bin categories.','matched','kept',2),
('campus-waste-sorting-assistant','objective','Package the model for phones','','','','not_started','final-report.pdf',6,'The model still has to be converted to a mobile format.','matched','kept',3),
('campus-waste-sorting-assistant','objective','Test with students at three bins','','','','not_started','notes.md',2,'Plan a test with students at three bins near the canteen.','matched','kept',4),
('campus-waste-sorting-assistant','objective','Add Bahasa Indonesia labels','','','','not_started','notes.md',3,'Bin labels should be shown in Bahasa Indonesia and English.','matched','kept',5),
('campus-waste-sorting-assistant','next_task','Convert the classifier to TensorFlow Lite','Needed before any phone test.','medium','','','final-report.pdf',6,'The model still has to be converted to a mobile format.','matched','kept',6),
('campus-waste-sorting-assistant','next_task','Collect photos of mixed and dirty items','The classifier struggles with food-stained packaging.','medium','','','final-report.pdf',7,'Food-stained packaging is misclassified most often.','matched','kept',7),
('campus-waste-sorting-assistant','next_task','Agree bin categories with campus services','Categories were chosen without the cleaning team.','small','','','notes.md',2,'Check bin categories with the campus cleaning team.','matched','kept',8),
('campus-waste-sorting-assistant','next_task','Run a three-bin usability test','No real user has used the prototype yet.','large','','','notes.md',2,'Plan a test with students at three bins near the canteen.','matched','kept',9),
('campus-waste-sorting-assistant','next_task','Design the bilingual result screen','Labels are English only.','small','','','notes.md',3,'Bin labels should be shown in Bahasa Indonesia and English.','matched','kept',10),
('campus-waste-sorting-assistant','lesson','Photos taken in real bins differ a lot from clean test photos.','','','methodology','','final-report.pdf',7,'Accuracy dropped to 58 percent on photos taken inside real bins.','matched','kept',11),
('campus-waste-sorting-assistant','lesson','The team graduated before the app could be tested.','','','blocker','','final-report.pdf',9,'Three of four members graduated before the testing phase.','matched','kept',12),

-- Fish Freshness Indicator: 3 of 4 objectives done, 3 tasks
('fish-freshness-indicator','objective','Collect labeled eye photos','','','','done','final-report.pdf',3,'A set of 640 labeled fish eye photos was collected over six weeks.','matched','kept',1),
('fish-freshness-indicator','objective','Build a color-based freshness score','','','','done','final-report.pdf',5,'The freshness score is computed from pupil clarity and cornea color.','matched','kept',2),
('fish-freshness-indicator','objective','Compare the score with a lab reference','','','','done','final-report.pdf',6,'The score agrees with the lab reference in 82 percent of samples.','matched','kept',3),
('fish-freshness-indicator','objective','Validate at a fish market','','','','not_started','notes.md',3,'Validation at the Paotere market was planned but never started.','matched','kept',4),
('fish-freshness-indicator','next_task','Run the field validation at a fish market','The lab agreement was never tested in the field.','large','','','notes.md',3,'Validation at the Paotere market was planned but never started.','matched','kept',5),
('fish-freshness-indicator','next_task','Handle different lighting conditions','Outdoor light changed the color score.','medium','','','final-report.pdf',7,'Strong sunlight shifts the cornea color score by up to 12 percent.','matched','kept',6),
('fish-freshness-indicator','next_task','Add species-specific thresholds','Only two species were covered.','medium','','','final-report.pdf',8,'Thresholds were calibrated for only two fish species.','matched','kept',7),
('fish-freshness-indicator','lesson','Lab agreement does not guarantee field accuracy.','','','methodology','','final-report.pdf',7,'Strong sunlight shifts the cornea color score by up to 12 percent.','matched','kept',8),
('fish-freshness-indicator','lesson','Funding reviewers wanted a field validation plan.','','','funding_feedback','','notes.md',2,'The panel asked for a field validation plan before renewing.','matched','kept',9),

-- Village Clinic Queue Tracker: 2 of 4 objectives done, 4 tasks
('village-clinic-queue-tracker','objective','Interview clinic staff about the queue','','','','done','final-report.pdf',3,'We interviewed six staff members at two village health posts.','matched','kept',1),
('village-clinic-queue-tracker','objective','Build a queue number prototype','','','','done','final-report.pdf',5,'Patients receive a queue number by SMS when they register.','matched','kept',2),
('village-clinic-queue-tracker','objective','Show live status on a waiting-room screen','','','','not_started','final-report.pdf',6,'The waiting-room display is designed but not built.','matched','kept',3),
('village-clinic-queue-tracker','objective','Pilot for two weeks at one clinic','','','','not_started','notes.md',3,'A two week pilot at one clinic was the next milestone.','matched','kept',4),
('village-clinic-queue-tracker','next_task','Build the waiting-room display','Design is done, code is not.','medium','','','final-report.pdf',6,'The waiting-room display is designed but not built.','matched','kept',5),
('village-clinic-queue-tracker','next_task','Handle patients without a phone','Some elderly patients have no phone.','medium','','','notes.md',2,'Elderly patients without phones need a paper queue number.','matched','kept',6),
('village-clinic-queue-tracker','next_task','Choose an SMS provider with local pricing','The prototype used a paid sandbox.','small','','','final-report.pdf',7,'SMS costs must be checked against the clinic budget.','matched','kept',7),
('village-clinic-queue-tracker','next_task','Run a two-week pilot','No real clinic has used it yet.','large','','','notes.md',3,'A two week pilot at one clinic was the next milestone.','matched','kept',8),
('village-clinic-queue-tracker','lesson','Staff care more about fewer questions than a fancy screen.','','','methodology','','final-report.pdf',4,'Staff asked for fewer repeat questions, not a new screen.','matched','kept',9),
('village-clinic-queue-tracker','lesson','Coursework peaks clashed with clinic visit days.','','','blocker','','notes.md',4,'Clinic visits were only possible on weekday mornings.','matched','kept',10),

-- Study Group Matcher: 1 of 3 objectives done, 6 tasks
('study-group-matcher','objective','Collect course and schedule data','','','','done','final-report.pdf',3,'The prototype imports course lists and free time slots from a form.','matched','kept',1),
('study-group-matcher','objective','Match students into groups of four','','','','in_progress','final-report.pdf',5,'The matching works for pairs but not yet for groups of four.','matched','kept',2),
('study-group-matcher','objective','Let students swap groups','','','','not_started','notes.md',2,'Swapping groups after the first match is not designed yet.','matched','kept',3),
('study-group-matcher','next_task','Extend matching from pairs to groups of four','The core algorithm only handles pairs.','large','','','final-report.pdf',5,'The matching works for pairs but not yet for groups of four.','matched','kept',4),
('study-group-matcher','next_task','Design the swap flow','Students may want a different group.','medium','','','notes.md',2,'Swapping groups after the first match is not designed yet.','matched','kept',5),
('study-group-matcher','next_task','Add course-level privacy settings','Names are visible to everyone in a course.','medium','','','final-report.pdf',7,'Student names are visible to everyone in the same course.','matched','kept',6),
('study-group-matcher','next_task','Import timetables from the campus system','Students enter slots by hand today.','large','','','notes.md',3,'Typing free slots by hand takes about ten minutes per student.','matched','kept',7),
('study-group-matcher','next_task','Test with one real course','Only synthetic data was used.','small','','','final-report.pdf',8,'All results come from synthetic student data.','matched','kept',8),
('study-group-matcher','next_task','Write a short onboarding guide','New users could not find the form.','small','','','notes.md',4,'Three testers could not find the schedule form.','matched','kept',9),
('study-group-matcher','lesson','Hackathon scope was too big for a two-person remainder.','','','blocker','','final-report.pdf',9,'Only two of five teammates stayed after the hackathon weekend.','matched','kept',10),
('study-group-matcher','lesson','Test with real schedules early.','','','methodology','','final-report.pdf',8,'All results come from synthetic student data.','matched','kept',11),

-- Seaweed Drying Monitor: 2 of 3 objectives done, 3 tasks
('seaweed-drying-monitor','objective','Build a humidity and temperature sensor node','','','','done','final-report.pdf',3,'The ESP32 node logs humidity and temperature every five minutes.','matched','kept',1),
('seaweed-drying-monitor','objective','Test the node on drying racks for one season','','','','done','final-report.pdf',5,'The node ran for 41 days on two drying racks.','matched','kept',2),
('seaweed-drying-monitor','objective','Predict drying time from the logs','','','','not_started','notes.md',3,'A drying time model was planned for the second season.','matched','kept',3),
('seaweed-drying-monitor','next_task','Build a drying time model','The first season produced the data but no model.','large','','','notes.md',3,'A drying time model was planned for the second season.','matched','kept',4),
('seaweed-drying-monitor','next_task','Waterproof the sensor housing','Two nodes failed after heavy rain.','medium','','','final-report.pdf',6,'Two nodes failed after heavy rain.','matched','kept',5),
('seaweed-drying-monitor','next_task','Compare readings with a reference sensor','Accuracy was never checked.','small','','','final-report.pdf',7,'Sensor accuracy was not compared with a reference device.','matched','kept',6),
('seaweed-drying-monitor','lesson','Salt air corrodes cheap connectors within weeks.','','','methodology','','final-report.pdf',6,'Salt air corroded the cheap connectors within a few weeks.','matched','kept',7),
('seaweed-drying-monitor','lesson','The team graduated before the second season.','','','blocker','','notes.md',4,'Every team member graduated before the second drying season.','matched','kept',8),

-- Coral Reef Photo Counter (verifying): 6 items, 4 reviewed, one deliberately unsupported
('coral-reef-photo-counter','next_task','Add a second annotator to check label agreement','Only one person labeled the images.','small','','','field-notes.md',3,'Only one person annotated the images, so agreement is unknown.','matched','kept',1),
('coral-reef-photo-counter','next_task','Collect photos from a second reef site','All photos come from one reef.','medium','','','survey-report.pdf',5,'All photos come from a single reef near the pier.','matched','kept',2),
('coral-reef-photo-counter','next_task','Re-train with a split by dive date','Photos from the same dive were split across train and test.','medium','','','survey-report.pdf',9,'Photos from the same dive appear in both training and test sets.','matched','kept',3),
('coral-reef-photo-counter','next_task','Write a field protocol for photo angle and distance','Photo quality varies by diver.','large','','','field-notes.md',4,'A short field protocol for camera angle and distance is still missing.','matched','removed',4),
('coral-reef-photo-counter','next_task','Deploy the counter as a mobile app','Mentioned as a future idea.','large','','','survey-report.pdf',11,'The counter will run on a phone in the field.','not_found','pending',5),
('coral-reef-photo-counter','lesson','Photos taken close to the reef count more reliably','','','methodology','','survey-report.pdf',7,'Counts were most reliable when the camera stayed within one metre of the reef.','matched','pending',6);

insert into public.draft_items
  (id, project_id, kind, title, description, effort, lesson_type, objective_status, evidence, evidence_status, origin, review_status, position)
select
  md5(s.slug || ':' || s.ord)::uuid, p.id, s.kind::public.item_kind, s.title, s.descr,
  nullif(s.effort, '')::public.effort, nullif(s.lesson, '')::public.lesson_type, nullif(s.obj, ''),
  jsonb_build_array(jsonb_build_object('file_id', f.id, 'page', s.page, 'quote', s.quote)),
  s.ev::public.evidence_status, 'ai', s.review::public.review_status, s.ord
from _seed_items s
join public.projects p on p.slug = s.slug
join public.project_files f on f.project_id = p.id and f.original_name = s.fname;

-- ---------------------------------------------------------------------------
-- Advisor consents. Published and verifying projects are approved.
-- The Solar Dryer project has a pending consent with a known DEMO token: demo-advisor-token-solar
-- ---------------------------------------------------------------------------
insert into public.advisor_consents (project_id, token_hash, status, comment, expires_at, decided_at)
select id, encode(extensions.digest('demo-approved-' || slug, 'sha256'), 'hex'), 'approved',
       'Happy to see this continue (demo).', now() + interval '14 days', now() - interval '2 days'
from public.projects where status in ('published', 'verifying');

insert into public.advisor_consents (project_id, token_hash, status, expires_at)
select id, encode(extensions.digest('demo-advisor-token-solar', 'sha256'), 'hex'), 'pending', now() + interval '14 days'
from public.projects where slug = 'solar-dryer-controller';

-- ---------------------------------------------------------------------------
-- Lineage for published projects (created is logged by the insert trigger)
-- ---------------------------------------------------------------------------
select public.log_lineage(id, 'advisor_approved', null, null, '{}'::jsonb) from public.projects where status in ('published', 'verifying');
select public.log_lineage(id, 'published', created_by, null, '{}'::jsonb) from public.projects where status = 'published';

-- ---------------------------------------------------------------------------
-- Two pending continuation requests from the demo adopter team
-- ---------------------------------------------------------------------------
insert into public.continuation_requests
  (id, project_id, adopter_team_name, members, task_ids, plan, purpose, target_date, fit_note, created_by)
values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Team Laut Biru',
   '[{"email":"member2@estafet.demo"},{"email":"member3@estafet.demo"}]'::jsonb,
   array(select id from public.draft_items where project_id = 'b0000000-0000-4000-8000-000000000001'
         and title in ('Re-run the baseline with a split by site', 'Write a sampling plan that justifies the site choice')),
   'We will first redo the evaluation with a site-based split, then write the sampling plan using the survey notes from the proposal. We expect a revised report we can build a competition entry on.',
   'competition', current_date + 60,
   'Two of us took remote sensing and one has built segmentation models before (demo).',
   'a0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'Team Laut Biru',
   '[{"email":"member2@estafet.demo"},{"email":"member3@estafet.demo"}]'::jsonb,
   array(select id from public.draft_items where project_id = 'b0000000-0000-4000-8000-000000000003'
         and title in ('Run the field validation at a fish market')),
   'We will take the lab-validated score to the fish market in our first month and compare it with trader judgement.',
   'competition', current_date + 45,
   'We study fisheries and have access to the market (demo).',
   'a0000000-0000-4000-8000-000000000001');

select public.log_lineage(project_id, 'requested', created_by, id, jsonb_build_object('team', adopter_team_name))
from public.continuation_requests;

insert into public.notifications (user_id, type, payload) values
  ('c0000000-0000-4000-8000-000000000001', 'new_request',
   '{"project_id":"b0000000-0000-4000-8000-000000000001","request_id":"e0000000-0000-4000-8000-000000000001","title":"Mangrove Cover Classifier","team":"Team Laut Biru"}'),
  ('c0000000-0000-4000-8000-000000000001', 'advisor_decision',
   '{"project_id":"b0000000-0000-4000-8000-000000000007","title":"Coral Reef Photo Counter","decision":"approved","comment":"Happy to see this continue (demo)."}');

-- Fictional profile details
update public.profiles set university = 'Universitas Hasanuddin (demo)';

-- ---------------------------------------------------------------------------
-- Admin demo data. ALL of it is labeled is_demo or belongs to demo projects.
-- The demo admin account itself is created by `pnpm seed:admin` and only when SEED_DEMO=true.
-- ---------------------------------------------------------------------------
-- One open demo report so the moderation queue is not empty.
insert into public.reports (project_id, reason, details)
select id, 'inaccurate', 'Demo report: the summary may overstate how far the classifier got. (Simulated, for the admin demo.)'
from public.projects where slug = 'fish-freshness-indicator';

-- Illustrative DEMO trial sessions (pseudonym codes only). They are excluded from metrics by default and are not results.
insert into public.trial_sessions
  (participant_code, cohort, project_id, started_at, minutes_to_understand, completed, correct_answers, total_questions, sus_score, notes, consent_confirmed, is_demo)
select v.code, v.cohort::public.trial_cohort, p.id, now() - (v.days || ' days')::interval, v.minutes, v.done, v.correct, 5, v.sus,
       'Demo row, not a real session.', true, true
from (values
  ('D01','baseline',9,46.0,true,3,null::numeric), ('D02','baseline',9,52.0,true,2,null), ('D03','baseline',8,61.0,false,2,null),
  ('D04','baseline',8,38.0,true,4,null), ('D05','baseline',7,55.0,true,3,null), ('D06','baseline',7,49.0,true,3,null),
  ('D07','estafet',6,24.0,true,4,78.0), ('D08','estafet',6,31.0,true,4,72.5), ('D09','estafet',5,27.0,true,5,80.0), ('D10','estafet',5,36.0,false,3,65.0)
) as v(code, cohort, days, minutes, done, correct, sus)
cross join (select id from public.projects where slug = 'mangrove-cover-classifier') p;
