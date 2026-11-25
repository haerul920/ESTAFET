-- The upload limit is 50 MB (CLAUDE.md 15.40). A saved setting overrides the app's default, so the old value has to
-- move too. A setting an admin chose on purpose, other than the old default, is left alone, but never above 50.
update public.app_settings set value = to_jsonb(50), updated_at = now()
  where key = 'max_upload_mb' and ((value #>> '{}')::numeric = 25 or (value #>> '{}')::numeric > 50);

update storage.buckets set file_size_limit = 52428800, public = false where id in ('project-files', 'extracted-text');
