-- ESTAFET database, step 24 of 26: project_kinds.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 23 succeeded.
-- Generated from supabase/migrations/20261130000003_project_kinds.sql. Do not edit by hand.

-- Two more types of work (CLAUDE.md 15.41): community service, and "other".
-- "research" keeps its value; only its label changed in the app.
alter type public.project_kind add value if not exists 'community_service';
alter type public.project_kind add value if not exists 'other';
