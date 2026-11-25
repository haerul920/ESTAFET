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
