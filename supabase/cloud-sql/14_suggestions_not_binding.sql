-- ESTAFET database, step 14 of 26: suggestions_not_binding.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 13 succeeded.
-- Generated from supabase/migrations/20261127000001_suggestions_not_binding.sql. Do not edit by hand.

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
