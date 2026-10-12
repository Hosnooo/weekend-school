begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

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

create temporary table pg_temp.shared_save_fixture(id uuid primary key);
insert into pg_temp.shared_save_fixture(id)
select ws.id
from public.weekly_submissions ws
where ws.request_set_id = public.request_teaching_update(
'8a300000-0000-0000-0000-000000000001','RANGE',date '2026-09-01',date '2026-09-02',
null::date[],'Shared draft save regression');

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

select throws_ok($probe$
select public.save_teaching_update_draft(
'c0000000-0000-0000-0000-000000000002',
(select id from pg_temp.shared_save_fixture),
'8a300000-0000-0000-0000-000000000001',null::uuid,'RANGE',
date '2026-09-01',date '2026-09-02',array[]::date[],
'Stale update',null,null,'[]'::jsonb,'[]'::jsonb,2)
$probe$,'40001','Teaching Update version conflict',
'Stale draft cannot overwrite latest teacher save');

select lives_ok($probe$
select public.submit_teaching_update(
(select id from pg_temp.shared_save_fixture),
'c0000000-0000-0000-0000-000000000003',3)
$probe$,'One assigned teacher submits the shared draft');

select ok((select teacher_id='c0000000-0000-0000-0000-000000000003'::uuid
and status='SUBMITTED' from public.weekly_submissions
where id=(select id from pg_temp.shared_save_fixture)),
'Submitted request is claimed by the submitting teacher');

select throws_ok($probe$
select public.submit_teaching_update(
(select id from pg_temp.shared_save_fixture),
'c0000000-0000-0000-0000-000000000002',3)
$probe$,'55000','Teaching Update is already completed',
'Another teacher cannot submit the completed request');

select * from finish();
rollback;
