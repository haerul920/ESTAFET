-- ESTAFET database, step 22 of 26: upload_file_kinds.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 21 succeeded.
-- Generated from supabase/migrations/20261130000001_upload_file_kinds.sql. Do not edit by hand.

-- New kinds of upload: pictures, Word, Excel and PowerPoint (CLAUDE.md 15.40). ZIP uploads are no longer accepted;
-- 'code_tree' stays for the files older projects already have.
alter type public.file_kind add value if not exists 'image';
alter type public.file_kind add value if not exists 'word';
alter type public.file_kind add value if not exists 'spreadsheet';
alter type public.file_kind add value if not exists 'slides';
