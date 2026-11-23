-- OPTIONAL. Demo data for trying the product: 3 demo accounts, 8 projects, items, requests. Every row is marked is_demo = true.
-- Do NOT run this on a project that real people use. Run it after the last numbered step, and only if you want the demo.

-- ESTAFET demo seed. ALL data here is synthetic and labeled is_demo = true.
-- Names are fictional. Demo password for every demo account: Demo-Pass-2026!
-- Private files for the demo projects are uploaded by `pnpm seed:storage` (see README).

-- ---------------------------------------------------------------------------
-- Demo users (GoTrue-compatible rows). The on_auth_user_created trigger creates the profiles.
-- Accounts that already exist are kept, so the seed can run again after "Purge demo data" (which keeps the accounts).
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in select * from (values
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'creator@estafet.demo', 'Demo Creator', 'Forestry', 'Forest Management'),
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'adopter@estafet.demo', 'Demo Adopter', 'Marine Science and Fisheries', 'Marine Science'),
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'alumni@estafet.demo', 'Demo Alumni', 'Engineering', 'Informatics')
  ) as t(id, email, full_name, faculty, program)
  loop
    continue when exists (select 1 from auth.users where id = u.id or email = u.email);
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Demo-Pass-2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.full_name, 'faculty', u.faculty, 'study_program', u.program),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Demo projects. The creator owns 1, 7, 8. The alumni account owns 2 to 6.
-- ---------------------------------------------------------------------------
insert into public.projects
  (id, slug, title, summary, kind, field, year, stop_reason, status, created_by, is_demo, published_at, stopped_note, tech, team_size)
values
  ('b0000000-0000-4000-8000-000000000001', 'mangrove-cover-classifier', 'Mangrove Cover Classifier',
   'A model that classifies mangrove cover from drone images, meant to help coastal teams monitor change between seasons. The team built the data pipeline and a first baseline, then stopped after the first funding review.',
   'research', 'Forestry', 2025, 'funding_not_granted', 'published',
   'c0000000-0000-4000-8000-000000000001', true, now() - interval '3 days',
   'Funding was not granted after the first review. Reviewers asked for a clearer sampling plan.',
   array['Python', 'Drone imagery', 'Image segmentation'], 3),
  ('b0000000-0000-4000-8000-000000000002', 'campus-waste-sorting-assistant', 'Campus Waste Sorting Assistant',
   'A phone app that suggests the right bin from a photo of an item.',
   'hackathon', 'Engineering', 2025, 'team_graduated', 'published',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '12 days',
   'The core team graduated before the app could be tested with real campus bins.',
   array['Flutter', 'Image classification', 'TensorFlow Lite'], 4),
  ('b0000000-0000-4000-8000-000000000003', 'fish-freshness-indicator', 'Fish Freshness Indicator',
   'Estimates freshness from a smartphone photo of the fish eye.',
   'student_program', 'Marine Science and Fisheries', 2024, 'funding_not_granted', 'published',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '20 days',
   'The program did not renew funding, so the field validation never happened.',
   array['Python', 'Color analysis', 'Smartphone photos'], 3),
  ('b0000000-0000-4000-8000-000000000004', 'village-clinic-queue-tracker', 'Village Clinic Queue Tracker',
   'Shows patients a live queue number for a community health post.',
   'student_program', 'Public Health', 2024, 'time_or_people', 'published',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '25 days',
   'The team could not keep up with clinic visits and coursework at the same time.',
   array['Next.js', 'SMS gateway', 'Postgres'], 4),
  ('b0000000-0000-4000-8000-000000000005', 'study-group-matcher', 'Study Group Matcher',
   'Pairs students by course and free time slots.',
   'hackathon', 'Engineering', 2025, 'time_or_people', 'published',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '30 days',
   'Only two of five teammates stayed after the hackathon weekend.',
   array['TypeScript', 'Constraint matching'], 5),
  ('b0000000-0000-4000-8000-000000000006', 'seaweed-drying-monitor', 'Seaweed Drying Monitor',
   'Sensor node that logs humidity and temperature on drying racks.',
   'research', 'Marine Science and Fisheries', 2024, 'team_graduated', 'published',
   'd0000000-0000-4000-8000-000000000001', true, now() - interval '40 days',
   'The research team graduated before the second drying season.',
   array['ESP32', 'Humidity sensors', 'Data logging'], 3),
  ('b0000000-0000-4000-8000-000000000007', 'coral-reef-photo-counter', 'Coral Reef Photo Counter',
   'Counts coral colonies in reef photos to speed up survey work.',
   'research', 'Marine Science and Fisheries', 2025, 'funding_not_granted', 'draft',
   'c0000000-0000-4000-8000-000000000001', true, null,
   'The survey grant was not renewed after the first season.',
   array['Python', 'Object detection'], 3),
  ('b0000000-0000-4000-8000-000000000008', 'solar-dryer-controller', 'Solar Dryer Controller',
   'Controls vents on a solar dryer based on temperature and humidity.',
   'student_program', 'Engineering', 2024, 'team_graduated', 'draft',
   'c0000000-0000-4000-8000-000000000001', true, null,
   '', array[]::text[], 3);

-- Team consent for projects that passed that step (published, plus the two drafts that are past the consent step).
update public.project_members set consented_at = now()
  where project_id in (select id from public.projects where status <> 'draft' or slug in ('coral-reef-photo-counter', 'solar-dryer-controller'));

-- One demo project opens without approval (access_mode = open) so both access modes can be tried. The rest need a request.
update public.projects set access_mode = 'open' where slug = 'campus-waste-sorting-assistant';

-- The demo accounts accepted the current Terms and Privacy Policy (synthetic, demo accounts only).
insert into public.policy_acceptances (profile_id, kind, version)
select u.id, k.kind, 1 from auth.users u cross join (select distinct kind from public.policies) k
where u.email like '%@estafet.demo'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Private file records (objects are uploaded by `pnpm seed:storage`)
-- ---------------------------------------------------------------------------
insert into public.project_files (id, project_id, kind, storage_path, original_name, size_bytes, page_count, extracted_text_path, ingest_status, ingest_note, created_by)
select f.id, f.project_id, f.kind::public.file_kind,
       f.project_id || '/' || f.id || '-' || f.name,
       f.name, 0, f.pages, f.project_id || '/' || f.id || '.json', 'ready',
       case when f.kind = 'pdf' then 'Text extracted from ' || f.pages || ' pages.' else 'Parsed ' || f.pages || ' sections.' end,
       p.created_by
from (values
  ('f0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'pdf', 'proposal.pdf', 18),
  ('f0000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'pdf', 'review-feedback.pdf', 3),
  ('f0000000-0000-4000-8000-000000000003'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'pdf', 'report.pdf', 14),
  ('f0000000-0000-4000-8000-000000000004'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'markdown', 'notes.md', 5),
  ('f0000000-0000-4000-8000-000000000011'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000012'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000021'::uuid, 'b0000000-0000-4000-8000-000000000003'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000022'::uuid, 'b0000000-0000-4000-8000-000000000003'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000031'::uuid, 'b0000000-0000-4000-8000-000000000004'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000032'::uuid, 'b0000000-0000-4000-8000-000000000004'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000041'::uuid, 'b0000000-0000-4000-8000-000000000005'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000042'::uuid, 'b0000000-0000-4000-8000-000000000005'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000051'::uuid, 'b0000000-0000-4000-8000-000000000006'::uuid, 'pdf', 'final-report.pdf', 10),
  ('f0000000-0000-4000-8000-000000000052'::uuid, 'b0000000-0000-4000-8000-000000000006'::uuid, 'markdown', 'notes.md', 4),
  ('f0000000-0000-4000-8000-000000000061'::uuid, 'b0000000-0000-4000-8000-000000000007'::uuid, 'pdf', 'survey-report.pdf', 12),
  ('f0000000-0000-4000-8000-000000000062'::uuid, 'b0000000-0000-4000-8000-000000000007'::uuid, 'markdown', 'field-notes.md', 5)
) as f(id, project_id, kind, name, pages)
join public.projects p on p.id = f.project_id;

-- ---------------------------------------------------------------------------
-- Drafted items with evidence. `ev` = matched | not_found. The seed-storage script writes each
-- matched quote into the cited page, so the evidence checker finds it (verified by `pnpm seed:verify`).
-- ---------------------------------------------------------------------------
create temp table _seed_items (
  slug text, kind text, title text, descr text, effort text, lesson text, obj text,
  fname text, page int, quote text, ev text, review text, ord int
);

insert into _seed_items values
-- Mangrove Cover Classifier (published): 5 objectives, 2 completed, 4 next tasks, 3 lessons
('mangrove-cover-classifier','objective','Collect drone imagery of two coastal sites','','','','done','proposal.pdf',4,'Drone imagery will be collected at two coastal sites during the dry season.','matched','kept',1),
('mangrove-cover-classifier','objective','Label a first image set','','','','done','notes.md',3,'Labeled so far: canopy, water, bare mud.','matched','kept',2),
('mangrove-cover-classifier','objective','Train a baseline segmentation model','','','','done','report.pdf',8,'A baseline segmentation model reached 0.81 mean accuracy on the test split.','matched','kept',3),
('mangrove-cover-classifier','objective','Validate on a held-out site','','','','not_started','proposal.pdf',7,'The model will be validated on a held-out site not seen during training.','matched','kept',4),
('mangrove-cover-classifier','objective','Write a monitoring guide for field staff','','','','not_started','proposal.pdf',9,'A short monitoring guide for field staff will be produced in the final month.','matched','kept',5),
('mangrove-cover-classifier','completed','Drone image data pipeline','Imagery is tiled, cleaned and versioned by flight date.','','','','report.pdf',5,'Every flight is tiled into 512 pixel patches and stored with its flight date.','matched','kept',6),
('mangrove-cover-classifier','completed','First baseline model','A segmentation baseline with a documented training recipe.','','','','report.pdf',8,'A baseline segmentation model reached 0.81 mean accuracy on the test split.','matched','kept',7),
('mangrove-cover-classifier','next_task','Write a sampling plan that justifies the site choice','Reviewers said the choice of sites was not justified.','small','','','review-feedback.pdf',2,'The choice of the two coastal sites is not justified against the wider region.','matched','kept',8),
('mangrove-cover-classifier','next_task','Label more images for the mangrove edge class','The edge class had the fewest labels and the weakest results.','medium','','','notes.md',3,'TODO: edge class needs far more labeled images before results mean anything.','matched','kept',9),
('mangrove-cover-classifier','next_task','Re-run the baseline with a split by site','The first split mixed images from the same site across train and test.','medium','','','report.pdf',12,'Images from the same site appear in both the training and test sets.','matched','kept',10),
('mangrove-cover-classifier','next_task','Draft the monitoring guide for field staff','Planned in the proposal but not started.','large','','','proposal.pdf',9,'A short monitoring guide for field staff will be produced in the final month.','matched','kept',11),
('mangrove-cover-classifier','lesson','Splitting by site, not by image, gives a more honest accuracy estimate.','','','methodology','','report.pdf',12,'A split by site would give a more honest estimate of generalization.','matched','kept',12),
('mangrove-cover-classifier','lesson','The sampling plan needs to explain why these sites represent the region.','','','evaluation_feedback','','review-feedback.pdf',2,'The choice of the two coastal sites is not justified against the wider region.','matched','kept',13),
('mangrove-cover-classifier','lesson','Flight permits delayed the second site by several weeks.','','','blocker','','report.pdf',6,'Flight permits for the second site arrived six weeks later than planned.','matched','kept',14),

-- Campus Waste Sorting Assistant: 2 of 5 objectives done, 5 tasks
('campus-waste-sorting-assistant','objective','Collect photos of common campus waste','','','','done','final-report.pdf',3,'We collected 1,200 photos of items found in campus bins.','matched','kept',1),
('campus-waste-sorting-assistant','objective','Train an item classifier','','','','done','final-report.pdf',5,'The classifier reaches 74 percent accuracy on five bin categories.','matched','kept',2),
('campus-waste-sorting-assistant','objective','Package the model for phones','','','','not_started','final-report.pdf',6,'The model still has to be converted to a mobile format.','matched','kept',3),
('campus-waste-sorting-assistant','objective','Test with students at three bins','','','','not_started','notes.md',2,'Plan a test with students at three bins near the canteen.','matched','kept',4),
('campus-waste-sorting-assistant','objective','Add Bahasa Indonesia labels','','','','not_started','notes.md',3,'Bin labels should be shown in Bahasa Indonesia and English.','matched','kept',5),
('campus-waste-sorting-assistant','next_task','Convert the classifier to TensorFlow Lite','Needed before any phone test.','medium','','','final-report.pdf',6,'The model still has to be converted to a mobile format.','matched','kept',6),
('campus-waste-sorting-assistant','next_task','Collect photos of mixed and dirty items','The classifier struggles with food-stained packaging.','medium','','','final-report.pdf',7,'Food-stained packaging is misclassified most often.','matched','kept',7),
('campus-waste-sorting-assistant','next_task','Agree bin categories with campus services','Categories were chosen without the cleaning team.','small','','','notes.md',2,'Check bin categories with the campus cleaning team.','matched','kept',8),
('campus-waste-sorting-assistant','next_task','Run a three-bin usability test','No real user has used the prototype yet.','large','','','notes.md',2,'Plan a test with students at three bins near the canteen.','matched','kept',9),
('campus-waste-sorting-assistant','next_task','Design the bilingual result screen','Labels are English only.','small','','','notes.md',3,'Bin labels should be shown in Bahasa Indonesia and English.','matched','kept',10),
('campus-waste-sorting-assistant','lesson','Photos taken in real bins differ a lot from clean test photos.','','','methodology','','final-report.pdf',7,'Accuracy dropped to 58 percent on photos taken inside real bins.','matched','kept',11),
('campus-waste-sorting-assistant','lesson','The team graduated before the app could be tested.','','','blocker','','final-report.pdf',9,'Three of four members graduated before the testing phase.','matched','kept',12),

-- Fish Freshness Indicator: 3 of 4 objectives done, 3 tasks
('fish-freshness-indicator','objective','Collect labeled eye photos','','','','done','final-report.pdf',3,'A set of 640 labeled fish eye photos was collected over six weeks.','matched','kept',1),
('fish-freshness-indicator','objective','Build a color-based freshness score','','','','done','final-report.pdf',5,'The freshness score is computed from pupil clarity and cornea color.','matched','kept',2),
('fish-freshness-indicator','objective','Compare the score with a lab reference','','','','done','final-report.pdf',6,'The score agrees with the lab reference in 82 percent of samples.','matched','kept',3),
('fish-freshness-indicator','objective','Validate at a fish market','','','','not_started','notes.md',3,'Validation at the Paotere market was planned but never started.','matched','kept',4),
('fish-freshness-indicator','next_task','Run the field validation at a fish market','The lab agreement was never tested in the field.','large','','','notes.md',3,'Validation at the Paotere market was planned but never started.','matched','kept',5),
('fish-freshness-indicator','next_task','Handle different lighting conditions','Outdoor light changed the color score.','medium','','','final-report.pdf',7,'Strong sunlight shifts the cornea color score by up to 12 percent.','matched','kept',6),
('fish-freshness-indicator','next_task','Add species-specific thresholds','Only two species were covered.','medium','','','final-report.pdf',8,'Thresholds were calibrated for only two fish species.','matched','kept',7),
('fish-freshness-indicator','lesson','Lab agreement does not guarantee field accuracy.','','','methodology','','final-report.pdf',7,'Strong sunlight shifts the cornea color score by up to 12 percent.','matched','kept',8),
('fish-freshness-indicator','lesson','Funding reviewers wanted a field validation plan.','','','funding_feedback','','notes.md',2,'The panel asked for a field validation plan before renewing.','matched','kept',9),

-- Village Clinic Queue Tracker: 2 of 4 objectives done, 4 tasks
('village-clinic-queue-tracker','objective','Interview clinic staff about the queue','','','','done','final-report.pdf',3,'We interviewed six staff members at two village health posts.','matched','kept',1),
('village-clinic-queue-tracker','objective','Build a queue number prototype','','','','done','final-report.pdf',5,'Patients receive a queue number by SMS when they register.','matched','kept',2),
('village-clinic-queue-tracker','objective','Show live status on a waiting-room screen','','','','not_started','final-report.pdf',6,'The waiting-room display is designed but not built.','matched','kept',3),
('village-clinic-queue-tracker','objective','Pilot for two weeks at one clinic','','','','not_started','notes.md',3,'A two week pilot at one clinic was the next milestone.','matched','kept',4),
('village-clinic-queue-tracker','next_task','Build the waiting-room display','Design is done, code is not.','medium','','','final-report.pdf',6,'The waiting-room display is designed but not built.','matched','kept',5),
('village-clinic-queue-tracker','next_task','Handle patients without a phone','Some elderly patients have no phone.','medium','','','notes.md',2,'Elderly patients without phones need a paper queue number.','matched','kept',6),
('village-clinic-queue-tracker','next_task','Choose an SMS provider with local pricing','The prototype used a paid sandbox.','small','','','final-report.pdf',7,'SMS costs must be checked against the clinic budget.','matched','kept',7),
('village-clinic-queue-tracker','next_task','Run a two-week pilot','No real clinic has used it yet.','large','','','notes.md',3,'A two week pilot at one clinic was the next milestone.','matched','kept',8),
('village-clinic-queue-tracker','lesson','Staff care more about fewer questions than a fancy screen.','','','methodology','','final-report.pdf',4,'Staff asked for fewer repeat questions, not a new screen.','matched','kept',9),
('village-clinic-queue-tracker','lesson','Coursework peaks clashed with clinic visit days.','','','blocker','','notes.md',4,'Clinic visits were only possible on weekday mornings.','matched','kept',10),

-- Study Group Matcher: 1 of 3 objectives done, 6 tasks
('study-group-matcher','objective','Collect course and schedule data','','','','done','final-report.pdf',3,'The prototype imports course lists and free time slots from a form.','matched','kept',1),
('study-group-matcher','objective','Match students into groups of four','','','','in_progress','final-report.pdf',5,'The matching works for pairs but not yet for groups of four.','matched','kept',2),
('study-group-matcher','objective','Let students swap groups','','','','not_started','notes.md',2,'Swapping groups after the first match is not designed yet.','matched','kept',3),
('study-group-matcher','next_task','Extend matching from pairs to groups of four','The core algorithm only handles pairs.','large','','','final-report.pdf',5,'The matching works for pairs but not yet for groups of four.','matched','kept',4),
('study-group-matcher','next_task','Design the swap flow','Students may want a different group.','medium','','','notes.md',2,'Swapping groups after the first match is not designed yet.','matched','kept',5),
('study-group-matcher','next_task','Add course-level privacy settings','Names are visible to everyone in a course.','medium','','','final-report.pdf',7,'Student names are visible to everyone in the same course.','matched','kept',6),
('study-group-matcher','next_task','Import timetables from the campus system','Students enter slots by hand today.','large','','','notes.md',3,'Typing free slots by hand takes about ten minutes per student.','matched','kept',7),
('study-group-matcher','next_task','Test with one real course','Only synthetic data was used.','small','','','final-report.pdf',8,'All results come from synthetic student data.','matched','kept',8),
('study-group-matcher','next_task','Write a short onboarding guide','New users could not find the form.','small','','','notes.md',4,'Three testers could not find the schedule form.','matched','kept',9),
('study-group-matcher','lesson','Hackathon scope was too big for a two-person remainder.','','','blocker','','final-report.pdf',9,'Only two of five teammates stayed after the hackathon weekend.','matched','kept',10),
('study-group-matcher','lesson','Test with real schedules early.','','','methodology','','final-report.pdf',8,'All results come from synthetic student data.','matched','kept',11),

-- Seaweed Drying Monitor: 2 of 3 objectives done, 3 tasks
('seaweed-drying-monitor','objective','Build a humidity and temperature sensor node','','','','done','final-report.pdf',3,'The ESP32 node logs humidity and temperature every five minutes.','matched','kept',1),
('seaweed-drying-monitor','objective','Test the node on drying racks for one season','','','','done','final-report.pdf',5,'The node ran for 41 days on two drying racks.','matched','kept',2),
('seaweed-drying-monitor','objective','Predict drying time from the logs','','','','not_started','notes.md',3,'A drying time model was planned for the second season.','matched','kept',3),
('seaweed-drying-monitor','next_task','Build a drying time model','The first season produced the data but no model.','large','','','notes.md',3,'A drying time model was planned for the second season.','matched','kept',4),
('seaweed-drying-monitor','next_task','Waterproof the sensor housing','Two nodes failed after heavy rain.','medium','','','final-report.pdf',6,'Two nodes failed after heavy rain.','matched','kept',5),
('seaweed-drying-monitor','next_task','Compare readings with a reference sensor','Accuracy was never checked.','small','','','final-report.pdf',7,'Sensor accuracy was not compared with a reference device.','matched','kept',6),
('seaweed-drying-monitor','lesson','Salt air corrodes cheap connectors within weeks.','','','methodology','','final-report.pdf',6,'Salt air corroded the cheap connectors within a few weeks.','matched','kept',7),
('seaweed-drying-monitor','lesson','The team graduated before the second season.','','','blocker','','notes.md',4,'Every team member graduated before the second drying season.','matched','kept',8),

-- Coral Reef Photo Counter (verifying): 6 items, 4 reviewed, one deliberately unsupported
('coral-reef-photo-counter','next_task','Add a second annotator to check label agreement','Only one person labeled the images.','small','','','field-notes.md',3,'Only one person annotated the images, so agreement is unknown.','matched','kept',1),
('coral-reef-photo-counter','next_task','Collect photos from a second reef site','All photos come from one reef.','medium','','','survey-report.pdf',5,'All photos come from a single reef near the pier.','matched','kept',2),
('coral-reef-photo-counter','next_task','Re-train with a split by dive date','Photos from the same dive were split across train and test.','medium','','','survey-report.pdf',9,'Photos from the same dive appear in both training and test sets.','matched','kept',3),
('coral-reef-photo-counter','next_task','Write a field protocol for photo angle and distance','Photo quality varies by diver.','large','','','field-notes.md',4,'A short field protocol for camera angle and distance is still missing.','matched','removed',4),
('coral-reef-photo-counter','next_task','Deploy the counter as a mobile app','Mentioned as a future idea.','large','','','survey-report.pdf',11,'The counter will run on a phone in the field.','not_found','pending',5),
('coral-reef-photo-counter','lesson','Photos taken close to the reef count more reliably','','','methodology','','survey-report.pdf',7,'Counts were most reliable when the camera stayed within one metre of the reef.','matched','pending',6);

insert into public.draft_items
  (id, project_id, kind, title, description, effort, lesson_type, objective_status, evidence, evidence_status, origin, review_status, position)
select
  md5(s.slug || ':' || s.ord)::uuid, p.id, s.kind::public.item_kind, s.title, s.descr,
  nullif(s.effort, '')::public.effort, nullif(s.lesson, '')::public.lesson_type, nullif(s.obj, ''),
  jsonb_build_array(jsonb_build_object('file_id', f.id, 'page', s.page, 'quote', s.quote)),
  s.ev::public.evidence_status, 'ai', s.review::public.review_status, s.ord
from _seed_items s
join public.projects p on p.slug = s.slug
join public.project_files f on f.project_id = p.id and f.original_name = s.fname;

-- ---------------------------------------------------------------------------
-- Lineage for published projects (created is logged by the insert trigger)
-- ---------------------------------------------------------------------------
select public.log_lineage(id, 'published', created_by, null, '{}'::jsonb) from public.projects where status = 'published';

-- ---------------------------------------------------------------------------
-- Two pending continuation requests from the demo adopter team
-- ---------------------------------------------------------------------------
insert into public.continuation_requests
  (id, project_id, adopter_team_name, members, task_ids, plan, purpose, target_date, fit_note, created_by)
values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Team Laut Biru',
   '[{"email":"member2@estafet.demo"},{"email":"member3@estafet.demo"}]'::jsonb,
   array(select id from public.draft_items where project_id = 'b0000000-0000-4000-8000-000000000001'
         and title in ('Re-run the baseline with a split by site', 'Write a sampling plan that justifies the site choice')),
   'We will first redo the evaluation with a site-based split, then write the sampling plan using the survey notes from the proposal. We expect a revised report we can build a competition entry on.',
   'competition', current_date + 60,
   'Two of us took remote sensing and one has built segmentation models before (demo).',
   'a0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'Team Laut Biru',
   '[{"email":"member2@estafet.demo"},{"email":"member3@estafet.demo"}]'::jsonb,
   array(select id from public.draft_items where project_id = 'b0000000-0000-4000-8000-000000000003'
         and title in ('Run the field validation at a fish market')),
   'We will take the lab-validated score to the fish market in our first month and compare it with trader judgement.',
   'competition', current_date + 45,
   'We study fisheries and have access to the market (demo).',
   'a0000000-0000-4000-8000-000000000001');

select public.log_lineage(project_id, 'requested', created_by, id, jsonb_build_object('team', adopter_team_name))
from public.continuation_requests;

insert into public.notifications (user_id, type, payload) values
  ('c0000000-0000-4000-8000-000000000001', 'new_request',
   '{"project_id":"b0000000-0000-4000-8000-000000000001","request_id":"e0000000-0000-4000-8000-000000000001","title":"Mangrove Cover Classifier","team":"Team Laut Biru"}');

-- Fictional profile details, for the demo accounts only (a cloud project may also hold real accounts).
update public.profiles set university = 'Universitas Hasanuddin (demo)'
where id in (select id from auth.users where email like '%@estafet.demo');

-- ---------------------------------------------------------------------------
-- Admin demo data. ALL of it is labeled is_demo or belongs to demo projects.
-- The demo admin account itself is created by `pnpm seed:admin` and only when SEED_DEMO=true.
-- ---------------------------------------------------------------------------
-- One open demo report so the moderation queue is not empty.
insert into public.reports (project_id, reason, details)
select id, 'false_information', 'Demo report: the summary may overstate how far the classifier got. (Simulated, for the admin demo.)'
from public.projects where slug = 'fish-freshness-indicator';

-- Illustrative DEMO trial sessions (pseudonym codes only). They are excluded from metrics by default and are not results.
insert into public.trial_sessions
  (participant_code, cohort, project_id, started_at, minutes_to_understand, completed, correct_answers, total_questions, sus_score, notes, consent_confirmed, is_demo)
select v.code, v.cohort::public.trial_cohort, p.id, now() - (v.days || ' days')::interval, v.minutes, v.done, v.correct, 5, v.sus,
       'Demo row, not a real session.', true, true
from (values
  ('D01','baseline',9,46.0,true,3,null::numeric), ('D02','baseline',9,52.0,true,2,null), ('D03','baseline',8,61.0,false,2,null),
  ('D04','baseline',8,38.0,true,4,null), ('D05','baseline',7,55.0,true,3,null), ('D06','baseline',7,49.0,true,3,null),
  ('D07','estafet',6,24.0,true,4,78.0), ('D08','estafet',6,31.0,true,4,72.5), ('D09','estafet',5,27.0,true,5,80.0), ('D10','estafet',5,36.0,false,3,65.0)
) as v(code, cohort, days, minutes, done, correct, sus)
cross join (select id from public.projects where slug = 'mangrove-cover-classifier') p;
