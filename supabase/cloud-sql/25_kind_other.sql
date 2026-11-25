-- ESTAFET database, step 25 of 26: kind_other.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 24 succeeded.
-- Generated from supabase/migrations/20261130000004_kind_other.sql. Do not edit by hand.

-- Kind of work "Lainnya" (other) gets the owner's own name for it (CLAUDE.md 15.41, revised 2026-11-26).
-- The enum value 'other' already exists (20261130000003_project_kinds.sql).

alter table public.projects add column if not exists kind_other text;

-- A name is required for "other" and never stored for the fixed kinds, so the two cannot disagree.
-- Existing "other" projects from before this change keep working: they get the label as their name.
update public.projects set kind_other = 'Lainnya' where kind = 'other' and kind_other is null;
update public.projects set kind_other = null where kind <> 'other' and kind_other is not null;
alter table public.projects drop constraint if exists projects_kind_other_check;
alter table public.projects add constraint projects_kind_other_check check (
  (kind = 'other' and kind_other is not null and char_length(btrim(kind_other)) between 2 and 60)
  or (kind <> 'other' and kind_other is null)
);

-- Owners edit it like the other basics (column-level privileges, see the first migration).
grant update (kind_other) on public.projects to authenticated;

-- The public teaser shows the name too. New columns go at the end, as CREATE OR REPLACE VIEW requires.
create or replace view public.public_project_teaser as
select p.id, p.slug, p.title, p.summary, p.kind, p.field, p.year, p.stop_reason, p.status,
       p.is_demo, p.published_at, p.stopped_note, p.tech, p.team_size,
       (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept')::int as objectives_total,
       (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'objective' and i.review_status = 'kept' and i.objective_status = 'done')::int as objectives_done,
       (select count(*) from public.draft_items i where i.project_id = p.id and i.kind = 'next_task' and i.review_status = 'kept')::int as tasks_count,
       p.access_mode, p.max_active_adopters, public.active_adopter_count(p.id) as active_adopters,
       p.kind_other
from public.projects p
where p.status = 'published' and p.moderation_status = 'ok';
grant select on public.public_project_teaser to anon, authenticated;
