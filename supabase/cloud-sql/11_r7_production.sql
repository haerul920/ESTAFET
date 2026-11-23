-- ESTAFET database, step 11 of 12: r7_production.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 10 succeeded.
-- Generated from supabase/migrations/20261125000001_r7_production.sql. Do not edit by hand.

-- R7: production readiness.
--   1. profiles: email notification preference and language (for the language of emails)
--   2. email_outbox: every email waits here until the sender (a scheduled job) delivers it, with retries
--   3. enqueue_emails(): turns notifications and report outcomes into outbox rows, honouring preferences
--   4. claim_emails() and finish_email(): the sender's two calls (service role only)
--   5. housekeeping(): removes old outbox rows and old rate limit rows
--   6. set_email_preferences(): a person changes their own preference and language
-- Everything is added. There is no destructive change. To undo: drop the objects above and the two profile columns.

-- ---------------------------------------------------------------- 1. profiles
alter table public.profiles
  add column if not exists email_notifications boolean not null default true,
  add column if not exists locale text not null default 'id';

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check check (locale in ('id', 'en'));

-- ---------------------------------------------------------------- 2. outbox
-- The address is NOT stored here. The sender looks it up when it delivers, so a changed address is respected
-- and a deleted account leaves no address behind.
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  dedupe_key text not null unique,
  template text not null,
  locale text not null default 'id' check (locale in ('id', 'en')),
  payload jsonb not null default '{}'::jsonb,
  essential boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_outbox_due_idx on public.email_outbox (next_attempt_at) where status in ('pending', 'sending');
create index if not exists email_outbox_status_idx on public.email_outbox (status, created_at desc);

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ---------------------------------------------------------------- 3. enqueue
-- Which notifications become an email. "Essential" ones (safety and account) ignore the person's preference;
-- the rest are marked `skipped` when the person turned email off. Only the last 3 days are looked at, so switching
-- this on never sends a flood of old news.
create or replace function public.enqueue_emails() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; c integer;
begin
  insert into public.email_outbox (user_id, dedupe_key, template, locale, payload, essential, status)
  select nt.user_id, 'n:' || nt.id, nt.type, p.locale, nt.payload,
         nt.type in ('moderation', 'appeal_outcome', 'access_revoked', 'admin_hold', 'admin_hold_overdue', 'admin_appeal'),
         case when p.email_notifications
                   or nt.type in ('moderation', 'appeal_outcome', 'access_revoked', 'admin_hold', 'admin_hold_overdue', 'admin_appeal')
              then 'pending' else 'skipped' end
  from public.notifications nt
  join public.profiles p on p.id = nt.user_id
  where nt.created_at > now() - interval '3 days'
    and nt.type in ('new_request', 'request_decision', 'agreement_accepted', 'moderation', 'appeal_outcome',
                    'access_revoked', 'team_invite', 'ownership_offer', 'admin_hold', 'admin_hold_overdue', 'admin_appeal')
  on conflict (dedupe_key) do nothing;
  get diagnostics c = row_count;
  n := n + c;

  -- The reporter hears the outcome of their own report (signed-in reporters only). Guests left no address.
  insert into public.email_outbox (user_id, dedupe_key, template, locale, payload, essential, status)
  select r.reporter_id, 'r:' || r.id || ':' || r.status, 'report_outcome', p.locale,
         jsonb_build_object('reference', r.reference, 'outcome', r.status::text), false,
         case when p.email_notifications then 'pending' else 'skipped' end
  from public.reports r
  join public.profiles p on p.id = r.reporter_id
  where r.status in ('resolved', 'dismissed')
    and r.handled_at > now() - interval '3 days'
  on conflict (dedupe_key) do nothing;
  get diagnostics c = row_count;
  return n + c;
end $$;

-- ---------------------------------------------------------------- 4. sender calls
-- Hands out due rows and marks them `sending`. A row stuck in `sending` for 10 minutes (the sender crashed) is handed out again.
create or replace function public.claim_emails(p_limit integer default 25) returns setof public.email_outbox
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select id from public.email_outbox
    where (status = 'pending' and next_attempt_at <= now())
       or (status = 'sending' and next_attempt_at <= now() - interval '10 minutes')
    order by next_attempt_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, next_attempt_at = now()
    from due
   where o.id = due.id
  returning o.*;
end $$;

-- Records the result. A failure is retried with a growing delay (5, 15, 45, 135 minutes) and is final after 5 attempts.
-- `p_error` is a short code or class name, never the address or the message text.
create or replace function public.finish_email(p_id uuid, p_ok boolean, p_error text default null) returns text
language plpgsql security definer set search_path = public as $$
declare o public.email_outbox%rowtype; v_status text;
begin
  select * into o from public.email_outbox where id = p_id for update;
  if not found then return 'missing'; end if;
  if p_ok then
    update public.email_outbox set status = 'sent', sent_at = now(), last_error = null where id = p_id;
    return 'sent';
  end if;
  v_status := case when o.attempts >= 5 then 'failed' else 'pending' end;
  update public.email_outbox
     set status = v_status,
         last_error = left(coalesce(p_error, 'error'), 120),
         next_attempt_at = now() + (interval '5 minutes' * power(3, greatest(o.attempts - 1, 0)))
   where id = p_id;
  return v_status;
end $$;

-- ---------------------------------------------------------------- 5. housekeeping
create or replace function public.housekeeping() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_mail integer; v_rate integer;
begin
  delete from public.email_outbox where status in ('sent', 'skipped') and created_at < now() - interval '90 days';
  get diagnostics v_mail = row_count;
  delete from public.rate_limit_hits where created_at < now() - interval '2 days';
  get diagnostics v_rate = row_count;
  return jsonb_build_object('emails_removed', v_mail, 'rate_hits_removed', v_rate);
end $$;

-- ---------------------------------------------------------------- 6. a person's own preference
create or replace function public.set_email_preferences(p_enabled boolean, p_locale text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501', hint = 'sign_in'; end if;
  update public.profiles
     set email_notifications = coalesce(p_enabled, email_notifications),
         locale = case when p_locale in ('id', 'en') then p_locale else locale end
   where id = auth.uid();
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.enqueue_emails() from public, anon, authenticated;
revoke execute on function public.claim_emails(integer) from public, anon, authenticated;
revoke execute on function public.finish_email(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.housekeeping() from public, anon, authenticated;
grant execute on function public.enqueue_emails() to service_role;
grant execute on function public.claim_emails(integer) to service_role;
grant execute on function public.finish_email(uuid, boolean, text) to service_role;
grant execute on function public.housekeeping() to service_role;
revoke execute on function public.set_email_preferences(boolean, text) from public, anon;
grant execute on function public.set_email_preferences(boolean, text) to authenticated;
