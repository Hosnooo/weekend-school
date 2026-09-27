begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

insert into public.students (
  id,
  school_id,
  first_name_en,
  last_name_en
) values (
  '91000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Existing',
  'Student'
);

insert into public.classes (
  id,
  school_id,
  name_en,
  starts_on,
  is_active
) values (
  '92000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Existing Student Enrollment Class',
  '2026-09-01',
  true
);

insert into public.subjects (
  id,
  school_id,
  name_en,
  is_active
) values (
  '93000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Existing Student Enrollment Subject',
  true
);

insert into public.class_subjects (
  id,
  school_id,
  class_id,
  subject_id,
  is_active
) values (
  '94000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  true
);

insert into public.subject_groups (
  id,
  school_id,
  class_subject_id,
  name_en,
  is_active
) values (
  '95000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '94000000-0000-4000-8000-000000000001',
  'Default Group',
  true
);

update public.class_subjects
set default_group_id = '95000000-0000-4000-8000-000000000001'
where id = '94000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$select public.enroll_student_in_class(
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001',
    '2026-09-27'
  )$$,
  'admin can enroll an existing unassigned Student'
);

reset role;

select results_eq(
  $$select count(*)::bigint
    from public.class_enrollments
    where student_id = '91000000-0000-4000-8000-000000000001'
      and class_id = '92000000-0000-4000-8000-000000000001'
      and ends_on is null$$,
  array[1::bigint],
  'Student has active Class enrollment'
);

select results_eq(
  $$select count(*)::bigint
    from public.subject_group_memberships
    where student_id = '91000000-0000-4000-8000-000000000001'
      and class_subject_id = '94000000-0000-4000-8000-000000000001'
      and subject_group_id = '95000000-0000-4000-8000-000000000001'
      and ends_on is null$$,
  array[1::bigint],
  'default Subject Group is assigned'
);

select * from finish();
rollback;
