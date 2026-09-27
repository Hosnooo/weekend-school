begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(1);

insert into public.classes (
  id, school_id, name_en, starts_on, is_active
) values (
  '96000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Weekly Roster Overlap Class',
  '2026-09-01',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values (
  '96100000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Weekly Roster Overlap Subject',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values (
  '96200000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '96100000-0000-4000-8000-000000000001',
  true
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, is_active
) values (
  '96300000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '96200000-0000-4000-8000-000000000001',
  'Overlap Group',
  true
);

insert into public.students (
  id, school_id, first_name_en, last_name_en, is_active
) values (
  '96400000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Sunday',
  'Student',
  true
);

-- Student joins on Sunday, the final day of the Sep 21–27 week.
insert into public.class_enrollments (
  id, school_id, class_id, student_id, starts_on
) values (
  '96500000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '96400000-0000-4000-8000-000000000001',
  '2026-09-27'
);

insert into public.subject_group_memberships (
  id, school_id, class_subject_id, subject_group_id, student_id, starts_on
) values (
  '96600000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '96200000-0000-4000-8000-000000000001',
  '96300000-0000-4000-8000-000000000001',
  '96400000-0000-4000-8000-000000000001',
  '2026-09-27'
);

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '96700000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '96200000-0000-4000-8000-000000000001',
  '96300000-0000-4000-8000-000000000001',
  '2026-09-27'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);

select results_eq(
  $$select student_id
    from public.get_weekly_submission_roster(
      '96200000-0000-4000-8000-000000000001',
      '96300000-0000-4000-8000-000000000001',
      date '2026-09-21'
    )$$,
  $$values ('96400000-0000-4000-8000-000000000001'::uuid)$$,
  'student joining during the reporting week is included in the weekly roster'
);

reset role;

select * from finish();
rollback;
