begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

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
