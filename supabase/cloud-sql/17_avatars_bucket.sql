-- ESTAFET database, step 17 of 24: avatars_bucket.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 16 succeeded.
-- Generated from supabase/migrations/20261128000003_avatars_bucket.sql. Do not edit by hand.

-- Profile photos (CLAUDE.md 15.25). A private bucket with no client policies: only server code reads and writes it,
-- after checking who is signed in. Photos are re-encoded to a small JPEG in the browser before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];
