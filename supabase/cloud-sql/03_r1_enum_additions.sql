-- ESTAFET database, step 03 of 11: r1_enum_additions.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 02 succeeded.
-- Generated from supabase/migrations/20261121000001_r1_enum_additions.sql. Do not edit by hand.

-- R1 (part 1 of 2): enum values only.
-- ALTER TYPE ... ADD VALUE cannot be used in the transaction that adds it, so these live in their own migration.
-- See docs/release-plan.md section 2.3 and docs/migrations-r1.md.

alter type public.lineage_type add value if not exists 'access_taken';
alter type public.lineage_type add value if not exists 'access_revoked';
alter type public.lineage_type add value if not exists 'request_expired';
alter type public.lineage_type add value if not exists 'unpublished';
alter type public.lineage_type add value if not exists 'republished';
alter type public.lineage_type add value if not exists 'archived';
alter type public.lineage_type add value if not exists 'access_settings_changed';

alter type public.request_status add value if not exists 'expired';
