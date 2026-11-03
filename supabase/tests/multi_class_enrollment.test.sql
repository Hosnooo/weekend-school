begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

insert into public.students (id, school_id, first_name_en, last_name_en) values
('ae000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Multi', 'Class Student'),
('ae000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Another', 'Student');

insert into public.classes (id, school_id, name_en) values
('ae100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Multi Class A'),
('ae100000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Multi Class B');

insert into public.class_enrollments (school_id, student_id, class_id, starts_on)
values ('a0000000-0000-0000-0000-000000000001',
'ae000000-0000-0000-0000-000000000001',
'ae100000-0000-0000-0000-000000000001', date '2026-10-01');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.enroll_students_in_class(
    array['ae000000-0000-0000-0000-000000000001'::uuid,
          'ae000000-0000-0000-0000-000000000002'::uuid],
    'ae100000-0000-0000-0000-000000000002', date '2026-10-05')$$,
  'administrator may add two students to a Class atomically'
);
select results_eq(
  $$select count(*)::bigint from public.class_enrollments
    where student_id='ae000000-0000-0000-0000-000000000001'
      and starts_on <= date '2026-10-10'
      and (ends_on is null or ends_on >= date '2026-10-10')$$,
  array[2::bigint],
  'one student may attend two Classes on the same date'
);
select results_eq(
  $$select count(*)::bigint from public.class_enrollments
    where class_id='ae100000-0000-0000-0000-000000000002'
      and starts_on <= date '2026-10-10'
      and (ends_on is null or ends_on >= date '2026-10-10')$$,
  array[2::bigint],
  'both students appear in the new Class roster'
);
select throws_ok(
  $$select public.enroll_student_in_class(
    'ae000000-0000-0000-0000-000000000001',
    'ae100000-0000-0000-0000-000000000002',
    date '2026-10-06')$$,
  '23P01', null, 'overlap in the SAME Class is rejected'
);
select throws_ok(
  $$select public.enroll_students_in_class(
    array['ae000000-0000-0000-0000-000000000001'::uuid,
          'ae000000-0000-0000-0000-000000000002'::uuid],
    'ae100000-0000-0000-0000-000000000001',
    date '2026-10-05')$$,
  '23P01', null, 'a failing batch rejects an overlapping Class enrollment'
);
select results_eq(
  $select count(*)::bigint from public.class_enrollments
    where class_id='ae100000-0000-0000-0000-000000000001'
      and student_id='ae000000-0000-0000-0000-000000000002'$,
  array[0::bigint],
  'a failing batch leaves no partial enrollment behind'
);
reset role;

-- Class A has a historically bounded Group, a future Group, and a dated
-- exclusion. Class B has independent participation that must be preserved.
insert into public.subjects (id, school_id, name_en) values
('ae200000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Parallel Subject A'),
('ae200000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Parallel Subject B'),
('ae200000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Parallel Excluded Subject');
insert into public.class_subjects (id, school_id, class_id, subject_id) values
('ae300000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000001', 'ae200000-0000-0000-0000-000000000001'),
('ae300000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000002', 'ae200000-0000-0000-0000-000000000002'),
('ae300000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000001', 'ae200000-0000-0000-0000-000000000003');
insert into public.subject_groups (id, school_id, class_subject_id, name_en) values
('ae400000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ae300000-0000-0000-0000-000000000001', 'Group A'),
('ae400000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ae300000-0000-0000-0000-000000000002', 'Group B');
insert into public.subject_group_memberships (
  id, school_id, class_subject_id, subject_group_id, student_id, starts_on, ends_on
) values
('ae500000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ae300000-0000-0000-0000-000000000001', 'ae400000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', '2026-10-05', '2026-10-31'),
('ae500000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ae300000-0000-0000-0000-000000000001', 'ae400000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', '2026-11-01', null),
('ae500000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'ae300000-0000-0000-0000-000000000002', 'ae400000-0000-0000-0000-000000000002', 'ae000000-0000-0000-0000-000000000001', '2026-10-05', null);
insert into public.subject_exclusions (
  id, school_id, class_subject_id, student_id, starts_on, ends_on
) values
('ae600000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ae300000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000001', '2026-10-07', '2026-10-31');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $select public.end_student_class_enrollment(
    'ae000000-0000-0000-0000-000000000001',
    'ae100000-0000-0000-0000-000000000001', date '2026-10-15')$,
  'administrator can end only Class A without changing Class B'
);
select results_eq(
  $select ends_on from public.class_enrollments
    where student_id='ae000000-0000-0000-0000-000000000001'
      and class_id='ae100000-0000-0000-0000-000000000001'$,
  array[date '2026-10-15'], 'Class A closes on the chosen day'
);
select results_eq(
  $select count(*)::bigint from public.class_enrollments
    where student_id='ae000000-0000-0000-0000-000000000001'
      and class_id='ae100000-0000-0000-0000-000000000002'
      and ends_on is null$,
  array[1::bigint], 'Class B enrollment remains open'
);
select results_eq(
  $select ends_on from public.subject_group_memberships
    where id='ae500000-0000-0000-0000-000000000001'$,
  array[date '2026-10-15'], 'historically dated Class A membership is shortened'
);
select results_eq(
  $select count(*)::bigint from public.subject_group_memberships
    where id='ae500000-0000-0000-0000-000000000002'$,
  array[0::bigint], 'future Class A Group membership is removed'
);
select results_eq(
  $select count(*)::bigint from public.subject_group_memberships
    where id='ae500000-0000-0000-0000-000000000003'
      and ends_on is null$,
  array[1::bigint], 'Class B Subject Group remains untouched'
);
select results_eq(
  $select ends_on from public.subject_exclusions
    where id='ae600000-0000-0000-0000-000000000001'$,
  array[date '2026-10-15'], 'previously dated Class A exclusion is shortened'
);
reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select throws_ok(
  $$select public.enroll_students_in_class(
    array['ae000000-0000-0000-0000-000000000002'::uuid],
    'ae100000-0000-0000-0000-000000000001',
    date '2026-10-05')$$,
  '42501', null, 'anonymous users cannot bulk-enroll students'
);
select * from finish();
rollback;
