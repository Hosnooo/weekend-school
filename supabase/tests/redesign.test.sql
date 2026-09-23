begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

-- Build isolated redesign fixtures as owner, then exercise them through authenticated RLS.
insert into public.classes(id,school_id,name_en,name_ar,is_active) values
 ('aa000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','Redesign Class',null,true),
 ('aa000000-0000-4000-8000-000000000102','a0000000-0000-0000-0000-000000000001','Next Class',null,true);
insert into public.subjects(id,school_id,name_en,name_ar,is_active) values
 ('bb000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','Quran',null,true),
 ('bb000000-0000-4000-8000-000000000102','a0000000-0000-0000-0000-000000000001','Arabic',null,true);
insert into public.class_subjects(id,school_id,class_id,subject_id,is_active) values
 ('cc000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','aa000000-0000-4000-8000-000000000101','bb000000-0000-4000-8000-000000000101',true),
 ('cc000000-0000-4000-8000-000000000102','a0000000-0000-0000-0000-000000000001','aa000000-0000-4000-8000-000000000101','bb000000-0000-4000-8000-000000000102',true);
insert into public.subject_groups(id,school_id,class_subject_id,name_en,is_active) values
 ('dd000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','cc000000-0000-4000-8000-000000000101','Quran A',true);
insert into public.class_enrollments(id,school_id,class_id,student_id,starts_on) values
 ('ee000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','aa000000-0000-4000-8000-000000000101','e0000000-0000-0000-0000-000000000005','2026-09-01'),
 ('ee000000-0000-4000-8000-000000000102','a0000000-0000-0000-0000-000000000001','aa000000-0000-4000-8000-000000000101','e0000000-0000-0000-0000-000000000006','2026-09-01');
insert into public.subject_group_memberships(id,school_id,class_subject_id,subject_group_id,student_id,starts_on) values
 ('ef000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','cc000000-0000-4000-8000-000000000101','dd000000-0000-4000-8000-000000000101','e0000000-0000-0000-0000-000000000005','2026-09-01');
insert into public.teaching_assignments(id,school_id,teacher_profile_id,class_subject_id,subject_group_id,starts_on) values
 ('fa000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','cc000000-0000-4000-8000-000000000101','dd000000-0000-4000-8000-000000000101','2026-09-01');
insert into public.weekly_submissions(id,school_id,class_subject_id,subject_group_id,teacher_profile_id,week_start,status,submitted_at)
values('ab000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','cc000000-0000-4000-8000-000000000101','dd000000-0000-4000-8000-000000000101','c0000000-0000-0000-0000-000000000002','2026-09-21','SUBMITTED',now());
insert into public.weekly_submission_students(id,school_id,submission_id,student_id,attendance_status)
values('ac000000-0000-4000-8000-000000000101','a0000000-0000-0000-0000-000000000001','ab000000-0000-4000-8000-000000000101','e0000000-0000-0000-0000-000000000005','PRESENT');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000002',true);

select results_eq(
 $$select count(*)::bigint from public.class_subjects where id='cc000000-0000-4000-8000-000000000101'$$,
 array[1::bigint],
 'group-only teacher can read the parent Class Subject'
);

select results_eq(
 $$select count(*)::bigint from public.students where id='e0000000-0000-0000-0000-000000000005'$$,
 array[1::bigint],
 'new teaching assignment grants access to the assigned Group student'
);

select is_empty(
 $$delete from public.weekly_submission_students where id='ac000000-0000-4000-8000-000000000101' returning id$$,
 'teacher cannot delete student observations after submission'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);

select lives_ok(
 $$select public.change_student_class('e0000000-0000-0000-0000-000000000005','aa000000-0000-4000-8000-000000000102','2026-09-23')$$,
 'admin can change a student Class through the redesign RPC'
);
select results_eq(
 $$select ends_on from public.subject_group_memberships where id='ef000000-0000-4000-8000-000000000101'$$,
 array[date '2026-09-22'],
 'changing Class closes old Subject Group membership history'
);

select lives_ok(
 $$select public.create_subject_group('cc000000-0000-4000-8000-000000000102','Arabic A',null)$$,
 'admin can create the first Group for a previously whole-Class Subject'
);
select results_eq(
 $$select count(*)::bigint from public.subject_group_memberships m where m.class_subject_id='cc000000-0000-4000-8000-000000000102' and m.student_id='e0000000-0000-0000-0000-000000000006' and m.ends_on is null$$,
 array[1::bigint],
 'first Group creation assigns existing participating students to the new default Group'
);

select * from finish();
rollback;
