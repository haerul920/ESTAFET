-- ESTAFET database, step 16 of 26: remove_paused_access.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 15 succeeded.
-- Generated from supabase/migrations/20261128000002_remove_paused_access.sql. Do not edit by hand.

-- The "paused" access mode is removed from the product (CLAUDE.md 15.22). Projects that were paused go back to
-- "by_request", so their owners still decide about every team. The enum value stays in the database, marked retired,
-- and this constraint stops anything from choosing it again.
update public.projects set access_mode = 'by_request' where access_mode = 'paused';

alter table public.projects drop constraint if exists projects_access_mode_not_paused;
alter table public.projects add constraint projects_access_mode_not_paused check (access_mode <> 'paused');
