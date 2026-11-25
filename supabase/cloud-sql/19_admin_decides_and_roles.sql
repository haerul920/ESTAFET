-- ESTAFET database, step 19 of 24: admin_decides_and_roles.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it ALONE, after step 18 succeeded.
-- Generated from supabase/migrations/20261129000001_admin_decides_and_roles.sql. Do not edit by hand.

-- Reports never change a project on their own: an admin looks and decides (CLAUDE.md 15.30).
-- The automatic hold is switched off. submit_report() still calls this function, which now does nothing.
create or replace function public.evaluate_report_hold(p_project uuid, p_reason public.report_reason) returns boolean
language sql stable security definer set search_path = public as $$
  select false
$$;
revoke execute on function public.evaluate_report_hold(uuid, public.report_reason) from public, anon, authenticated;

-- Admins can give and take the admin role from the Users page (CLAUDE.md 15.31, replaces the rule in 13.4).
-- Same safeguards as other sensitive actions: admin only, a written reason, audited in the same transaction.
-- The server also asks for the password again. Nobody can change their own role, and the profiles trigger still
-- protects the last admin.
create function public.admin_set_role(p_user uuid, p_admin boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.profiles%rowtype;
begin
  -- One role change at a time, checked after the wait: two admins cannot remove each other at the same moment.
  perform pg_advisory_xact_lock(hashtext('estafet.admin_role'));
  perform public.assert_admin();
  perform public.require_reason(p_reason);
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = 'P0001', hint = 'own_role';
  end if;
  select * into v from public.profiles where id = p_user for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if v.is_admin = p_admin then
    raise exception 'This account already has that role' using errcode = 'P0001', hint = 'same_role';
  end if;
  if p_admin and public.is_suspended(p_user) then
    raise exception 'A suspended account cannot become an admin' using errcode = 'P0001', hint = 'role_suspended';
  end if;
  update public.profiles set is_admin = p_admin where id = p_user;
  perform public.write_audit(case when p_admin then 'user.promote' else 'user.demote' end, 'user', p_user, p_reason,
    jsonb_build_object('is_admin', v.is_admin), jsonb_build_object('is_admin', p_admin));
end $$;
revoke execute on function public.admin_set_role(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_role(uuid, boolean, text) to authenticated;
