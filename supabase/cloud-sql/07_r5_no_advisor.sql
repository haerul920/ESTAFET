-- ESTAFET database, step 07 of 26: r5_no_advisor.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 06 succeeded.
-- Generated from supabase/migrations/20261123000001_r5_no_advisor.sql. Do not edit by hand.

-- ESTAFET release R5, part 0: the product has no advisor (lecturer) role.
-- Scope decision by the owner (2026-11-21): ESTAFET is for students only. Publishing no longer asks for an
-- advisor approval or a "no advisor" declaration, and the public pages never show an advisor.
--
-- Safety: old rows are kept. The columns projects.advisor_name, advisor_email, advisor_mode,
-- no_advisor_declared_at and the table advisor_consents stay (deprecated, unused by the product, empty for new
-- projects) so nothing is destroyed; a later cleanup migration can drop them. The three advisor functions are
-- removed so the old token endpoint cannot be used any more.

-- 1. Publishing needs: team consent, every item reviewed, one kept item, current policies. Nothing about an advisor.
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

-- 2. The advisor functions are gone.
drop function if exists public.issue_advisor_consent(uuid, text, timestamptz);
drop function if exists public.decide_advisor_consent(text, text, text);
drop function if exists public.declare_no_advisor(uuid);

-- 3. The public view no longer carries an advisor name or the "no advisor" flag.
drop view public.public_project_teaser;
create view public.public_project_teaser as
select p.id, p.slug, p.title, p.summary, p.kind, p.field, p.year, p.stop_reason, p.status,
       p.is_demo, p.published_at, p.stopped_note, p.tech, p.team_size,
       (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept')::int as objectives_total,
       (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept' and i.objective_status = 'done')::int as objectives_done,
       (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'next_task' and i.review_status = 'kept')::int as tasks_count,
       p.access_mode, p.max_active_adopters, public.active_adopter_count(p.id) as active_adopters
from public.projects p
where p.status = 'published' and p.moderation_status = 'ok';
grant select on public.public_project_teaser to anon, authenticated;

comment on column public.projects.advisor_name is 'DEPRECATED (R5): the product has no advisor role. Kept so old data is not destroyed.';
comment on column public.projects.advisor_email is 'DEPRECATED (R5): see advisor_name.';
comment on column public.projects.advisor_mode is 'DEPRECATED (R5): see advisor_name.';
comment on column public.projects.no_advisor_declared_at is 'DEPRECATED (R5): see advisor_name.';
comment on table public.advisor_consents is 'DEPRECATED (R5): the product has no advisor role. No code writes here.';

-- 4. The admin consent tools only served the advisor flow.
drop function if exists public.admin_regenerate_consent(uuid, text, timestamptz, text);
drop view if exists public.admin_consents_v;
