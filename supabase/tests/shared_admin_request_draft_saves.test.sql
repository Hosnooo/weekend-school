begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into public.classes (id,school_id,name_en,name_ar)
values ('8a100000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Shared Draft Save Test','اختبار المسودة المشتركة');
insert into public.subjects (id,school_id,name_en,name_ar)
values ('8a200000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Shared Test Subject','مادة الاختبار');
insert into public.class_subjects (id,school_id,class_id,subject_id)
values ('8a300000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',
'8a100000-0000-0000-0000-000000000001','8a200000-0000-0000-0000-000000000001');
insert into public.teaching_assignments (id,school_id,teacher_id,class_subject_id,subject_group_id,starts_on)
values
('8a400000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','8a300000-0000-0000-0000-000000000001',null,date '2025-01-01'),
('8a400000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003','8a300000-0000-0000-0000-000000000001',null,date '2025-01-01');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);

-- Request creation is a separate statement so the following SELECT sees
-- rows written by the SECURITY DEFINER request RPC.
create temporary table pg_temp.shared_save_request_set(id uuid primary key);
insert into pg_temp.shared_save_request_set(id)
select public.request_teaching_update(
  '8a300000-0000-0000-0000-000000000001','RANGE',
  date '2026-09-01',date '2026-09-02',
  null::date[],'Shared draft save regression'
);
create temporary table pg_temp.shared_save_fixture(id uuid primary key);
insert into pg_temp.shared_save_fixture(id)
select ws.id
from public.weekly_submissions ws
join pg_temp.shared_save_request_set request on ws.request_set_id = request.id;

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000002',true);
select lives_ok($probe$
select public.save_teaching_update_draft(
'c0000000-0000-0000-0000-000000000002',
(select id from pg_temp.shared_save_fixture),
'8a300000-0000-0000-0000-000000000001',null::uuid,'RANGE',
date '2026-09-01',date '2026-09-02',array[]::date[],
'First teacher saved',null,null,'[]'::jsonb,'[]'::jsonb,1)
$probe$,'First assigned teacher saves an unclaimed Admin draft');

select ok((select teacher_id is null and request_set_id is not null and version = 2
from public.weekly_submissions where id=(select id from pg_temp.shared_save_fixture)),
'Save does not claim request; version advances');

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000003',true);
select lives_ok($probe$
select public.save_teaching_update_draft(
'c0000000-0000-0000-0000-000000000003',
(select id from pg_temp.shared_save_fixture),
'8a300000-0000-0000-0000-000000000001',null::uuid,'RANGE',
date '2026-09-01',date '2026-09-02',array[]::date[],
'Second teacher saved',null,null,'[]'::jsonb,'[]'::jsonb,2)
$probe$,'Second assigned teacher saves the same unclaimed Admin draft');

select is((select progress_en from public.weekly_submissions
where id=(select id from pg_temp.shared_save_fixture)),
'Second teacher saved','Second teacher edits the shared record');

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000002',true);

select throws_ok($probe$
select public.save_teaching_update_draft(
'c0000000-0000-0000-0000-000000000002',
(select id from pg_temp.shared_save_fixture),
'8a300000-0000-0000-0000-000000000001',null::uuid,'RANGE',
date '2026-09-01',date '2026-09-02',array[]::date[],
'Stale update',null,null,'[]'::jsonb,'[]'::jsonb,2)
$probe$,'40001','Teaching Update version conflict',
'Stale draft cannot overwrite latest teacher save');

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000003',true);

select lives_ok($probe$
select public.submit_teaching_update(
(select id from pg_temp.shared_save_fixture),
'c0000000-0000-0000-0000-000000000003',3)
$probe$,'One assigned teacher submits the shared draft');

select ok((select teacher_id='c0000000-0000-0000-0000-000000000003'::uuid
and status='SUBMITTED' from public.weekly_submissions
where id=(select id from pg_temp.shared_save_fixture)),
'Submitted request is claimed by the submitting teacher');

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000002',true);

select throws_ok($probe$
select public.submit_teaching_update(
(select id from pg_temp.shared_save_fixture),
'c0000000-0000-0000-0000-000000000002',3)
$probe$,'55000','Teaching Update is already completed',
'Another teacher cannot submit the completed request');


-- Regression: partial numeric attendance and a student's comment must be
-- independently storable, but submission still requires completed counts.
set local role postgres;
insert into public.students (
 id,school_id,first_name_en,last_name_en
) values (
 '8a500000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'Partial','Draft'
);
insert into public.class_enrollments (
 school_id,class_id,student_id,starts_on
) values (
 'a0000000-0000-0000-0000-000000000001',
 '8a100000-0000-0000-0000-000000000001',
 '8a500000-0000-0000-0000-000000000001',
 date '2026-01-01'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000002',true);

select lives_ok($probe$
 select public.save_teaching_update_draft(
 'c0000000-0000-0000-0000-000000000002',null::uuid,
 '8a300000-0000-0000-0000-000000000001',null::uuid,
 'RANGE',date '2026-08-01',date '2026-08-02',array[]::date[],
 'Partial draft marker',null,null,
 '[{"student_id":"8a500000-0000-0000-0000-000000000001","attended":2,"total":null}]'::jsonb,
 '[{"student_id":"8a500000-0000-0000-0000-000000000001","comment_en":"Partial note"}]'::jsonb,
 null::integer
 )
$probe$,'A Teacher can save partial attendance and an independent comment');

select ok((
 select s.attendance_attended=2 and s.attendance_total is null
 and s.comment_en='Partial note' and s.attendance_status is null
 from public.weekly_submission_students s
 join public.weekly_submissions w on w.id=s.submission_id
 where w.progress_en='Partial draft marker'
),'Partial numeric attendance and comment persist together');

select lives_ok($probe$
 select public.save_teaching_update_draft(
 'c0000000-0000-0000-0000-000000000002',
 (select id from public.weekly_submissions where progress_en='Partial draft marker'),
 '8a300000-0000-0000-0000-000000000001',null::uuid,
 'RANGE',date '2026-08-01',date '2026-08-02',array[]::date[],
 'Comment only draft marker',null,null,
 '[]'::jsonb,
 '[{"student_id":"8a500000-0000-0000-0000-000000000001","comment_en":"Comment retained"}]'::jsonb,
 1
 )
$probe$,'A Teacher can save comments without an attendance entry');

select ok((
 select s.attendance_attended is null and s.attendance_total is null
 and s.comment_en='Comment retained'
 from public.weekly_submission_students s
 join public.weekly_submissions w on w.id=s.submission_id
 where w.progress_en='Comment only draft marker'
),'Comment-only student row survives a reload');

select throws_ok($probe$
 select public.submit_teaching_update(
 (select id from public.weekly_submissions where progress_en='Comment only draft marker'),
 'c0000000-0000-0000-0000-000000000002',2)
$probe$,'23514',null,
'Submission rejects a draft without complete attendance');

select lives_ok($probe$
 select public.save_teaching_update_draft(
 'c0000000-0000-0000-0000-000000000002',
 (select id from public.weekly_submissions where progress_en='Comment only draft marker'),
 '8a300000-0000-0000-0000-000000000001',null::uuid,
 'RANGE',date '2026-08-01',date '2026-08-02',array[]::date[],
 'Complete draft marker',null,null,
 '[{"student_id":"8a500000-0000-0000-0000-000000000001","attended":2,"total":2}]'::jsonb,
 '[{"student_id":"8a500000-0000-0000-0000-000000000001","comment_en":"Comment retained"}]'::jsonb,
 2
 )
$probe$,'A Teacher can complete a previously partial draft');

select lives_ok($probe$
 select public.submit_teaching_update(
 (select id from public.weekly_submissions where progress_en='Complete draft marker'),
 'c0000000-0000-0000-0000-000000000002',3)
$probe$,'A completed draft submits successfully');

select ok((
 select w.status='SUBMITTED' and s.attendance_attended=2
   and s.attendance_total=2 and s.comment_en='Comment retained'
 from public.weekly_submissions w
 join public.weekly_submission_students s on s.submission_id=w.id
 where w.progress_en='Complete draft marker'
),'Submission preserves completed attendance and existing comment');

select * from finish();
rollback;
