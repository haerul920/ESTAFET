-- ESTAFET database, step 20 of 26: legal_documents.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 19 succeeded.
-- Generated from supabase/migrations/20261129000002_legal_documents.sql. Do not edit by hand.

-- Admins write the Terms, Privacy Policy, Community Guidelines and Attribution page in the app (CLAUDE.md 15.36).
-- Every publication is a new revision. Published text is history: it is never changed or deleted. Until a document
-- has a revision, the app shows its built-in text.
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  doc text not null check (doc in ('terms', 'privacy', 'guidelines', 'attribution')),
  revision integer not null check (revision > 0),
  content jsonb not null,
  published_at timestamptz not null default now(),
  unique (doc, revision)
);
alter table public.legal_documents enable row level security;
create policy legal_documents_select on public.legal_documents for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to anon, authenticated;

create function public.legal_documents_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'legal_documents is append-only' using errcode = 'P0001';
end $$;
create trigger legal_documents_no_change before update or delete on public.legal_documents
  for each row execute function public.legal_documents_append_only();

-- Publishes one document. For the Terms and the Privacy Policy it also publishes the next policy version, in the same
-- transaction, so everyone accepts the new text. Who did it and why is in the audit log.
create function public.admin_publish_document(p_doc text, p_content jsonb, p_reason text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_revision integer; v_lang text; v_text jsonb;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_doc is null or p_doc not in ('terms', 'privacy', 'guidelines', 'attribution') then
    raise exception 'Unknown document' using errcode = 'P0001', hint = 'document_invalid';
  end if;
  if p_content is null or octet_length(p_content::text) > 200000 then
    raise exception 'The document is empty or too long' using errcode = 'P0001', hint = 'document_invalid';
  end if;
  foreach v_lang in array array['id', 'en'] loop
    v_text := p_content -> v_lang;
    if coalesce(trim(v_text ->> 'title'), '') = '' or coalesce(jsonb_typeof(v_text -> 'sections'), '') <> 'array' then
      raise exception 'Both languages need a title and sections' using errcode = 'P0001', hint = 'document_invalid';
    end if;
    if jsonb_array_length(v_text -> 'sections') not between 1 and 30 then
      raise exception 'A document has 1 to 30 sections' using errcode = 'P0001', hint = 'document_invalid';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtext('estafet.legal.' || p_doc));
  select coalesce(max(revision), 0) + 1 into v_revision from public.legal_documents where doc = p_doc;
  insert into public.legal_documents (doc, revision, content) values (p_doc, v_revision, p_content);
  if p_doc in ('terms', 'privacy') then
    perform public.admin_publish_policy(p_doc::public.policy_kind,
      coalesce(public.current_policy_version(p_doc::public.policy_kind), 0) + 1, p_reason);
  end if;
  perform public.write_audit('document.publish', 'document', null, p_reason, null,
    jsonb_build_object('doc', p_doc, 'revision', v_revision));
  return v_revision;
end $$;
revoke execute on function public.admin_publish_document(text, jsonb, text) from public, anon;
grant execute on function public.admin_publish_document(text, jsonb, text) to authenticated;
