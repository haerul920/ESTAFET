-- R9: admin email log (PROMPTS_RELEASE.md, R6 item 10).
--   1. admin_email_log_v: a read-only view of the outbox for admins. Like the outbox, it holds NO email address and
--      no message text: template, language, status, attempts, the short error code, times and the recipient's name.
--   2. admin_resend_email(): puts a FAILED, ESSENTIAL email back in the queue, with a reason and an audit row.
-- Bounces are not tracked: no provider webhook exists yet, so the log can only say what the provider accepted.
-- Additive only. Rollback: drop function public.admin_resend_email(uuid, text); drop view public.admin_email_log_v;

-- ---------------------------------------------------------------- 1. view
create or replace view public.admin_email_log_v as
select o.id, o.template, o.locale, o.essential, o.status, o.attempts, o.last_error,
       o.created_at, o.sent_at, o.next_attempt_at, o.user_id,
       p.full_name as recipient_name,
       case when o.dedupe_key like 'r:%' then 'report' else 'notification' end as source
from public.email_outbox o
join public.profiles p on p.id = o.user_id
where public.is_admin();

revoke all on public.admin_email_log_v from anon;
grant select on public.admin_email_log_v to authenticated;

-- ---------------------------------------------------------------- 2. send again
-- Only essential emails (moderation, appeal outcome, revoked access, admin alerts) that ended as `failed`.
-- The row is queued again with a fresh set of 5 attempts; the next run of /api/cron/emails picks it up.
create or replace function public.admin_resend_email(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.email_outbox%rowtype;
begin
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  select * into o from public.email_outbox where id = p_id for update;
  if not found then
    raise exception 'Email not found' using errcode = 'P0002', hint = 'email_not_found';
  end if;
  if not o.essential or o.status <> 'failed' then
    raise exception 'Only a failed essential email can be sent again' using errcode = 'P0001', hint = 'email_not_resendable';
  end if;
  update public.email_outbox
     set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
   where id = p_id;
  perform public.write_audit('email.resend', 'email', p_id, p_reason,
    jsonb_build_object('template', o.template, 'status', o.status, 'attempts', o.attempts, 'last_error', o.last_error),
    jsonb_build_object('status', 'pending', 'attempts', 0));
end $$;

revoke all on function public.admin_resend_email(uuid, text) from public, anon;
grant execute on function public.admin_resend_email(uuid, text) to authenticated;
