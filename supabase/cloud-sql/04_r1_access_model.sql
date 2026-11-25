-- ESTAFET database, step 04 of 26: r1_access_model.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 03 succeeded.
-- Generated from supabase/migrations/20261121000002_r1_access_model.sql. Do not edit by hand.

-- R1 (part 2 of 2): one account type, per-project relationships, the access model, policy acceptance.
-- CLAUDE.md section 14.3, 14.4, 14.5. Plan and rollback notes: docs/migrations-r1.md.
--
-- What changes:
--   project_members.role  creator/adopter  ->  owner/co_owner (+ status invited/active/left)
--   adopters              project_members rows -> project_access rows (one per person who accepted the agreement)
--   projects.status       draft/awaiting_advisor/verifying/published/adopted/archived -> draft/published/unpublished/archived
--   projects              + access_mode, max_active_adopters, advisor_mode, no_advisor_declared_at, unpublished_at
--   continuation_requests + expires_at (status 'expired' was added in the previous migration)
--   new                   project_access, policies, policy_acceptances
-- Nothing is dropped before its data is copied. Pre-change copies live in schema r1_backup (not exposed by the API).

-- ---------------------------------------------------------------------------
-- 0. Backup copies and dependent objects
-- ---------------------------------------------------------------------------
create schema if not exists r1_backup;
revoke all on schema r1_backup from public, anon, authenticated;
create table r1_backup.project_members as
  select project_id, profile_id, role::text as role, consented_at, created_at, updated_at from public.project_members;
create table r1_backup.projects_status as select id, status::text as status from public.projects;
create table r1_backup.agreement_acceptances as
  select id, request_id, profile_id, side::text as side, agreement_version, accepted_at from public.agreement_acceptances;
create table r1_backup.continuation_requests as select id, status::text as status from public.continuation_requests;

-- Views that read columns or types that change. They are re-created at the end of this file.
drop view if exists public.public_project_teaser, public.public_teaser_items, public.public_project_lineage;
drop view if exists public.admin_projects_v, public.admin_users_v, public.admin_requests_v;

-- Policies that call functions which are replaced or removed. They are re-created below.
drop policy if exists projects_select_member on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update_creator on public.projects;
drop policy if exists members_select on public.project_members;
drop policy if exists consents_select on public.advisor_consents;
drop policy if exists files_select on public.project_files;
drop policy if exists runs_select on public.synthesis_runs;
drop policy if exists items_select on public.draft_items;
drop policy if exists items_insert_creator on public.draft_items;
drop policy if exists items_update_creator on public.draft_items;
drop policy if exists requests_select on public.continuation_requests;
drop policy if exists acceptances_select on public.agreement_acceptances;
drop policy if exists lineage_select on public.lineage_events;

-- ---------------------------------------------------------------------------
-- 1. New types
-- ---------------------------------------------------------------------------
create type public.project_status_v2 as enum ('draft', 'published', 'unpublished', 'archived');
create type public.project_member_role as enum ('owner', 'co_owner');
create type public.member_status as enum ('invited', 'active', 'left');
create type public.access_mode as enum ('open', 'by_request', 'paused');
create type public.access_source as enum ('open', 'approved_request');
create type public.access_status as enum ('active', 'revoked');
create type public.advisor_mode as enum ('advisor', 'none');
create type public.policy_kind as enum ('terms', 'privacy');

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------
create table public.project_access (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source public.access_source not null,
  status public.access_status not null default 'active',
  agreement_version int not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  revoked_reason text,
  request_id uuid references public.continuation_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index project_access_one_active on public.project_access (project_id, profile_id) where status = 'active';
create index project_access_project_idx on public.project_access (project_id, status);
create index project_access_profile_idx on public.project_access (profile_id, status);
create index project_access_request_idx on public.project_access (request_id);
create trigger project_access_touch before update on public.project_access for each row execute function public.touch_updated_at();

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  kind public.policy_kind not null,
  version int not null check (version > 0),
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (kind, version)
);

create table public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.policy_kind not null,
  version int not null,
  accepted_at timestamptz not null default now(),
  unique (profile_id, kind, version)
);
create index policy_acceptances_profile_idx on public.policy_acceptances (profile_id);

-- Version 1 of each policy. The text itself ships in phase R5 and is marked as a draft there.
insert into public.policies (kind, version) values ('terms', 1), ('privacy', 1);

-- ---------------------------------------------------------------------------
-- 3. Copy adopters into project_access (one row per person who accepted the agreement for an unlocked request)
-- ---------------------------------------------------------------------------
insert into public.project_access (project_id, profile_id, source, status, agreement_version, accepted_at, request_id)
select r.project_id, a.profile_id, 'approved_request', 'active', a.agreement_version, a.accepted_at, r.id
from public.continuation_requests r
join public.agreement_acceptances a on a.request_id = r.id and a.side = 'adopter'
where public.request_unlocked(r.id)
  and a.agreement_version = public.current_agreement_version()
on conflict (project_id, profile_id) where status = 'active' do nothing;

-- ---------------------------------------------------------------------------
-- 4. project_members: owner / co_owner with an invitation status
-- ---------------------------------------------------------------------------
alter table public.project_members
  add column role_v2 public.project_member_role,
  add column status public.member_status not null default 'active',
  add column invited_by uuid references public.profiles (id),
  add column invited_at timestamptz,
  add column responded_at timestamptz;

update public.project_members m
set role_v2 = (case when m.profile_id = p.created_by then 'owner' else 'co_owner' end)::public.project_member_role
from public.projects p
where p.id = m.project_id and m.role = 'creator';

delete from public.project_members where role = 'adopter';

-- Safety net: a project must always have an owner row.
insert into public.project_members (project_id, profile_id, role_v2, status)
select p.id, p.created_by, 'owner', 'active'
from public.projects p
where not exists (select 1 from public.project_members m where m.project_id = p.id and m.role_v2 = 'owner')
on conflict (project_id, profile_id) do update set role_v2 = 'owner', status = 'active';

alter table public.project_members alter column role_v2 set not null;
alter table public.project_members drop column role;
alter table public.project_members rename column role_v2 to role;
drop type public.member_role;

-- ---------------------------------------------------------------------------
-- 5. projects: lifecycle status, access settings, advisor path
-- ---------------------------------------------------------------------------
alter table public.projects alter column status drop default;
alter table public.projects alter column status type public.project_status_v2
  using (case status::text
           when 'awaiting_advisor' then 'draft'
           when 'verifying' then 'draft'
           when 'adopted' then 'published'
           else status::text
         end)::public.project_status_v2;
drop type public.project_status;
alter type public.project_status_v2 rename to project_status;
alter table public.projects alter column status set default 'draft';

alter table public.projects
  add column access_mode public.access_mode not null default 'by_request',
  add column max_active_adopters int default 3 check (max_active_adopters is null or max_active_adopters in (1, 3)),
  add column advisor_mode public.advisor_mode not null default 'advisor',
  add column no_advisor_declared_at timestamptz,
  add column unpublished_at timestamptz;
comment on column public.projects.max_active_adopters is 'Active adopter teams allowed at once: 1, 3 (default) or NULL for unlimited.';

-- ---------------------------------------------------------------------------
-- 6. Requests expire
-- ---------------------------------------------------------------------------
alter table public.continuation_requests add column expires_at timestamptz;
-- Existing pending requests get a fresh window so nothing expires the moment this ships.
update public.continuation_requests set expires_at = now() + interval '30 days' where status = 'pending';

-- ---------------------------------------------------------------------------
-- 7. Remove functions that disappear
-- ---------------------------------------------------------------------------
drop function public.is_project_creator(uuid);
drop function public.is_project_member(uuid);
drop function public.request_unlocked(uuid);
drop function public.has_unlocked(uuid);
drop function public.add_team_member(uuid, text);

-- ---------------------------------------------------------------------------
-- 8. Relationship helpers (authorization depends on relationships, never on an account type)
-- ---------------------------------------------------------------------------
create function public.is_verified() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select u.email_confirmed_at is not null from auth.users u where u.id = auth.uid()), false)
$$;

create function public.assert_verified() returns void
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501', hint = 'sign_in';
  end if;
  if not public.is_verified() then
    raise exception 'Verify your email address first' using errcode = '42501', hint = 'email_unverified';
  end if;
end $$;

-- An active member of the project (owner or co-owner). Invited people are not members yet.
create function public.is_project_owner(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and profile_id = auth.uid() and status = 'active'
  )
$$;

create or replace function public.project_is_editable(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = pid and status in ('draft', 'unpublished'))
$$;

create function public.has_access(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_access
    where project_id = pid and profile_id = auth.uid() and status = 'active'
  )
$$;

create or replace function public.can_read_private(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_project_owner(pid) or public.has_access(pid)
$$;

create or replace function public.is_request_team(rid uuid) returns boolean
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

create or replace function public.can_see_request(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_request_team(rid) or exists (
    select 1 from public.continuation_requests r
    where r.id = rid and public.is_project_owner(r.project_id)
  )
$$;

-- Active adopter TEAMS: people who came in through the same request count once, an open-mode person counts once.
create function public.active_adopter_count(pid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct coalesce(request_id::text, id::text))::int
  from public.project_access where project_id = pid and status = 'active'
$$;

create function public.quota_available(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.max_active_adopters is null or public.active_adopter_count(p.id) < p.max_active_adopters
    from public.projects p where p.id = pid
  ), false)
$$;

-- Integer setting from app_settings with a default (request expiry, re-apply cooldown).
create function public.setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (s.value #>> '{}')::int from public.app_settings s where s.key = p_key and jsonb_typeof(s.value) = 'number'), p_default)
$$;

create function public.refresh_team_size(pid uuid) returns void
language sql security definer set search_path = public as $$
  update public.projects p
  set team_size = greatest(1, least(12, (select count(*) from public.project_members m where m.project_id = p.id and m.status = 'active')))
  where p.id = pid
$$;

-- Policies (terms and privacy), versioned.
create function public.current_policy_version(p_kind public.policy_kind) returns int
language sql stable security definer set search_path = public as $$
  select max(version) from public.policies where kind = p_kind and effective_at <= now()
$$;

create function public.has_current_policies(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from (select distinct kind from public.policies) k
    where not exists (
      select 1 from public.policy_acceptances a
      where a.profile_id = uid and a.kind = k.kind and a.version = public.current_policy_version(k.kind)
    )
  )
$$;

create function public.i_accepted_current_policies() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_current_policies(auth.uid())
$$;

create function public.accept_current_policies() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501', hint = 'sign_in'; end if;
  insert into public.policy_acceptances (profile_id, kind, version)
  select auth.uid(), k.kind, public.current_policy_version(k.kind) from (select distinct kind from public.policies) k
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Triggers
-- ---------------------------------------------------------------------------
create or replace function public.projects_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, profile_id, role, status)
  values (new.id, new.created_by, 'owner', 'active')
  on conflict do nothing;
  perform public.log_lineage(new.id, 'created', new.created_by, null, jsonb_build_object('title', new.title));
  return new;
end $$;

create trigger project_access_suspended before insert or update on public.project_access
  for each row execute function public.block_suspended_actor();

-- ---------------------------------------------------------------------------
-- 10. Team: co-owner invitations
-- ---------------------------------------------------------------------------
create function public.invite_co_owner(p_project_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid; v_title text; m public.project_members%rowtype;
begin
  perform public.assert_verified();
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can invite co-owners' using errcode = '42501', hint = 'not_owner';
  end if;
  if not public.project_is_editable(p_project_id) then
    raise exception 'This project can no longer be changed' using errcode = 'P0001', hint = 'not_editable';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No ESTAFET account uses that email yet. Ask them to sign up first.' using errcode = 'P0002', hint = 'no_account';
  end if;
  if v_user = auth.uid() then
    raise exception 'You are already on this project' using errcode = 'P0001', hint = 'already_member';
  end if;
  select * into m from public.project_members where project_id = p_project_id and profile_id = v_user;
  if found and m.status = 'active' then
    raise exception 'That person is already on the team' using errcode = 'P0001', hint = 'already_member';
  end if;
  insert into public.project_members (project_id, profile_id, role, status, invited_by, invited_at, consented_at)
  values (p_project_id, v_user, 'co_owner', 'invited', auth.uid(), now(), null)
  on conflict (project_id, profile_id) do update
    set status = 'invited', role = 'co_owner', invited_by = auth.uid(), invited_at = now(), responded_at = null, consented_at = null;
  select title into v_title from public.projects where id = p_project_id;
  perform public.notify(v_user, 'team_invite', jsonb_build_object('project_id', p_project_id, 'title', v_title));
end $$;

create function public.respond_co_owner_invite(p_project_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m public.project_members%rowtype; v_title text; r record;
begin
  perform public.assert_verified();
  select * into m from public.project_members where project_id = p_project_id and profile_id = auth.uid() for update;
  if not found or m.status <> 'invited' then
    raise exception 'There is no pending invitation for you on this project' using errcode = 'P0001', hint = 'no_invitation';
  end if;
  update public.project_members
    set status = case when p_accept then 'active' else 'left' end::public.member_status, responded_at = now()
    where project_id = p_project_id and profile_id = auth.uid();
  if p_accept then
    perform public.refresh_team_size(p_project_id);
    select title into v_title from public.projects where id = p_project_id;
    for r in select profile_id from public.project_members where project_id = p_project_id and status = 'active' and profile_id <> auth.uid() loop
      perform public.notify(r.profile_id, 'co_owner_joined', jsonb_build_object('project_id', p_project_id, 'title', v_title));
    end loop;
  end if;
end $$;

create or replace function public.remove_team_member(p_project_id uuid, p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can remove team members' using errcode = '42501', hint = 'not_owner';
  end if;
  if exists (select 1 from public.project_members where project_id = p_project_id and profile_id = p_profile and role = 'owner') then
    raise exception 'The project owner cannot be removed' using errcode = 'P0001', hint = 'owner_protected';
  end if;
  delete from public.project_members where project_id = p_project_id and profile_id = p_profile and role = 'co_owner';
  perform public.refresh_team_size(p_project_id);
end $$;

create or replace function public.confirm_team_consent(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.project_members set consented_at = now()
  where project_id = p_project_id and profile_id = auth.uid() and status = 'active' and consented_at is null;
  if not found and not public.is_project_owner(p_project_id) then
    raise exception 'You are not an owner of this project' using errcode = '42501', hint = 'not_owner';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Advisor consent and the "no advisor" path
-- ---------------------------------------------------------------------------
create or replace function public.issue_advisor_consent(p_project_id uuid, p_token_hash text, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_verified();
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can request advisor approval' using errcode = '42501', hint = 'not_owner';
  end if;
  if not public.project_is_editable(p_project_id) then
    raise exception 'This project can no longer be changed' using errcode = 'P0001', hint = 'not_editable';
  end if;
  update public.advisor_consents set status = 'withdrawn', decided_at = now()
    where project_id = p_project_id and status = 'pending';
  insert into public.advisor_consents (project_id, token_hash, expires_at)
    values (p_project_id, p_token_hash, p_expires_at) returning id into v_id;
  update public.projects set advisor_mode = 'advisor', no_advisor_declared_at = null where id = p_project_id;
  return v_id;
end $$;

-- A project without a supervising lecturer (for example an independent competition entry).
create function public.declare_no_advisor(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_verified();
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can make this declaration' using errcode = '42501', hint = 'not_owner';
  end if;
  if not public.project_is_editable(p_project_id) then
    raise exception 'This project can no longer be changed' using errcode = 'P0001', hint = 'not_editable';
  end if;
  if exists (select 1 from public.advisor_consents where project_id = p_project_id and status = 'approved') then
    raise exception 'An advisor already approved this project' using errcode = 'P0001', hint = 'advisor_approved';
  end if;
  update public.advisor_consents set status = 'withdrawn', decided_at = now()
    where project_id = p_project_id and status = 'pending';
  update public.projects set advisor_mode = 'none', no_advisor_declared_at = now() where id = p_project_id;
end $$;

create or replace function public.decide_advisor_consent(p_token_hash text, p_decision text, p_comment text)
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
    perform public.log_lineage(c.project_id, 'advisor_withdrawn', null, null, '{}'::jsonb);
    for r in select profile_id from public.project_members where project_id = c.project_id and status = 'active' loop
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
    perform public.log_lineage(c.project_id, 'advisor_approved', null, null, jsonb_build_object('comment', coalesce(p_comment, '')));
  end if;
  for r in select profile_id from public.project_members where project_id = c.project_id and status = 'active' loop
    perform public.notify(r.profile_id, 'advisor_decision',
      jsonb_build_object('project_id', c.project_id, 'title', v_title, 'decision', p_decision, 'comment', coalesce(p_comment, '')));
  end loop;
  return jsonb_build_object('ok', true, 'state', p_decision);
end $$;

-- ---------------------------------------------------------------------------
-- 12. Lifecycle: publish, unpublish, archive
-- ---------------------------------------------------------------------------
create or replace function public.publish_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype;
begin
  perform public.assert_verified();
  select * into v from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can publish this project' using errcode = '42501', hint = 'not_owner';
  end if;
  if v.status = 'published' then
    raise exception 'This project is already published' using errcode = 'P0001', hint = 'already_published';
  end if;
  if v.status = 'archived' then
    raise exception 'An archived project cannot be published' using errcode = 'P0001', hint = 'archived';
  end if;
  if v.moderation_status <> 'ok' then
    raise exception 'This project is under review and cannot be published right now' using errcode = 'P0001', hint = 'moderated';
  end if;
  if not (
    (v.advisor_mode = 'advisor' and exists (select 1 from public.advisor_consents where project_id = p_project_id and status = 'approved'))
    or (v.advisor_mode = 'none' and v.no_advisor_declared_at is not null)
  ) then
    raise exception 'Advisor approval is required before publishing (or declare that there is no advisor)' using errcode = 'P0001', hint = 'advisor_required';
  end if;
  if exists (select 1 from public.project_members where project_id = p_project_id and status = 'active' and consented_at is null) then
    raise exception 'Every team member must confirm before publishing' using errcode = 'P0001', hint = 'team_consent';
  end if;
  if exists (select 1 from public.draft_items where project_id = p_project_id and review_status = 'pending') then
    raise exception 'Review every drafted item before publishing' using errcode = 'P0001', hint = 'items_pending';
  end if;
  if not exists (select 1 from public.draft_items where project_id = p_project_id and review_status = 'kept') then
    raise exception 'Keep at least one item before publishing' using errcode = 'P0001', hint = 'no_kept_item';
  end if;
  if not public.has_current_policies(auth.uid()) then
    raise exception 'Accept the current Terms and Privacy Policy before publishing' using errcode = 'P0001', hint = 'policies_required';
  end if;
  update public.projects
    set status = 'published', published_at = coalesce(published_at, now()), unpublished_at = null
    where id = p_project_id;
  perform public.log_lineage(p_project_id, case when v.status = 'unpublished' then 'republished' else 'published' end::public.lineage_type,
    auth.uid(), null, '{}'::jsonb);
end $$;

create function public.unpublish_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype;
begin
  perform public.assert_verified();
  select * into v from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can unpublish this project' using errcode = '42501', hint = 'not_owner';
  end if;
  if v.status <> 'published' then
    raise exception 'Only a published project can be unpublished' using errcode = 'P0001', hint = 'not_published';
  end if;
  update public.projects set status = 'unpublished', unpublished_at = now() where id = p_project_id;
  perform public.log_lineage(p_project_id, 'unpublished', auth.uid(), null, '{}'::jsonb);
end $$;

create function public.archive_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype;
begin
  perform public.assert_verified();
  select * into v from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can archive this project' using errcode = '42501', hint = 'not_owner';
  end if;
  if v.status not in ('published', 'unpublished') then
    raise exception 'Only a published or unpublished project can be archived' using errcode = 'P0001', hint = 'not_archivable';
  end if;
  update public.projects set status = 'archived' where id = p_project_id;
  perform public.log_lineage(p_project_id, 'archived', auth.uid(), null, '{}'::jsonb);
end $$;

-- File access settings. p_max: 1, 3, or NULL for unlimited.
create function public.set_access_settings(p_project_id uuid, p_mode public.access_mode, p_max int) returns void
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype;
begin
  perform public.assert_verified();
  select * into v from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can change access settings' using errcode = '42501', hint = 'not_owner';
  end if;
  if v.status = 'archived' then
    raise exception 'An archived project cannot be changed' using errcode = 'P0001', hint = 'archived';
  end if;
  if p_max is not null and p_max not in (1, 3) then
    raise exception 'The team limit must be 1, 3 or unlimited' using errcode = 'P0001', hint = 'bad_limit';
  end if;
  update public.projects set access_mode = p_mode, max_active_adopters = p_max where id = p_project_id;
  perform public.log_lineage(p_project_id, 'access_settings_changed', auth.uid(), null,
    jsonb_build_object('mode_before', v.access_mode, 'mode_after', p_mode, 'max_before', v.max_active_adopters, 'max_after', p_max));
end $$;

-- ---------------------------------------------------------------------------
-- 13. Access: open mode, requests, agreement, expiry, revoke
-- ---------------------------------------------------------------------------
-- Open mode: accept the attribution agreement and the files unlock. No approval.
create function public.take_access(p_project_id uuid, p_agreement_version int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype; v_id uuid; r record; v_name text;
begin
  perform public.assert_verified();
  select * into v from public.projects where id = p_project_id for update; -- serializes the quota check
  if not found or v.status <> 'published' or v.moderation_status <> 'ok' then
    raise exception 'This project is not open for continuation' using errcode = 'P0001', hint = 'not_available';
  end if;
  if public.is_project_owner(p_project_id) then
    raise exception 'Owners cannot take access to their own project' using errcode = '42501', hint = 'own_project';
  end if;
  if v.access_mode = 'paused' then
    raise exception 'The owners paused new access for now' using errcode = 'P0001', hint = 'paused';
  end if;
  if v.access_mode <> 'open' then
    raise exception 'This project needs a request. Ask to continue it first' using errcode = 'P0001', hint = 'needs_request';
  end if;
  if p_agreement_version is distinct from public.current_agreement_version() then
    raise exception 'The agreement was updated. Read and accept the current version' using errcode = 'P0001', hint = 'agreement_version';
  end if;
  if public.has_access(p_project_id) then
    raise exception 'You already have access to this project' using errcode = 'P0001', hint = 'already_has_access';
  end if;
  if exists (select 1 from public.project_access where project_id = p_project_id and profile_id = auth.uid() and status = 'revoked') then
    raise exception 'The owners revoked your access to this project' using errcode = 'P0001', hint = 'access_revoked';
  end if;
  if not public.quota_available(p_project_id) then
    raise exception 'The team quota for this project is full' using errcode = 'P0001', hint = 'quota_full';
  end if;
  insert into public.project_access (project_id, profile_id, source, agreement_version)
    values (p_project_id, auth.uid(), 'open', p_agreement_version) returning id into v_id;
  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.log_lineage(p_project_id, 'agreement_signed', auth.uid(), null, jsonb_build_object('version', p_agreement_version, 'source', 'open'));
  perform public.log_lineage(p_project_id, 'access_taken', auth.uid(), null, jsonb_build_object('source', 'open'));
  perform public.log_lineage(p_project_id, 'continued', auth.uid(), null, '{}'::jsonb);
  for r in select profile_id from public.project_members where project_id = p_project_id and status = 'active' loop
    perform public.notify(r.profile_id, 'access_taken', jsonb_build_object('project_id', p_project_id, 'title', v.title, 'name', v_name));
  end loop;
  return v_id;
end $$;

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
  if coalesce(array_length(p_task_ids, 1), 0) = 0 or v_count <> array_length(p_task_ids, 1) then
    raise exception 'Choose at least one verified task from this project' using errcode = 'P0001', hint = 'no_task';
  end if;
  insert into public.continuation_requests
    (project_id, adopter_team_name, members, task_ids, plan, purpose, target_date, fit_note, created_by, expires_at)
  values (p_project_id, p_team_name, coalesce(p_members, '[]'::jsonb), p_task_ids, p_plan, p_purpose, p_target_date,
          coalesce(p_fit_note, ''), auth.uid(), now() + make_interval(days => v_exp))
  returning id into v_id;
  perform public.log_lineage(p_project_id, 'requested', auth.uid(), v_id, jsonb_build_object('team', p_team_name));
  for r in select profile_id from public.project_members where project_id = p_project_id and status = 'active' loop
    perform public.notify(r.profile_id, 'new_request', jsonb_build_object('project_id', p_project_id, 'request_id', v_id, 'title', v.title, 'team', p_team_name));
  end loop;
  return v_id;
end $$;

create or replace function public.decide_request(p_request_id uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.continuation_requests%rowtype; v_title text;
begin
  perform public.assert_verified();
  select * into q from public.continuation_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if not public.is_project_owner(q.project_id) then
    raise exception 'Only an owner of this project can decide' using errcode = '42501', hint = 'not_owner';
  end if;
  if q.status <> 'pending' then
    raise exception 'This request was already decided' using errcode = 'P0001', hint = 'already_decided';
  end if;
  if q.expires_at is not null and q.expires_at < now() then
    raise exception 'This request expired before it was decided' using errcode = 'P0001', hint = 'expired';
  end if;
  if p_decision not in ('approved', 'declined') then
    raise exception 'Unknown decision' using errcode = 'P0001';
  end if;
  if p_decision = 'approved' and not public.quota_available(q.project_id) then
    raise exception 'The team quota for this project is full' using errcode = 'P0001', hint = 'quota_full';
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

create or replace function public.ask_request_question(p_request_id uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.continuation_requests%rowtype; v_title text;
begin
  select * into q from public.continuation_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if not public.is_project_owner(q.project_id) then
    raise exception 'Only an owner of this project can ask questions' using errcode = '42501', hint = 'not_owner';
  end if;
  if coalesce(trim(p_message), '') = '' then
    raise exception 'Write your question first' using errcode = 'P0001';
  end if;
  select title into v_title from public.projects where id = q.project_id;
  perform public.notify(q.created_by, 'request_question',
    jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title, 'message', p_message));
end $$;

-- Each person in an approved request accepts the agreement once. That acceptance is their access.
create or replace function public.accept_agreement(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q public.continuation_requests%rowtype; v public.projects%rowtype; v_id uuid; v_first boolean; r record; v_name text;
begin
  perform public.assert_verified();
  select * into q from public.continuation_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into v from public.projects where id = q.project_id for update; -- serializes the quota check
  if q.status <> 'approved' then
    raise exception 'The agreement opens after the owners approve the request' using errcode = 'P0001', hint = 'not_approved';
  end if;
  if public.is_project_owner(q.project_id) then
    raise exception 'Owners cannot take access to their own project' using errcode = '42501', hint = 'own_project';
  end if;
  if not public.is_request_team(q.id) then
    raise exception 'You are not part of this request' using errcode = '42501', hint = 'not_in_request';
  end if;
  select id into v_id from public.project_access where project_id = q.project_id and profile_id = auth.uid() and status = 'active';
  if found then
    return jsonb_build_object('access_id', v_id, 'already', true);
  end if;
  if exists (select 1 from public.project_access where project_id = q.project_id and profile_id = auth.uid() and status = 'revoked') then
    raise exception 'The owners revoked your access to this project' using errcode = 'P0001', hint = 'access_revoked';
  end if;
  v_first := not exists (select 1 from public.project_access where request_id = q.id and status = 'active');
  if v_first and not public.quota_available(q.project_id) then
    raise exception 'The team quota for this project is full' using errcode = 'P0001', hint = 'quota_full';
  end if;
  insert into public.project_access (project_id, profile_id, source, agreement_version, request_id)
    values (q.project_id, auth.uid(), 'approved_request', public.current_agreement_version(), q.id) returning id into v_id;
  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.log_lineage(q.project_id, 'agreement_signed', auth.uid(), q.id, jsonb_build_object('version', public.current_agreement_version()));
  if v_first then
    perform public.log_lineage(q.project_id, 'access_taken', auth.uid(), q.id, jsonb_build_object('source', 'approved_request'));
    perform public.log_lineage(q.project_id, 'continued', q.created_by, q.id, jsonb_build_object('team', q.adopter_team_name));
  end if;
  for r in select profile_id from public.project_members where project_id = q.project_id and status = 'active' loop
    perform public.notify(r.profile_id, 'agreement_accepted',
      jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v.title, 'name', v_name));
  end loop;
  return jsonb_build_object('access_id', v_id, 'already', false);
end $$;

-- Pending requests older than their expiry become 'expired'. Called by a scheduled job with the service role.
create function public.expire_requests() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_title text;
begin
  for r in
    with u as (
      update public.continuation_requests set status = 'expired'
      where status = 'pending' and expires_at is not null and expires_at < now()
      returning id, project_id, created_by, adopter_team_name
    ) select * from u
  loop
    n := n + 1;
    select title into v_title from public.projects where id = r.project_id;
    perform public.log_lineage(r.project_id, 'request_expired', null, r.id, jsonb_build_object('team', r.adopter_team_name));
    perform public.notify(r.created_by, 'request_expired',
      jsonb_build_object('project_id', r.project_id, 'request_id', r.id, 'title', v_title, 'team', r.adopter_team_name));
    perform public.notify(m.profile_id, 'request_expired',
      jsonb_build_object('project_id', r.project_id, 'request_id', r.id, 'title', v_title, 'team', r.adopter_team_name))
      from public.project_members m where m.project_id = r.project_id and m.status = 'active';
  end loop;
  return n;
end $$;

-- An owner (or an admin) takes access away, with a reason. The holder keeps the attribution duty.
create function public.revoke_access(p_access uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.project_access%rowtype; v_title text; v_owner boolean;
begin
  select * into a from public.project_access where id = p_access for update;
  if not found then raise exception 'Access not found' using errcode = 'P0002'; end if;
  v_owner := public.is_project_owner(a.project_id);
  if not (v_owner or public.is_admin()) then
    raise exception 'Only an owner can revoke access' using errcode = '42501', hint = 'not_owner';
  end if;
  perform public.require_reason(p_reason);
  if a.status <> 'active' then
    raise exception 'This access was already revoked' using errcode = 'P0001', hint = 'already_revoked';
  end if;
  update public.project_access
    set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoked_reason = p_reason
    where id = a.id;
  select title into v_title from public.projects where id = a.project_id;
  perform public.log_lineage(a.project_id, 'access_revoked', auth.uid(), a.request_id, '{}'::jsonb);
  perform public.notify(a.profile_id, 'access_revoked',
    jsonb_build_object('project_id', a.project_id, 'title', v_title, 'reason', p_reason));
  if not v_owner then
    perform public.write_audit('access.revoke', 'project_access', a.id, p_reason,
      jsonb_build_object('status', 'active'), jsonb_build_object('status', 'revoked', 'project_id', a.project_id));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 14. Admin functions that referenced the old roles
-- ---------------------------------------------------------------------------
create or replace function public.apply_moderation(p_project uuid, p_status public.moderation_status, p_reason text)
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
  for r in select profile_id from public.project_members where project_id = p_project and status = 'active' loop
    perform public.notify(r.profile_id, 'moderation',
      jsonb_build_object('project_id', p_project, 'title', v.title, 'action', v_action, 'reason', p_reason));
  end loop;
end $$;

create or replace function public.admin_break_glass(p_project uuid, p_file uuid, p_reason text)
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
  for r in select profile_id from public.project_members where project_id = p_project and status = 'active' loop
    perform public.notify(r.profile_id, 'break_glass',
      jsonb_build_object('project_id', p_project, 'title', v_title, 'file', f.original_name, 'reason', p_reason));
  end loop;
  return jsonb_build_object('access_id', v_id, 'expires_at', v_exp);
end $$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_key not in ('allowed_email_domains', 'max_upload_mb', 'synthesis_daily_cap', 'advisor_token_ttl_days',
                   'show_demo_banner', 'registrations_open', 'contact_email', 'request_expiry_days', 'reapply_cooldown_days') then
    raise exception 'Unknown setting' using errcode = 'P0001';
  end if;
  select value into v_before from public.app_settings where key = p_key;
  insert into public.app_settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.write_audit('setting.update', 'setting', null, p_reason,
    jsonb_build_object('key', p_key, 'value', v_before), jsonb_build_object('key', p_key, 'value', p_value));
end $$;

-- The reason rule now carries a hint so the interface can show it in the user's language.
create or replace function public.require_reason(p_reason text) returns void
language plpgsql immutable as $$
begin
  if length(trim(coalesce(p_reason, ''))) < 15 then
    raise exception 'A reason of at least 15 characters is required' using errcode = 'P0001', hint = 'reason_short';
  end if;
end $$;

-- Admin read and consent functions that used the old roles and statuses.
create or replace function public.admin_regenerate_consent(p_project uuid, p_token_hash text, p_expires timestamptz, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  update public.advisor_consents set status = 'withdrawn', decided_at = now() where project_id = p_project and status = 'pending';
  insert into public.advisor_consents (project_id, token_hash, expires_at) values (p_project, p_token_hash, p_expires) returning id into v_id;
  update public.projects set advisor_mode = 'advisor', no_advisor_declared_at = null where id = p_project;
  perform public.write_audit('consent.regenerate', 'project', p_project, p_reason, null, jsonb_build_object('consent_id', v_id, 'expires_at', p_expires));
  return v_id;
end $$;

create or replace function public.admin_project_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'project', to_jsonb(p) - 'advisor_email',
    'creators', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.full_name)), '[]'::jsonb)
                 from public.project_members m join public.profiles pr on pr.id = m.profile_id where m.project_id = p.id and m.status = 'active'),
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

-- ---------------------------------------------------------------------------
-- 15. Views (public teaser and admin read side), re-created for the new model
-- ---------------------------------------------------------------------------
create view public.public_project_teaser as
select
  p.id, p.slug, p.title, p.summary, p.kind, p.field, p.year, p.stop_reason, p.status,
  p.advisor_name, p.is_demo, p.published_at, p.stopped_note, p.tech, p.team_size,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept')::int as objectives_total,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept' and i.objective_status = 'done')::int as objectives_done,
  (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'next_task' and i.review_status = 'kept')::int as tasks_count,
  p.access_mode, p.max_active_adopters,
  public.active_adopter_count(p.id) as active_adopters,
  (p.advisor_mode = 'none') as no_advisor
from public.projects p
where p.status = 'published' and p.moderation_status = 'ok';

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
where p.status = 'published' and p.moderation_status = 'ok' and i.review_status = 'kept';

create view public.public_project_lineage as
select e.id, e.project_id, e.type, e.created_at, (e.payload ->> 'team') as team
from public.lineage_events e
join public.projects p on p.id = e.project_id
where p.status = 'published' and p.moderation_status = 'ok' and e.type in ('created', 'published', 'continued');

grant select on public.public_project_teaser, public.public_teaser_items, public.public_project_lineage to anon, authenticated;

create view public.admin_projects_v as
select p.id, p.slug, p.title, p.status, p.moderation_status, p.moderation_reason, p.is_demo, p.field, p.year,
  p.created_at, p.updated_at, p.published_at,
  coalesce((select string_agg(pr.full_name, ', ' order by m.created_at) from public.project_members m
            join public.profiles pr on pr.id = m.profile_id where m.project_id = p.id and m.status = 'active'), '') as creators,
  (select count(*) from public.reports r where r.project_id = p.id and r.status in ('open', 'in_review'))::int as open_reports,
  p.access_mode, public.active_adopter_count(p.id) as active_adopters, p.max_active_adopters
from public.projects p where public.is_admin();

create view public.admin_users_v as
select pr.id, pr.full_name, u.email, pr.university, pr.faculty, pr.is_admin, pr.suspended_at, pr.suspended_reason, pr.suspended_until,
  (pr.suspended_at is not null and (pr.suspended_until is null or pr.suspended_until > now())) as suspended, u.last_sign_in_at, pr.created_at,
  (select count(*) from public.project_members m where m.profile_id = pr.id and m.status = 'active')::int as projects_count,
  (select count(*) from public.continuation_requests r where r.created_by = pr.id)::int as requests_count
from public.profiles pr join auth.users u on u.id = pr.id where public.is_admin();

create view public.admin_requests_v as
select r.id, r.project_id, p.title as project_title, r.adopter_team_name, r.status, r.created_at, p.is_demo,
  r.plan, r.purpose, r.target_date, r.fit_note, r.decision_note, jsonb_array_length(r.members) + 1 as team_size,
  greatest(r.updated_at, coalesce(r.decided_at, r.updated_at)) as last_change,
  (r.status = 'pending' and r.created_at < now() - interval '7 days') as stale,
  (r.status = 'approved' and not exists (select 1 from public.project_access a where a.request_id = r.id and a.status = 'active')) as waiting_agreement,
  exists (select 1 from public.project_access a where a.request_id = r.id and a.status = 'active') as unlocked
from public.continuation_requests r join public.projects p on p.id = r.project_id where public.is_admin();

revoke select on public.admin_projects_v, public.admin_users_v, public.admin_requests_v from anon;
grant select on public.admin_projects_v, public.admin_users_v, public.admin_requests_v to authenticated;

-- ---------------------------------------------------------------------------
-- 16. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.project_access enable row level security;
alter table public.policies enable row level security;
alter table public.policy_acceptances enable row level security;

create policy projects_select_member on public.projects for select to authenticated
  using (created_by = auth.uid() or public.is_project_owner(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (created_by = auth.uid() and public.is_verified());
create policy projects_update_owner on public.projects for update to authenticated
  using (public.is_project_owner(id) and public.project_is_editable(id))
  with check (public.is_project_owner(id));

create policy members_select on public.project_members for select to authenticated
  using (profile_id = auth.uid() or public.is_project_owner(project_id));
create policy consents_select on public.advisor_consents for select to authenticated
  using (public.is_project_owner(project_id));
create policy files_select on public.project_files for select to authenticated
  using (public.can_read_private(project_id));
create policy runs_select on public.synthesis_runs for select to authenticated
  using (public.is_project_owner(project_id));

-- Owners see every item. Access holders see only items the owners kept.
create policy items_select on public.draft_items for select to authenticated
  using (public.is_project_owner(project_id) or (public.has_access(project_id) and review_status = 'kept'));
create policy items_insert_owner on public.draft_items for insert to authenticated
  with check (public.is_project_owner(project_id) and public.project_is_editable(project_id) and origin = 'creator');
create policy items_update_owner on public.draft_items for update to authenticated
  using (public.is_project_owner(project_id) and public.project_is_editable(project_id))
  with check (public.is_project_owner(project_id));

create policy requests_select on public.continuation_requests for select to authenticated
  using (public.can_see_request(id));
create policy acceptances_select on public.agreement_acceptances for select to authenticated
  using (public.can_see_request(request_id));
create policy lineage_select on public.lineage_events for select to authenticated
  using (public.is_project_owner(project_id) or (request_id is not null and public.can_see_request(request_id)));

create policy access_select on public.project_access for select to authenticated
  using (profile_id = auth.uid() or public.is_project_owner(project_id));
create policy policies_select on public.policies for select to anon, authenticated using (true);
create policy policy_acceptances_select on public.policy_acceptances for select to authenticated
  using (profile_id = auth.uid());

-- Writes to the new tables happen only through functions (service role for acceptances recorded at sign up).
revoke insert, update, delete, truncate on public.project_access, public.policies, public.policy_acceptances from authenticated, anon;
revoke select on public.project_access, public.policy_acceptances from anon;
-- Members and invitations change only through functions.
revoke update on public.project_members from authenticated;

-- ---------------------------------------------------------------------------
-- 17. Function privileges for everything created above
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'is_verified', 'assert_verified', 'is_project_owner', 'has_access', 'active_adopter_count', 'quota_available', 'setting_int',
      'refresh_team_size', 'current_policy_version', 'has_current_policies', 'i_accepted_current_policies', 'accept_current_policies',
      'invite_co_owner', 'respond_co_owner_invite', 'declare_no_advisor', 'unpublish_project', 'archive_project',
      'set_access_settings', 'take_access', 'expire_requests', 'revoke_access'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function
  public.is_verified(), public.is_project_owner(uuid), public.has_access(uuid), public.active_adopter_count(uuid),
  public.quota_available(uuid), public.i_accepted_current_policies(), public.current_policy_version(public.policy_kind),
  public.accept_current_policies(),
  public.invite_co_owner(uuid, text), public.respond_co_owner_invite(uuid, boolean), public.declare_no_advisor(uuid),
  public.unpublish_project(uuid), public.archive_project(uuid), public.set_access_settings(uuid, public.access_mode, int),
  public.take_access(uuid, int), public.revoke_access(uuid, text)
to authenticated;
grant execute on function public.expire_requests() to service_role;
-- The public teaser view exposes the number of active teams (a public number), so anonymous visitors may call this.
grant execute on function public.active_adopter_count(uuid) to anon;
