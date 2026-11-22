-- ESTAFET database, step 05 of 10: r4_enum_additions.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 04 succeeded.
-- Generated from supabase/migrations/20261122000001_r4_enum_additions.sql. Do not edit by hand.

-- R4 part 1: enum values. ALTER TYPE ... ADD VALUE must be committed before the new values are used,
-- so these live in their own migration (same pattern as the R1 enum additions).
alter type public.lineage_type add value if not exists 'item_progress';
alter type public.lineage_type add value if not exists 'ownership_transferred';
