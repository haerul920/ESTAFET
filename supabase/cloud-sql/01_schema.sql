-- ESTAFET database, step 01 of 9: schema.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 00 succeeded.
-- Generated from supabase/migrations/20261119000001_schema.sql. Do not edit by hand.

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
