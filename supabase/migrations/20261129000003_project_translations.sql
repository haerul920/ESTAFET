-- Cached machine translations of the PUBLIC text of published projects (CLAUDE.md 15.39). Only the server reads and
-- writes this table, after it has loaded the text through the public teaser views.
create table public.project_translations (
  project_id uuid not null references public.projects (id) on delete cascade,
  lang text not null check (lang in ('id', 'en')),
  -- A fingerprint of the text that was translated. When the text changes, the translation is out of date.
  source_hash text not null,
  content jsonb not null,
  -- True when the text was already in this language, so nothing is shown as translated.
  same_language boolean not null default false,
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, lang)
);
alter table public.project_translations enable row level security;
revoke all on public.project_translations from anon, authenticated;
