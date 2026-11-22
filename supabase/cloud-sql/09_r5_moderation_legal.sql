-- ESTAFET database, step 09 of 11: r5_moderation_legal.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 08 succeeded.
-- Generated from supabase/migrations/20261123000003_r5_moderation_legal.sql. Do not edit by hand.

-- ESTAFET release R5: reporting, moderation, appeals, account privacy.
--   1. reports: reference code, evidence link, distinct-reporter key; submit_report(); automatic hold
--   2. moderation_decisions and moderation_appeals (one appeal per decision); apply_moderation records every decision
--   3. held projects: neutral public notice, overdue-hold escalation
--   4. account privacy: data export, account deletion with a 30 day grace period
--   5. settings keys for the hold threshold and the review target
-- Reporters are never shown to owners: owners have no policy on reports, and no notification or decision carries a reporter.

-- ---------------------------------------------------------------- 1. reports
create or replace function public.next_report_reference() returns text
language plpgsql set search_path = public as $$
declare r text;
begin
  loop
    r := 'LP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.reports where reference = r);
  end loop;
  return r;
end $$;

alter table public.reports
  add column reference text,
  add column evidence_url text,
  add column reporter_key text,
  add column ip_hash text;
update public.reports set reference = 'LP-' || upper(substr(md5(id::text), 1, 8)) where reference is null;
update public.reports set reporter_key = coalesce('u:' || reporter_id::text, 'g:' || id::text) where reporter_key is null;
alter table public.reports alter column reference set not null;
alter table public.reports alter column reference set default public.next_report_reference();
create unique index reports_reference_key on public.reports (reference);
create index reports_project_reason_idx on public.reports (project_id, reason, status);
comment on column public.reports.reporter_key is 'Distinct-reporter key: u:<verified account id> or g:<hashed address>. Used only for counting and duplicate grouping.';

-- Signed-in reporters read their own reports (status only is shown in the interface). Owners have no policy: they never see reporters.
create policy reports_own_select on public.reports for select using (reporter_id = auth.uid());

-- Runs with the view owner's rights but only ever returns the caller's own rows (where reporter_id = auth.uid()).
create or replace view public.my_reports_v as
select r.reference, r.reason, r.status, r.created_at, r.handled_at, p.title as project_title, p.slug as project_slug
from public.reports r join public.projects p on p.id = r.project_id
where r.reporter_id = auth.uid();
grant select on public.my_reports_v to authenticated;

-- ---------------------------------------------------------------- 2. decisions and appeals
create table public.moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  action text not null check (action in ('hold', 'hide', 'remove', 'restore', 'dismiss')),
  reason text not null,
  decided_by uuid references public.profiles (id),
  automatic boolean not null default false,
  created_at timestamptz not null default now()
);
create index moderation_decisions_project_idx on public.moderation_decisions (project_id, created_at desc);
alter table public.moderation_decisions enable row level security;
-- Owners read the decisions about their project (never the "dismiss" of a report: that changes nothing for them).
create policy moderation_decisions_owner_select on public.moderation_decisions for select
  using (action <> 'dismiss' and public.is_project_owner(project_id));

create table public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.moderation_decisions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  appellant_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 20 and 1500),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- One appeal per decision, ever: no repeated appeals of the same decision.
create unique index moderation_appeals_one_per_decision on public.moderation_appeals (decision_id);
alter table public.moderation_appeals enable row level security;
create policy moderation_appeals_owner_select on public.moderation_appeals for select
  using (appellant_id = auth.uid() or public.is_project_owner(project_id));

alter table public.projects add column hold_escalated_at timestamptz;

-- The core of every moderation decision. Records the decision, audits it and tells the owners.
-- For an automatic hold the reason is neutral and carries no counts: owners must not learn who or how many reported.
create or replace function public.apply_moderation_core(p_project uuid, p_status public.moderation_status, p_reason text, p_actor uuid, p_auto boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype; r record; v_action text; v_note text; v_decision uuid;
begin
  select * into v from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if v.moderation_status = p_status then
    raise exception 'The project is already %', p_status using errcode = 'P0001';
  end if;
  update public.projects
    set moderation_status = p_status,
        moderation_reason = case when p_status = 'ok' then null else p_reason end,
        moderated_by = p_actor, moderated_at = now(), hold_escalated_at = null
    where id = p_project;
  v_action := case p_status when 'ok' then 'restore' when 'held' then 'hold' when 'hidden' then 'hide' else 'remove' end;
  v_note := case when p_auto then 'Held automatically while the team reviews incoming reports.' else p_reason end;
  insert into public.moderation_decisions (project_id, action, reason, decided_by, automatic)
    values (p_project, v_action, v_note, p_actor, p_auto) returning id into v_decision;
  perform public.write_audit('project.' || case p_status when 'ok' then 'restored' when 'held' then 'held' when 'hidden' then 'hidden' else 'removed' end,
    'project', p_project, p_reason,
    jsonb_build_object('moderation_status', v.moderation_status), jsonb_build_object('moderation_status', p_status, 'automatic', p_auto));
  for r in select profile_id from public.project_members where project_id = p_project and status = 'active' loop
    perform public.notify(r.profile_id, 'moderation',
      jsonb_build_object('project_id', p_project, 'title', v.title, 'slug', v.slug, 'decision_id', v_decision,
                         'action', case p_status when 'ok' then 'restored' when 'held' then 'held' when 'hidden' then 'hidden' else 'removed' end,
                         'automatic', p_auto, 'reason', v_note));
  end loop;
  return v_decision;
end $$;
revoke execute on function public.apply_moderation_core(uuid, public.moderation_status, text, uuid, boolean) from public, anon, authenticated;

-- The admin entry point keeps its signature and now goes through the core.
create or replace function public.apply_moderation(p_project uuid, p_status public.moderation_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.apply_moderation_core(p_project, p_status, p_reason, auth.uid(), false);
end $$;

-- Handling a report: a dismissal is recorded as a decision too (with its reason), but owners are not notified (nothing changed for them).
create or replace function public.admin_handle_report(p_report uuid, p_action text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.reports%rowtype; v_status public.report_status;
begin
  perform public.assert_admin();
  perform public.require_reason(p_note);
  select * into q from public.reports where id = p_report for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  if p_action not in ('dismiss', 'in_review', 'hold', 'hide', 'remove') then
    raise exception 'Unknown action' using errcode = 'P0001';
  end if;
  if q.status in ('resolved', 'dismissed') then
    raise exception 'This report is already closed' using errcode = 'P0001';
  end if;
  if p_action in ('hold', 'hide', 'remove') then
    perform public.apply_moderation(q.project_id,
      case p_action when 'hold' then 'held' when 'hide' then 'hidden' else 'removed' end::public.moderation_status, p_note);
  end if;
  v_status := case p_action when 'dismiss' then 'dismissed' when 'in_review' then 'in_review' else 'resolved' end;
  update public.reports
    set status = v_status, resolution_note = p_note, handled_by = auth.uid(),
        handled_at = case when v_status in ('resolved', 'dismissed') then now() else handled_at end
    where id = p_report;
  if p_action = 'dismiss' then
    insert into public.moderation_decisions (project_id, action, reason, decided_by)
      values (q.project_id, 'dismiss', p_note, auth.uid());
  end if;
  perform public.write_audit('report.' || p_action, 'report', p_report, p_note,
    jsonb_build_object('status', q.status), jsonb_build_object('status', v_status));
end $$;

-- Automatic hold: enough DISTINCT reporters (verified accounts or distinct hashed addresses) for a serious reason.
create or replace function public.evaluate_report_hold(p_project uuid, p_reason public.report_reason) returns boolean
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype; v_threshold int; v_n int;
begin
  if p_reason not in ('copyright', 'personal_data', 'harmful_file') then return false; end if;
  select * into v from public.projects where id = p_project for update;
  if not found or v.status <> 'published' or v.moderation_status <> 'ok' then return false; end if;
  v_threshold := public.setting_int('report_hold_threshold', 3);
  select count(distinct reporter_key) into v_n from public.reports
    where project_id = p_project and reason = p_reason and status in ('open', 'in_review');
  if v_n < v_threshold then return false; end if;
  perform public.apply_moderation_core(p_project, 'held', 'automatic', null, true);
  perform public.write_audit('project.auto_hold', 'project', p_project,
    format('Automatic hold: %s distinct reporters for "%s" (threshold %s).', v_n, p_reason, v_threshold),
    jsonb_build_object('moderation_status', 'ok'), jsonb_build_object('moderation_status', 'held', 'reporters', v_n, 'reason', p_reason));
  perform public.notify(a.id, 'admin_hold', jsonb_build_object('project_id', p_project, 'title', v.title, 'reason', p_reason))
    from public.profiles a where a.is_admin;
  return true;
end $$;
revoke execute on function public.evaluate_report_hold(uuid, public.report_reason) from public, anon, authenticated;

-- Called by the server after the bot check and the rate limits. Service role only.
create or replace function public.submit_report(p_project uuid, p_reason public.report_reason, p_details text, p_evidence text,
                                                p_contact text, p_reporter uuid, p_ip_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.projects%rowtype; v_verified boolean := false; v_key text; v_dup record; v_ref text; v_held boolean;
begin
  select * into v from public.projects where id = p_project;
  if not found or v.status <> 'published' or v.moderation_status not in ('ok', 'held') then
    raise exception 'This project is not available to report' using errcode = 'P0001', hint = 'not_available';
  end if;
  if char_length(trim(coalesce(p_details, ''))) < 10 then
    raise exception 'Tell us a little more' using errcode = 'P0001', hint = 'details_short';
  end if;
  if char_length(trim(p_details)) > 1000 then
    raise exception 'Keep the details under 1000 characters' using errcode = 'P0001', hint = 'details_long';
  end if;
  if coalesce(trim(p_evidence), '') <> '' and (trim(p_evidence) !~* '^https?://[^[:space:]]+$' or char_length(trim(p_evidence)) > 500) then
    raise exception 'The evidence link must start with http:// or https:// and be at most 500 characters' using errcode = 'P0001', hint = 'bad_link';
  end if;
  if p_reporter is not null then
    select (email_confirmed_at is not null) into v_verified from auth.users where id = p_reporter;
    v_verified := coalesce(v_verified, false);
    if exists (select 1 from public.project_members where project_id = p_project and profile_id = p_reporter and status = 'active') then
      raise exception 'You cannot report your own project' using errcode = 'P0001', hint = 'own_project';
    end if;
  end if;
  v_key := case when v_verified then 'u:' || p_reporter::text else 'g:' || coalesce(nullif(p_ip_hash, ''), 'unknown') end;
  -- The same person reporting the same thing again while it is still open changes nothing: they get the same reference.
  select reference into v_dup from public.reports
    where project_id = p_project and reason = p_reason and reporter_key = v_key and status in ('open', 'in_review') limit 1;
  if found then
    return jsonb_build_object('reference', v_dup.reference, 'duplicate', true, 'held', v.moderation_status = 'held');
  end if;
  v_ref := public.next_report_reference();
  insert into public.reports (project_id, reporter_id, reporter_contact, reason, details, evidence_url, reference, reporter_key, ip_hash)
    values (p_project, p_reporter, nullif(trim(coalesce(p_contact, '')), ''), p_reason, trim(p_details),
            nullif(trim(coalesce(p_evidence, '')), ''), v_ref, v_key, p_ip_hash);
  v_held := public.evaluate_report_hold(p_project, p_reason);
  return jsonb_build_object('reference', v_ref, 'duplicate', false, 'held', v_held or v.moderation_status = 'held');
end $$;
revoke execute on function public.submit_report(uuid, public.report_reason, text, text, text, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- appeals
create or replace function public.appeal_decision(p_decision uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare d public.moderation_decisions%rowtype; v_id uuid; v_title text; v_body text := trim(coalesce(p_body, ''));
begin
  perform public.assert_verified();
  select * into d from public.moderation_decisions where id = p_decision;
  if not found or not public.is_project_owner(d.project_id) then
    raise exception 'Only an owner of this project can appeal' using errcode = '42501', hint = 'not_owner';
  end if;
  if d.action not in ('hold', 'hide', 'remove') then
    raise exception 'This decision cannot be appealed' using errcode = 'P0001', hint = 'not_appealable';
  end if;
  if d.id <> (select id from public.moderation_decisions where project_id = d.project_id and action in ('hold', 'hide', 'remove', 'restore')
              order by created_at desc, id desc limit 1) then
    raise exception 'A newer decision replaced this one' using errcode = 'P0001', hint = 'decision_outdated';
  end if;
  if exists (select 1 from public.moderation_appeals where decision_id = p_decision) then
    raise exception 'This decision was already appealed' using errcode = 'P0001', hint = 'appeal_exists';
  end if;
  if char_length(v_body) < 20 then
    raise exception 'Explain your appeal in at least 20 characters' using errcode = 'P0001', hint = 'appeal_short';
  end if;
  if char_length(v_body) > 1500 then
    raise exception 'Keep the appeal under 1500 characters' using errcode = 'P0001', hint = 'appeal_long';
  end if;
  insert into public.moderation_appeals (decision_id, project_id, appellant_id, body) values (p_decision, d.project_id, auth.uid(), v_body)
    returning id into v_id;
  select title into v_title from public.projects where id = d.project_id;
  perform public.notify(a.id, 'admin_appeal', jsonb_build_object('project_id', d.project_id, 'title', v_title, 'appeal_id', v_id))
    from public.profiles a where a.is_admin;
  return v_id;
end $$;

create or replace function public.admin_resolve_appeal(p_appeal uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.moderation_appeals%rowtype; v public.projects%rowtype;
begin
  perform public.assert_admin();
  perform public.require_reason(p_note);
  if p_outcome not in ('accepted', 'rejected') then
    raise exception 'Unknown outcome' using errcode = 'P0001';
  end if;
  select * into a from public.moderation_appeals where id = p_appeal for update;
  if not found then raise exception 'Appeal not found' using errcode = 'P0002'; end if;
  if a.status <> 'open' then raise exception 'This appeal was already decided' using errcode = 'P0001'; end if;
  select * into v from public.projects where id = a.project_id;
  update public.moderation_appeals set status = p_outcome, resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now() where id = p_appeal;
  if p_outcome = 'accepted' and v.moderation_status <> 'ok' then
    perform public.apply_moderation_core(a.project_id, 'ok', p_note, auth.uid(), false);
  end if;
  perform public.write_audit('appeal.' || p_outcome, 'appeal', p_appeal, p_note,
    jsonb_build_object('status', 'open'), jsonb_build_object('status', p_outcome));
  perform public.notify(a.appellant_id, 'appeal_outcome',
    jsonb_build_object('project_id', a.project_id, 'title', v.title, 'slug', v.slug, 'outcome', p_outcome, 'note', p_note));
end $$;

create or replace view public.admin_appeals_v as
select a.id, a.project_id, p.title as project_title, p.slug as project_slug, p.moderation_status,
       d.action as decision_action, d.reason as decision_reason, d.automatic as decision_automatic,
       pr.full_name as appellant_name, a.body, a.status, a.resolution_note, a.created_at, a.resolved_at
from public.moderation_appeals a
join public.moderation_decisions d on d.id = a.decision_id
join public.projects p on p.id = a.project_id
join public.profiles pr on pr.id = a.appellant_id
where public.is_admin();
grant select on public.admin_appeals_v to authenticated;

-- ---------------------------------------------------------------- 3. held projects
-- A neutral public check: is this slug a published project that is being held? (No reason, no title.)
create or replace function public.is_project_held(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where slug = p_slug and status = 'published' and moderation_status = 'held')
$$;
grant execute on function public.is_project_held(text) to anon, authenticated;

-- Holds must be reviewed within the review target (default 3 days) or the admins are alerted once. Service role; scheduling is R7.
create or replace function public.escalate_overdue_holds() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select id, title from public.projects
    where moderation_status = 'held' and hold_escalated_at is null
      and moderated_at < now() - make_interval(days => public.setting_int('hold_review_days', 3))
    for update
  loop
    update public.projects set hold_escalated_at = now() where id = r.id;
    perform public.notify(a.id, 'admin_hold_overdue', jsonb_build_object('project_id', r.id, 'title', r.title))
      from public.profiles a where a.is_admin;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.escalate_overdue_holds() from public, anon, authenticated;

-- ---------------------------------------------------------------- 5. settings
create or replace function public.admin_update_setting(p_key text, p_value jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_key not in ('allowed_email_domains', 'max_upload_mb', 'synthesis_daily_cap', 'show_demo_banner', 'registrations_open',
                   'contact_email', 'request_expiry_days', 'reapply_cooldown_days', 'report_hold_threshold', 'hold_review_days') then
    raise exception 'Unknown setting' using errcode = 'P0001';
  end if;
  select value into v_before from public.app_settings where key = p_key;
  insert into public.app_settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.write_audit('setting.update', 'setting', null, p_reason,
    jsonb_build_object('key', p_key, 'value', v_before), jsonb_build_object('key', p_key, 'value', p_value));
end $$;

-- ---------------------------------------------------------------- policies (versioned re-acceptance)
-- Publishing a new version makes everyone accept it again (has_current_policies compares to the newest version).
create or replace function public.admin_publish_policy(p_kind public.policy_kind, p_version integer, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_version <= coalesce(public.current_policy_version(p_kind), 0) then
    raise exception 'The new version must be higher than the current one' using errcode = 'P0001', hint = 'version_not_higher';
  end if;
  insert into public.policies (kind, version, effective_at) values (p_kind, p_version, now());
  perform public.write_audit('policy.publish', 'policy', null, p_reason,
    jsonb_build_object('kind', p_kind), jsonb_build_object('kind', p_kind, 'version', p_version));
end $$;

-- ---------------------------------------------------------------- 4. account privacy
create table public.account_deletions (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  cancelled_at timestamptz,
  completed_at timestamptz
);
alter table public.account_deletions enable row level security;
create policy account_deletions_own_select on public.account_deletions for select using (profile_id = auth.uid());

-- Starts the 30 day grace period. Asking again while one is waiting keeps the same date.
create or replace function public.request_account_deletion() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_when timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501', hint = 'sign_in'; end if;
  select scheduled_for into v_when from public.account_deletions
    where profile_id = auth.uid() and cancelled_at is null and completed_at is null;
  if found then return v_when; end if;
  v_when := now() + interval '30 days';
  insert into public.account_deletions (profile_id, requested_at, scheduled_for) values (auth.uid(), now(), v_when)
    on conflict (profile_id) do update set requested_at = now(), scheduled_for = v_when, cancelled_at = null, completed_at = null;
  return v_when;
end $$;

create or replace function public.cancel_account_deletion() returns void
language sql security definer set search_path = public as $$
  update public.account_deletions set cancelled_at = now()
  where profile_id = auth.uid() and cancelled_at is null and completed_at is null
$$;

-- The person's own data as JSON (portability). Other people's personal data and file contents are not included.
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501', hint = 'sign_in'; end if;
  select jsonb_build_object(
    'exported_at', now(),
    'note', 'Your own data. Other people''s personal data and the contents of uploaded files are not included.',
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'email_confirmed_at', u.email_confirmed_at, 'created_at', u.created_at)
                from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) - 'suspended_reason' from public.profiles p where p.id = uid),
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'summary', p.summary,
                 'status', p.status, 'role', m.role, 'membership', m.status, 'consented_at', m.consented_at, 'created_at', p.created_at))
                 from public.project_members m join public.projects p on p.id = m.project_id where m.profile_id = uid), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('project_id', i.project_id, 'kind', i.kind, 'title', i.title,
                 'description', i.description, 'review_status', i.review_status, 'origin', i.origin))
                 from public.draft_items i where i.project_id in (select project_id from public.project_members where profile_id = uid and status = 'active')), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('project_id', f.project_id, 'name', f.original_name, 'kind', f.kind, 'size_bytes', f.size_bytes))
                 from public.project_files f where f.project_id in (select project_id from public.project_members where profile_id = uid and status = 'active')), '[]'::jsonb),
    'requests_sent', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'project_id', r.project_id, 'team', r.adopter_team_name, 'plan', r.plan,
                 'purpose', r.purpose, 'status', r.status, 'created_at', r.created_at)) from public.continuation_requests r where r.created_by = uid), '[]'::jsonb),
    'access', coalesce((select jsonb_agg(jsonb_build_object('project_id', a.project_id, 'source', a.source, 'status', a.status,
                 'agreement_version', a.agreement_version, 'accepted_at', a.accepted_at, 'revoked_at', a.revoked_at)) from public.project_access a where a.profile_id = uid), '[]'::jsonb),
    'agreements', coalesce((select jsonb_agg(jsonb_build_object('request_id', g.request_id, 'side', g.side, 'agreement_version', g.agreement_version, 'accepted_at', g.accepted_at))
                 from public.agreement_acceptances g where g.profile_id = uid), '[]'::jsonb),
    'policy_acceptances', coalesce((select jsonb_agg(jsonb_build_object('kind', k.kind, 'version', k.version, 'accepted_at', k.accepted_at))
                 from public.policy_acceptances k where k.profile_id = uid), '[]'::jsonb),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('reference', r.reference, 'reason', r.reason, 'details', r.details,
                 'evidence_url', r.evidence_url, 'status', r.status, 'created_at', r.created_at)) from public.reports r where r.reporter_id = uid), '[]'::jsonb),
    'watching', coalesce((select jsonb_agg(p.slug) from public.project_watchers w join public.projects p on p.id = w.project_id where w.profile_id = uid), '[]'::jsonb),
    'appeals', coalesce((select jsonb_agg(jsonb_build_object('project_id', a.project_id, 'body', a.body, 'status', a.status, 'created_at', a.created_at))
                 from public.moderation_appeals a where a.appellant_id = uid), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('type', n.type, 'payload', n.payload, 'created_at', n.created_at, 'read_at', n.read_at))
                 from (select * from public.notifications where user_id = uid order by created_at desc limit 200) n), '[]'::jsonb),
    'deletion', (select to_jsonb(d) - 'profile_id' from public.account_deletions d where d.profile_id = uid)
  ) into result;
  return result;
end $$;

-- The database part of finishing a deletion (service role). The server then removes files of deleted drafts and closes the login.
-- What happens: pending requests are withdrawn, access is ended, watchers and notifications go, reports lose their reporter link,
-- sole-owned DRAFT projects are listed for deletion, the profile becomes "Pengguna lama". Published projects, lineage entries and
-- agreements stay, with the owner shown as "Pengguna lama", so the people who continued a project keep their attribution lines.
create or replace function public.anonymize_deleted_account(p_profile uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_drafts uuid[];
begin
  if not exists (select 1 from public.account_deletions where profile_id = p_profile and cancelled_at is null and completed_at is null
                 and scheduled_for <= now()) then
    raise exception 'No deletion is due for this account' using errcode = 'P0001', hint = 'not_due';
  end if;
  update public.continuation_requests set status = 'withdrawn', decided_at = coalesce(decided_at, now())
    where created_by = p_profile and status = 'pending';
  update public.project_access set status = 'revoked', revoked_at = now(), revoked_reason = 'The account was deleted.'
    where profile_id = p_profile and status = 'active';
  delete from public.project_watchers where profile_id = p_profile;
  delete from public.notifications where user_id = p_profile;
  update public.reports set reporter_id = null, reporter_contact = null where reporter_id = p_profile;
  select coalesce(array_agg(p.id), '{}') into v_drafts
    from public.projects p
    where p.status = 'draft'
      and exists (select 1 from public.project_members m where m.project_id = p.id and m.profile_id = p_profile and m.status = 'active')
      and not exists (select 1 from public.project_members m where m.project_id = p.id and m.profile_id <> p_profile and m.status = 'active');
  update public.profiles set full_name = 'Pengguna lama', university = '', faculty = null, study_program = null, avatar_url = null
    where id = p_profile;
  update public.account_deletions set completed_at = now() where profile_id = p_profile;
  return jsonb_build_object('draft_projects', to_jsonb(v_drafts));
end $$;
revoke execute on function public.anonymize_deleted_account(uuid) from public, anon, authenticated;

create or replace function public.due_account_deletions() returns table (profile_id uuid)
language sql stable security definer set search_path = public as $$
  select d.profile_id from public.account_deletions d where d.cancelled_at is null and d.completed_at is null and d.scheduled_for <= now()
$$;
revoke execute on function public.due_account_deletions() from public, anon, authenticated;

-- ---------------------------------------------------------------- grants
grant execute on function public.appeal_decision(uuid, text), public.request_account_deletion(), public.cancel_account_deletion(),
  public.export_my_data() to authenticated;
revoke execute on function public.appeal_decision(uuid, text), public.request_account_deletion(), public.cancel_account_deletion(),
  public.export_my_data() from anon;
