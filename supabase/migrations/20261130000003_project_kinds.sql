-- Two more types of work (CLAUDE.md 15.41): community service, and "other".
-- "research" keeps its value; only its label changed in the app.
alter type public.project_kind add value if not exists 'community_service';
alter type public.project_kind add value if not exists 'other';
