begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_table('public', 'attendance_resolutions', 'manual attendance resolution table exists');
select has_function(
  'public',
  'get_effective_attendance',
  array['uuid','uuid','date','uuid'],
  'official attendance resolver exists'
);
select has_function(
  'public',
  'resolve_attendance_conflict',
  array['uuid','uuid','date','uuid','public.attendance_status'],
  'admin conflict resolution function exists'
);

insert into public.classes (id, school_id, name_en, name_ar) values
  ('aa100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Attendance Class', 'فصل الحضور');

insert into public.subjects (id, school_id, name_en, name_ar) values
  ('aa200000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Attendance Subject', 'مادة الحضور');

insert into public.class_subjects (id, school_id, class_id, subject_id) values
  ('aa300000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'aa100000-0000-0000-0000-000000000001', 'aa200000-0000-0000-0000-000000000001');

insert into public.subject_groups (id, school_id, class_subject_id, name_en, name_ar) values
  ('aa400000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'aa300000-0000-0000-0000-000000000001', 'Attendance Group', 'مجموعة الحضور');

insert into public.teaching_assignments (
  id, school_id, teacher_id, class_subject_id, subject_group_id, starts_on
) values
  ('aa500000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002', 'aa300000-0000-0000-0000-000000000001',
   'aa400000-0000-0000-0000-000000000001', date '2026-09-01'),
  ('aa500000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003', 'aa300000-0000-0000-0000-000000000001',
   'aa400000-0000-0000-0000-000000000001', date '2026-09-01');

insert into public.class_enrollments (
  id, school_id, class_id, student_id, starts_on
) values (
  'aa600000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'aa100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', date '2026-09-01'
);

insert into public.subject_group_memberships (
  id, school_id, class_subject_id, subject_group_id, student_id, starts_on
) values (
  'aa700000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001', date '2026-09-01'
);

insert into public.weekly_submissions (
  id, school_id, class_subject_id, subject_group_id, teacher_id, week_start
) values
  ('aa800000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', date '2026-09-07'),
  ('aa800000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', date '2026-09-07'),
  ('aa800000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', date '2026-09-14'),
  ('aa800000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', date '2026-09-14'),
  ('aa800000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', date '2026-09-21'),
  ('aa800000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', date '2026-09-21');

insert into public.weekly_submission_students (
  school_id, submission_id, student_id, attendance_status
) values
  ('a0000000-0000-0000-0000-000000000001', 'aa800000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PRESENT'),
  ('a0000000-0000-0000-0000-000000000001', 'aa800000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'PRESENT'),
  ('a0000000-0000-0000-0000-000000000001', 'aa800000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'ABSENT'),
  ('a0000000-0000-0000-0000-000000000001', 'aa800000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'ABSENT'),
  ('a0000000-0000-0000-0000-000000000001', 'aa800000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'PRESENT'),
  ('a0000000-0000-0000-0000-000000000001', 'aa800000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'ABSENT');

update public.weekly_submissions
set status = 'SUBMITTED', submitted_at = now()
where id in (
  'aa800000-0000-0000-0000-000000000001',
  'aa800000-0000-0000-0000-000000000002',
  'aa800000-0000-0000-0000-000000000003',
  'aa800000-0000-0000-0000-000000000004',
  'aa800000-0000-0000-0000-000000000005',
  'aa800000-0000-0000-0000-000000000006'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select status::text, has_conflict, is_resolved, observation_count
    from public.get_effective_attendance(
      'aa300000-0000-0000-0000-000000000001',
      'aa400000-0000-0000-0000-000000000001',
      date '2026-09-07',
      'e0000000-0000-0000-0000-000000000001'
    )$$,
  $$values ('PRESENT'::text, false, false, 2::bigint)$$,
  'PRESENT + PRESENT resolves to one official PRESENT occurrence'
);

select results_eq(
  $$select status::text, has_conflict, is_resolved, observation_count
    from public.get_effective_attendance(
      'aa300000-0000-0000-0000-000000000001',
      'aa400000-0000-0000-0000-000000000001',
      date '2026-09-14',
      'e0000000-0000-0000-0000-000000000001'
    )$$,
  $$values ('ABSENT'::text, false, false, 2::bigint)$$,
  'ABSENT + ABSENT resolves to one official ABSENT occurrence'
);

select results_eq(
  $$select status::text, has_conflict, is_resolved, observation_count
    from public.get_effective_attendance(
      'aa300000-0000-0000-0000-000000000001',
      'aa400000-0000-0000-0000-000000000001',
      date '2026-09-21',
      'e0000000-0000-0000-0000-000000000001'
    )$$,
  $$values (null::text, true, false, 2::bigint)$$,
  'PRESENT + ABSENT is an unresolved conflict'
);

select results_eq(
  $$select count(*)::bigint
    from public.get_effective_attendance(
      'aa300000-0000-0000-0000-000000000001',
      'aa400000-0000-0000-0000-000000000001',
      date '2026-09-21',
      'e0000000-0000-0000-0000-000000000001'
    )$$,
  $$values (1::bigint)$$,
  'one student/context/week produces exactly one official attendance occurrence'
);

select lives_ok($resolve_conflict$
  select public.resolve_attendance_conflict(
    'aa300000-0000-0000-0000-000000000001',
    'aa400000-0000-0000-0000-000000000001',
    date '2026-09-21',
    'e0000000-0000-0000-0000-000000000001',
    'PRESENT'::public.attendance_status
  );
$resolve_conflict$, 'admin can resolve a true attendance conflict');

select results_eq(
  $$select status::text, has_conflict, is_resolved, observation_count
    from public.get_effective_attendance(
      'aa300000-0000-0000-0000-000000000001',
      'aa400000-0000-0000-0000-000000000001',
      date '2026-09-21',
      'e0000000-0000-0000-0000-000000000001'
    )$$,
  $$values ('PRESENT'::text, true, true, 2::bigint)$$,
  'admin resolution supplies the official value while preserving conflict provenance'
);

select throws_ok($resolve_consensus$
  select public.resolve_attendance_conflict(
    'aa300000-0000-0000-0000-000000000001',
    'aa400000-0000-0000-0000-000000000001',
    date '2026-09-07',
    'e0000000-0000-0000-0000-000000000001',
    'ABSENT'::public.attendance_status
  );
$resolve_consensus$, '23514', null, 'manual resolution is rejected when teacher observations already agree');

select results_eq(
  $$select status::text
    from public.get_effective_attendance(
      'aa300000-0000-0000-0000-000000000001',
      'aa400000-0000-0000-0000-000000000001',
      date '2026-09-07',
      'e0000000-0000-0000-0000-000000000001'
    )$$,
  $$values ('PRESENT'::text)$$,
  'resolving one context/week cannot overwrite another official attendance value'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);

select throws_ok($teacher_resolve$
  select public.resolve_attendance_conflict(
    'aa300000-0000-0000-0000-000000000001',
    'aa400000-0000-0000-0000-000000000001',
    date '2026-09-21',
    'e0000000-0000-0000-0000-000000000001',
    'ABSENT'::public.attendance_status
  );
$teacher_resolve$, '42501', null, 'teachers cannot resolve attendance conflicts');

reset role;
select * from finish();
rollback;
