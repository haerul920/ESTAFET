-- ESTAFET database, step 18 of 24: progress_by_adopters_only.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 17 succeeded.
-- Generated from supabase/migrations/20261128000004_progress_by_adopters_only.sql. Do not edit by hand.

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
