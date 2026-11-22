-- ESTAFET database, step 08 of 12: r5_enum_additions.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 07 succeeded.
-- Generated from supabase/migrations/20261123000002_r5_enum_additions.sql. Do not edit by hand.

-- R5 part 1: enum values (ALTER TYPE ... ADD VALUE must be committed before use, so this is its own migration).
-- Report reasons follow CLAUDE.md 14.6: copyright, personal_data, false_information, inappropriate, false_ownership,
-- harmful_file, spam, other. "inaccurate" is renamed to "false_information" (existing rows keep their meaning).
alter type public.report_reason rename value 'inaccurate' to 'false_information';
alter type public.report_reason add value if not exists 'false_ownership';
alter type public.report_reason add value if not exists 'harmful_file';
alter type public.report_reason add value if not exists 'spam';

-- Moderation: ok -> held (automatic or by an admin, temporary) -> hidden -> removed. Any state can return to ok.
alter type public.moderation_status add value if not exists 'held' before 'hidden';
