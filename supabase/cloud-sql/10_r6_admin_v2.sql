-- ESTAFET database, step 10 of 11: r6_admin_v2.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 09 succeeded.
-- Generated from supabase/migrations/20261124000001_r6_admin_v2.sql. Do not edit by hand.

-- R6: admin panel v2.
--  * site-wide announcements (localized, with start and end time) and the public read of the active ones
--  * bulk dismissal of obvious spam reports
--  * policy versions with acceptance rates
--  * a fuller overview (queues, key numbers) without the removed advisor counters
--
-- Run this file alone. Every admin write goes through an admin_* function that writes the change and the audit row together.

-- ---------------------------------------------------------------- 1. announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  text_id text not null check (char_length(text_id) between 3 and 280),
  text_en text not null check (char_length(text_en) between 3 and 280),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  dismissible boolean not null default true,
  ended_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.announcements enable row level security;
-- No policies on purpose: the table is read through active_announcements() and the admin view only.
revoke all on public.announcements from anon, authenticated;

-- What visitors see: only announcements that are running right now, no author.
create or replace function public.active_announcements()
returns table (id uuid, severity text, text_id text, text_en text, dismissible boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.severity, a.text_id, a.text_en, a.dismissible
  from public.announcements a
  where a.ended_at is null and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())
  order by case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end, a.starts_at desc
  limit 3
$$;
grant execute on function public.active_announcements() to anon, authenticated;

create or replace view public.admin_announcements_v as
select a.id, a.severity, a.text_id, a.text_en, a.starts_at, a.ends_at, a.dismissible, a.ended_at, a.created_at,
       pr.full_name as author_name,
       case when a.ended_at is not null then 'ended'
            when a.starts_at > now() then 'scheduled'
            when a.ends_at is not null and a.ends_at <= now() then 'expired'
            else 'live' end as state
from public.announcements a
left join public.profiles pr on pr.id = a.created_by
where public.is_admin();
grant select on public.admin_announcements_v to authenticated;

create or replace function public.admin_save_announcement(
  p_id uuid, p_severity text, p_text_id text, p_text_en text, p_starts timestamptz, p_ends timestamptz,
  p_dismissible boolean, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_before jsonb;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_severity not in ('info', 'warning', 'critical') then
    raise exception 'Unknown severity' using errcode = 'P0001';
  end if;
  if p_ends is not null and p_ends <= coalesce(p_starts, now()) then
    raise exception 'The end must be after the start' using errcode = 'P0001', hint = 'bad_range';
  end if;
  if p_id is null then
    insert into public.announcements (severity, text_id, text_en, starts_at, ends_at, dismissible, created_by)
      values (p_severity, trim(p_text_id), trim(p_text_en), coalesce(p_starts, now()), p_ends, coalesce(p_dismissible, true), auth.uid())
      returning id into v_id;
    perform public.write_audit('announcement.create', 'announcement', v_id, p_reason, null,
      jsonb_build_object('severity', p_severity, 'starts_at', coalesce(p_starts, now()), 'ends_at', p_ends));
  else
    select to_jsonb(a) - 'created_by' into v_before from public.announcements a where a.id = p_id for update;
    if v_before is null then raise exception 'Announcement not found' using errcode = 'P0002'; end if;
    update public.announcements
      set severity = p_severity, text_id = trim(p_text_id), text_en = trim(p_text_en),
          starts_at = coalesce(p_starts, starts_at), ends_at = p_ends, dismissible = coalesce(p_dismissible, dismissible),
          updated_at = now()
      where id = p_id;
    perform public.write_audit('announcement.update', 'announcement', p_id, p_reason, v_before,
      jsonb_build_object('severity', p_severity, 'starts_at', coalesce(p_starts, (v_before ->> 'starts_at')::timestamptz), 'ends_at', p_ends));
  end if;
  return v_id;
end $$;

create or replace function public.admin_end_announcement(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.announcements%rowtype;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  select * into a from public.announcements where id = p_id for update;
  if not found then raise exception 'Announcement not found' using errcode = 'P0002'; end if;
  if a.ended_at is not null then raise exception 'This announcement already ended' using errcode = 'P0001'; end if;
  update public.announcements set ended_at = now(), updated_at = now() where id = p_id;
  perform public.write_audit('announcement.end', 'announcement', p_id, p_reason,
    jsonb_build_object('ended', false), jsonb_build_object('ended', true));
end $$;

-- ---------------------------------------------------------------- 2. bulk dismissal of obvious spam
-- Only reports with the reason "spam" that are still open or in review. Up to 50 at once. Each report is audited on its own.
create or replace function public.admin_bulk_dismiss_spam(p_ids uuid[], p_note text) returns integer
language plpgsql security definer set search_path = public as $$
declare r public.reports%rowtype; v_id uuid; n int := 0;
begin
  perform public.assert_admin();
  perform public.require_reason(p_note);
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if array_length(p_ids, 1) > 50 then
    raise exception 'Select at most 50 reports' using errcode = 'P0001', hint = 'too_many';
  end if;
  foreach v_id in array p_ids loop
    select * into r from public.reports where id = v_id for update;
    if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
    if r.reason <> 'spam' then
      raise exception 'Only spam reports can be dismissed in bulk' using errcode = 'P0001', hint = 'not_spam';
    end if;
    if r.status in ('open', 'in_review') then
      perform public.admin_handle_report(v_id, 'dismiss', p_note);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- 3. policy versions with acceptance rates
create or replace view public.admin_policies_v as
select p.id, p.kind, p.version, p.effective_at, p.created_at,
       (select count(*) from public.policy_acceptances a where a.kind = p.kind and a.version = p.version)::int as accepted,
       (select count(*) from public.profiles pr where pr.full_name <> 'Pengguna lama')::int as people,
       (p.version = public.current_policy_version(p.kind)) as is_current
from public.policies p
where public.is_admin();
grant select on public.admin_policies_v to authenticated;

-- ---------------------------------------------------------------- 4. a fuller overview
create or replace function public.admin_overview(p_include_demo boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'open_reports', (select count(*) from public.reports r join public.projects p on p.id = r.project_id
                     where r.status in ('open', 'in_review') and (p_include_demo or not p.is_demo)),
    'new_reports_24h', (select count(*) from public.reports r join public.projects p on p.id = r.project_id
                        where r.created_at > now() - interval '24 hours' and (p_include_demo or not p.is_demo)),
    'held_projects', (select count(*) from public.projects p where p.moderation_status = 'held' and (p_include_demo or not p.is_demo)),
    'overdue_holds', (select count(*) from public.projects p where p.moderation_status = 'held'
                      and p.moderated_at < now() - make_interval(days => public.setting_int('hold_review_days', 3))
                      and (p_include_demo or not p.is_demo)),
    'hidden_projects', (select count(*) from public.projects p where p.moderation_status in ('hidden', 'removed') and (p_include_demo or not p.is_demo)),
    'open_appeals', (select count(*) from public.moderation_appeals a join public.projects p on p.id = a.project_id
                     where a.status = 'open' and (p_include_demo or not p.is_demo)),
    'failed_runs_24h', (select count(*) from public.synthesis_runs s join public.projects p on p.id = s.project_id
                        where s.status = 'failed' and s.created_at > now() - interval '24 hours' and (p_include_demo or not p.is_demo)),
    'stale_requests', (select count(*) from public.continuation_requests r join public.projects p on p.id = r.project_id
                       where r.status = 'pending' and r.created_at < now() - interval '7 days' and (p_include_demo or not p.is_demo)),
    'projects_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                           (select status, count(*) n from public.projects p where p_include_demo or not p.is_demo group by status) s),
    'projects_by_moderation', (select coalesce(jsonb_object_agg(moderation_status, n), '{}'::jsonb) from
                           (select moderation_status, count(*) n from public.projects p where p_include_demo or not p.is_demo group by moderation_status) s),
    'access_by_mode', (select coalesce(jsonb_object_agg(access_mode, n), '{}'::jsonb) from
                           (select access_mode, count(*) n from public.projects p
                            where p.status = 'published' and (p_include_demo or not p.is_demo) group by access_mode) s),
    'requests_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                           (select r.status, count(*) n from public.continuation_requests r join public.projects p on p.id = r.project_id
                            where p_include_demo or not p.is_demo group by r.status) s),
    'reports_by_reason', (select coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) from
                           (select r.reason, count(*) n from public.reports r join public.projects p on p.id = r.project_id
                            where p_include_demo or not p.is_demo group by r.reason) s),
    'reports_by_outcome', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                           (select r.status, count(*) n from public.reports r join public.projects p on p.id = r.project_id
                            where p_include_demo or not p.is_demo group by r.status) s),
    'median_days_to_publish', (select round((percentile_cont(0.5) within group
                                  (order by extract(epoch from (p.published_at - p.created_at)) / 86400))::numeric, 1)
                               from public.projects p where p.published_at is not null and (p_include_demo or not p.is_demo)),
    'users_total', (select count(*) from public.profiles),
    'users_suspended', (select count(*) from public.profiles pr where public.is_suspended(pr.id)),
    'demo_projects', (select count(*) from public.projects where is_demo)
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------- grants
grant execute on function public.admin_save_announcement(uuid, text, text, text, timestamptz, timestamptz, boolean, text),
  public.admin_end_announcement(uuid, text), public.admin_bulk_dismiss_spam(uuid[], text) to authenticated;
revoke execute on function public.admin_save_announcement(uuid, text, text, text, timestamptz, timestamptz, boolean, text),
  public.admin_end_announcement(uuid, text), public.admin_bulk_dismiss_spam(uuid[], text) from anon;
-- ---------------------------------------------------------------- 5. force sign out
-- Ends every session of a person (their refresh tokens go with the sessions). An access token that was already issued stays valid until
-- it expires, which is at most an hour. An admin cannot do this to themselves.
create or replace function public.admin_force_sign_out(p_user uuid, p_reason text) returns integer
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_user = auth.uid() then
    raise exception 'You cannot sign yourself out here' using errcode = 'P0001', hint = 'self_action';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  delete from auth.sessions where user_id = p_user;
  get diagnostics n = row_count;
  perform public.write_audit('user.force_sign_out', 'user', p_user, p_reason, null, jsonb_build_object('sessions_ended', n));
  return n;
end $$;
grant execute on function public.admin_force_sign_out(uuid, text) to authenticated;
revoke execute on function public.admin_force_sign_out(uuid, text) from anon;
