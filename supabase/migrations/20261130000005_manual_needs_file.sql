-- Filling a project by hand ("Isi manual") needs at least one uploaded file first (QA note, CLAUDE.md 15.43).
-- The files are what the next team receives; without them "manual" was a way to skip the Files step entirely.
-- Same function as in 20261122000002_r4_flows.sql, plus that one check.

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
  if p_mode = 'manual' and not exists (select 1 from public.project_files f where f.project_id = p_project_id) then
    raise exception 'Upload at least one file first' using errcode = 'P0001', hint = 'needs_file';
  end if;
  update public.projects set fill_mode = p_mode where id = p_project_id;
end $$;
