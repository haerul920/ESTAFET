-- ESTAFET database, step 06 of 12: r4_flows.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 05 succeeded.
-- Generated from supabase/migrations/20261122000002_r4_flows.sql. Do not edit by hand.

-- ESTAFET release R4: flows.
--   1. fill_mode: AI draft or manual ("Isi manual tanpa AI")
--   2. project_watchers: "Beri tahu saya" when access opens again or a team slot frees up
--   3. request_messages: a short thread between the requesting team and the owners
--   4. backlog_progress: access holders mark next tasks "Dikerjakan" or "Selesai"
--   5. remind_expiring_requests(): reminder before a pending request expires
--   6. ownership_transfers: a transfer needs the recipient to confirm
-- Every rule is enforced here, not only in the interface.

-- ---------------------------------------------------------------- 1. fill mode
alter table public.projects add column fill_mode text check (fill_mode in ('ai', 'manual'));
comment on column public.projects.fill_mode is 'null = not chosen yet. manual = the owners write the items by hand, nothing goes to an AI provider.';

create or replace function public.set_fill_mode(p_project_id uuid, p_mode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_verified();
  if p_mode not in ('ai', 'manual') then
    raise exception 'Unknown fill mode' using errcode = 'P0001', hint = 'bad_mode';
  end if;
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can do this' using errcode = '42501', hint = 'not_owner';
  end if;
  if not public.project_is_editable(p_project_id) then
    raise exception 'This project can no longer be changed' using errcode = 'P0001', hint = 'not_editable';
  end if;
  update public.projects set fill_mode = p_mode where id = p_project_id;
end $$;

-- ---------------------------------------------------------------- 2. watchers
create table public.project_watchers (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
alter table public.project_watchers enable row level security;
create policy project_watchers_select on public.project_watchers for select using (profile_id = auth.uid());
-- No insert, update or delete policy: people use watch_project() and unwatch_project().

create or replace function public.watch_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_verified();
  if not exists (select 1 from public.projects where id = p_project_id and status = 'published' and moderation_status = 'ok') then
    raise exception 'This project is not open for continuation' using errcode = 'P0001', hint = 'not_available';
  end if;
  if public.is_project_owner(p_project_id) then
    raise exception 'Owners cannot take access to their own project' using errcode = 'P0001', hint = 'own_project';
  end if;
  insert into public.project_watchers (project_id, profile_id) values (p_project_id, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.unwatch_project(p_project_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.project_watchers where project_id = p_project_id and profile_id = auth.uid()
$$;

-- Internal. Tells everyone who asked to be notified, then clears the list (one notification per wish).
create or replace function public.notify_watchers(p_project_id uuid, p_reason text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_title text; v_slug text; n int := 0; w record;
begin
  select title, slug into v_title, v_slug from public.projects where id = p_project_id;
  for w in delete from public.project_watchers where project_id = p_project_id returning profile_id loop
    perform public.notify(w.profile_id, 'watch_open',
      jsonb_build_object('project_id', p_project_id, 'title', v_title, 'slug', v_slug, 'reason', p_reason));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.notify_watchers(uuid, text) from public, anon, authenticated;

-- set_access_settings: also tells watchers when new access opens again (mode left "paused", or a slot appeared).
create or replace function public.set_access_settings(p_project_id uuid, p_mode public.access_mode, p_max integer) returns void
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype; v_was_open boolean; v_is_open boolean;
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
  v_was_open := v.access_mode <> 'paused' and public.quota_available(p_project_id);
  update public.projects set access_mode = p_mode, max_active_adopters = p_max where id = p_project_id;
  v_is_open := p_mode <> 'paused' and public.quota_available(p_project_id);
  perform public.log_lineage(p_project_id, 'access_settings_changed', auth.uid(), null,
    jsonb_build_object('mode_before', v.access_mode, 'mode_after', p_mode, 'max_before', v.max_active_adopters, 'max_after', p_max));
  if v.status = 'published' and v_is_open and not v_was_open then
    perform public.notify_watchers(p_project_id, case when v.access_mode = 'paused' then 'mode' else 'quota' end);
  end if;
end $$;

-- revoke_access: a freed team slot also tells watchers.
create or replace function public.revoke_access(p_access uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.project_access%rowtype; v_title text; v_owner boolean; v_was_open boolean; v_mode public.access_mode; v_status public.project_status;
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
  select access_mode, status into v_mode, v_status from public.projects where id = a.project_id;
  v_was_open := v_mode <> 'paused' and public.quota_available(a.project_id);
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
  if v_status = 'published' and v_mode <> 'paused' and not v_was_open and public.quota_available(a.project_id) then
    perform public.notify_watchers(a.project_id, 'quota');
  end if;
end $$;

-- ---------------------------------------------------------------- 3. request thread
create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.continuation_requests (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index request_messages_request_idx on public.request_messages (request_id, created_at);
alter table public.request_messages enable row level security;
create policy request_messages_select on public.request_messages for select using (public.can_see_request(request_id));
-- Writes go through post_request_message().

create or replace function public.post_request_message(p_request_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.continuation_requests%rowtype; v_title text; v_owner boolean; v_body text := trim(coalesce(p_body, ''));
begin
  perform public.assert_verified();
  select * into q from public.continuation_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  v_owner := public.is_project_owner(q.project_id);
  if not (v_owner or public.is_request_team(p_request_id)) then
    raise exception 'You are not part of this request' using errcode = '42501', hint = 'not_in_request';
  end if;
  if v_body = '' then
    raise exception 'Write your message first' using errcode = 'P0001', hint = 'message_empty';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'A message can have at most 500 characters' using errcode = 'P0001', hint = 'message_long';
  end if;
  if q.status not in ('pending', 'approved') then
    raise exception 'This request was already decided' using errcode = 'P0001', hint = 'already_decided';
  end if;
  if (select count(*) from public.request_messages where request_id = p_request_id) >= 40 then
    raise exception 'This conversation is full. Decide the request or start a new one' using errcode = 'P0001', hint = 'thread_full';
  end if;
  insert into public.request_messages (request_id, author_id, body) values (p_request_id, auth.uid(), v_body);
  select title into v_title from public.projects where id = q.project_id;
  if v_owner then
    perform public.notify(q.created_by, 'request_question',
      jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title, 'message', v_body));
  else
    perform public.notify(m.profile_id, 'request_reply',
      jsonb_build_object('project_id', q.project_id, 'request_id', q.id, 'title', v_title, 'team', q.adopter_team_name, 'message', v_body))
      from public.project_members m where m.project_id = q.project_id and m.status = 'active';
  end if;
end $$;

-- The old one-way question now writes into the thread, so owners and teams see the same history.
create or replace function public.ask_request_question(p_request_id uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.continuation_requests%rowtype;
begin
  select * into q from public.continuation_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if not public.is_project_owner(q.project_id) then
    raise exception 'Only an owner of this project can ask questions' using errcode = '42501', hint = 'not_owner';
  end if;
  perform public.post_request_message(p_request_id, p_message);
end $$;

-- ---------------------------------------------------------------- 4. backlog progress
create type public.progress_status as enum ('in_progress', 'done');

create table public.backlog_progress (
  item_id uuid primary key references public.draft_items (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status public.progress_status not null,
  updated_by uuid not null references public.profiles (id),
  updated_at timestamptz not null default now()
);
create index backlog_progress_project_idx on public.backlog_progress (project_id);
alter table public.backlog_progress enable row level security;
create policy backlog_progress_select on public.backlog_progress for select using (public.can_read_private(project_id));
-- Writes go through set_item_progress().

create or replace function public.set_item_progress(p_item uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare it public.draft_items%rowtype; v_owner boolean;
begin
  perform public.assert_verified();
  select * into it from public.draft_items where id = p_item;
  if not found then raise exception 'Item not found' using errcode = 'P0002'; end if;
  if it.kind <> 'next_task' or it.review_status <> 'kept' then
    raise exception 'Only a verified next task can be marked' using errcode = 'P0001', hint = 'not_a_task';
  end if;
  v_owner := public.is_project_owner(it.project_id);
  if not (v_owner or public.has_access(it.project_id)) then
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
  if not v_owner then
    perform public.notify(m.profile_id, 'item_progress',
      jsonb_build_object('project_id', it.project_id, 'title', (select title from public.projects where id = it.project_id),
                         'slug', (select slug from public.projects where id = it.project_id), 'task', it.title, 'status', p_status))
      from public.project_members m where m.project_id = it.project_id and m.status = 'active';
  end if;
end $$;

-- ---------------------------------------------------------------- 5. expiry reminders
create or replace function public.remind_expiring_requests(p_days integer default 3) returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_title text;
begin
  for r in
    select id, project_id, adopter_team_name, expires_at from public.continuation_requests q
    where q.status = 'pending' and q.expires_at is not null
      and q.expires_at > now() and q.expires_at <= now() + make_interval(days => p_days)
      and not exists (select 1 from public.notifications nn where nn.type = 'request_expiring' and nn.payload ->> 'request_id' = q.id::text)
  loop
    n := n + 1;
    select title into v_title from public.projects where id = r.project_id;
    perform public.notify(m.profile_id, 'request_expiring',
      jsonb_build_object('project_id', r.project_id, 'request_id', r.id, 'title', v_title, 'team', r.adopter_team_name, 'expires_at', r.expires_at))
      from public.project_members m where m.project_id = r.project_id and m.status = 'active';
  end loop;
  return n;
end $$;
revoke execute on function public.remind_expiring_requests(integer) from public, anon, authenticated;
grant execute on function public.remind_expiring_requests(integer) to service_role;

-- ---------------------------------------------------------------- 5b. co-owners at any time
-- CLAUDE.md 14.4: owners may invite co-owners at any time. Before R4 this was refused once a project was published.
-- Only an archived project stays closed. The invited person still has to accept.
create or replace function public.invite_co_owner(p_project_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid; v_title text; v_status public.project_status; m public.project_members%rowtype;
begin
  perform public.assert_verified();
  if not public.is_project_owner(p_project_id) then
    raise exception 'Only an owner can invite co-owners' using errcode = '42501', hint = 'not_owner';
  end if;
  select status into v_status from public.projects where id = p_project_id;
  if v_status = 'archived' then
    raise exception 'An archived project cannot be changed' using errcode = 'P0001', hint = 'archived';
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

-- ---------------------------------------------------------------- 6. ownership transfer
create table public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  from_profile uuid not null references public.profiles (id),
  to_profile uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_profile <> to_profile)
);
create unique index ownership_transfers_one_pending on public.ownership_transfers (project_id) where status = 'pending';
alter table public.ownership_transfers enable row level security;
create policy ownership_transfers_select on public.ownership_transfers for select
  using (from_profile = auth.uid() or to_profile = auth.uid() or public.is_project_owner(project_id));

create or replace function public.propose_ownership_transfer(p_project_id uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_title text; v_slug text;
begin
  perform public.assert_verified();
  if not exists (select 1 from public.project_members where project_id = p_project_id and profile_id = auth.uid() and role = 'owner' and status = 'active') then
    raise exception 'Only the owner can hand over ownership' using errcode = '42501', hint = 'not_primary_owner';
  end if;
  if not exists (select 1 from public.project_members where project_id = p_project_id and profile_id = p_to and role = 'co_owner' and status = 'active') then
    raise exception 'Ownership can only go to an active co-owner' using errcode = 'P0001', hint = 'not_co_owner';
  end if;
  if exists (select 1 from public.ownership_transfers where project_id = p_project_id and status = 'pending') then
    raise exception 'A transfer is already waiting for an answer' using errcode = 'P0001', hint = 'transfer_pending';
  end if;
  insert into public.ownership_transfers (project_id, from_profile, to_profile) values (p_project_id, auth.uid(), p_to);
  select title, slug into v_title, v_slug from public.projects where id = p_project_id;
  perform public.notify(p_to, 'ownership_offer', jsonb_build_object('project_id', p_project_id, 'title', v_title, 'slug', v_slug));
end $$;

create or replace function public.respond_ownership_transfer(p_project_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare t public.ownership_transfers%rowtype; v_title text;
begin
  select * into t from public.ownership_transfers where project_id = p_project_id and status = 'pending' for update;
  if not found or t.to_profile <> auth.uid() then
    raise exception 'There is no transfer waiting for you' using errcode = 'P0001', hint = 'no_transfer';
  end if;
  select title into v_title from public.projects where id = p_project_id;
  if p_accept then
    update public.project_members set role = 'co_owner' where project_id = p_project_id and profile_id = t.from_profile;
    update public.project_members set role = 'owner' where project_id = p_project_id and profile_id = t.to_profile;
    update public.ownership_transfers set status = 'accepted', decided_at = now() where id = t.id;
    perform public.log_lineage(p_project_id, 'ownership_transferred', auth.uid(), null,
      jsonb_build_object('from', t.from_profile, 'to', t.to_profile));
  else
    update public.ownership_transfers set status = 'declined', decided_at = now() where id = t.id;
  end if;
  perform public.notify(t.from_profile, case when p_accept then 'ownership_accepted' else 'ownership_declined' end,
    jsonb_build_object('project_id', p_project_id, 'title', v_title));
end $$;

create or replace function public.cancel_ownership_transfer(p_project_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.ownership_transfers set status = 'cancelled', decided_at = now()
  where project_id = p_project_id and status = 'pending' and from_profile = auth.uid()
$$;

-- Browsers may call the rule functions (they check who the caller is). Internal helpers stay closed.
grant execute on function
  public.set_fill_mode(uuid, text), public.watch_project(uuid), public.unwatch_project(uuid),
  public.post_request_message(uuid, text), public.set_item_progress(uuid, text),
  public.propose_ownership_transfer(uuid, uuid), public.respond_ownership_transfer(uuid, boolean),
  public.cancel_ownership_transfer(uuid)
to authenticated;
revoke execute on function
  public.set_fill_mode(uuid, text), public.watch_project(uuid), public.unwatch_project(uuid),
  public.post_request_message(uuid, text), public.set_item_progress(uuid, text),
  public.propose_ownership_transfer(uuid, uuid), public.respond_ownership_transfer(uuid, boolean),
  public.cancel_ownership_transfer(uuid)
from anon;
