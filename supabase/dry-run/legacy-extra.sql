-- Extra rows in the PRE-R1 shape, so the R1 backfill has something real to move.
-- Runs after legacy-seed.sql, before the R1 migrations. Synthetic demo data only.

-- A second creator on the Mangrove project (the alumni account).
insert into public.project_members (project_id, profile_id, role, consented_at)
values ('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'creator', now());

-- Fish Freshness: request 2 was approved and fully signed (creator side + two adopter-side people), so it is unlocked.
update public.continuation_requests set status = 'approved', decided_by = 'd0000000-0000-4000-8000-000000000001', decided_at = now() - interval '1 day'
  where id = 'e0000000-0000-4000-8000-000000000002';
insert into public.agreement_acceptances (request_id, profile_id, side, agreement_version) values
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'creator', 1),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'adopter', 1),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'adopter', 1);
insert into public.project_members (project_id, profile_id, role, consented_at)
  values ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'adopter', now());
update public.projects set status = 'adopted' where id = 'b0000000-0000-4000-8000-000000000003';

-- Mangrove: request 1 was approved but only the creator side signed, so it is NOT unlocked.
update public.continuation_requests set status = 'approved', decided_by = 'c0000000-0000-4000-8000-000000000001', decided_at = now()
  where id = 'e0000000-0000-4000-8000-000000000001';
insert into public.agreement_acceptances (request_id, profile_id, side, agreement_version)
  values ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'creator', 1);

-- A third, still pending request (to check the expiry backfill).
insert into public.continuation_requests (id, project_id, adopter_team_name, members, task_ids, plan, purpose, created_by, created_at)
values ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'Old Team', '[]'::jsonb,
  array(select id from public.draft_items where project_id = 'b0000000-0000-4000-8000-000000000004' and kind = 'next_task' limit 1),
  'An old pending request that was sent before R1 shipped, long enough to be a real plan.', 'course',
  'a0000000-0000-4000-8000-000000000001', now() - interval '40 days');
