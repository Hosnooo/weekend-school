begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_function(
  'public', 'update_student_enrollment_start', array['uuid','date'],
  'admin enrollment start correction exists'
);

insert into public.classes (id, school_id, name_en, name_ar) values
  ('95000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Correction Class A', 'فصل التصحيح أ'),
  ('95000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Correction Class B', 'فصل التصحيح ب');

insert into public.students (id, school_id, first_name_en, last_name_en) values
  ('96000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Correction', 'Student'),
  ('96000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Boundary', 'Student');

insert into public.class_enrollments (school_id, class_id, student_id, starts_on) values
  ('a0000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', date '2026-09-10');

insert into public.class_enrollments (school_id, class_id, student_id, starts_on, ends_on) values
  ('a0000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000002', date '2026-09-19', date '2026-09-29');
insert into public.class_enrollments (school_id, class_id, student_id, starts_on) values
  ('a0000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000002', date '2026-09-30');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.change_student_class(
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000002',
    date '2026-09-10'
  )$$,
  'Class can be corrected on the same date as the current enrollment start'
);

select results_eq(
  $$select class_id, starts_on, ends_on from public.class_enrollments
    where student_id = '96000000-0000-0000-0000-000000000001'
    order by starts_on$$,
  $$values ('95000000-0000-0000-0000-000000000002'::uuid, date '2026-09-10', null::date)$$,
  'same-date Class correction replaces the initial enrollment instead of creating a zero-day history row'
);

select throws_ok(
  $$select public.change_student_class(
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    date '2026-09-09'
  )$$,
  '22023',
  'class change date cannot precede current enrollment start',
  'Class change still rejects dates earlier than the current enrollment start'
);

select lives_ok(
  $$select public.update_student_enrollment_start(
    '96000000-0000-0000-0000-000000000001',
    date '2026-09-01'
  )$$,
  'administrator can correct the active enrollment start date'
);

select results_eq(
  $$select starts_on from public.class_enrollments
    where student_id = '96000000-0000-0000-0000-000000000001' and ends_on is null$$,
  array[date '2026-09-01'],
  'corrected enrollment start is persisted'
);

select lives_ok(
  $$select public.update_student_enrollment_start(
    '96000000-0000-0000-0000-000000000002',
    date '2026-09-19'
  )$$,
  'backdating an active transfer to the prior enrollment start corrects the transfer boundary'
);

select results_eq(
  $$select class_id, starts_on, ends_on from public.class_enrollments
    where student_id = '96000000-0000-0000-0000-000000000002'
    order by starts_on$$,
  $$values ('95000000-0000-0000-0000-000000000002'::uuid, date '2026-09-19', null::date)$$,
  'backdating to the prior start removes the superseded Class interval instead of overlapping it'
);

select * from finish();
rollback;
