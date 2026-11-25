-- New kinds of upload: pictures, Word, Excel and PowerPoint (CLAUDE.md 15.40). ZIP uploads are no longer accepted;
-- 'code_tree' stays for the files older projects already have.
alter type public.file_kind add value if not exists 'image';
alter type public.file_kind add value if not exists 'word';
alter type public.file_kind add value if not exists 'spreadsheet';
alter type public.file_kind add value if not exists 'slides';
