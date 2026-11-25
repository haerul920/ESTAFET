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

create function public.delete_draft_project(p_project uuid) returns jsonb
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
