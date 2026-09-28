begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

-- Build a small Class dependency tree as the database owner.
insert into public.students (
  id, school_id, first_name_en, last_name_en, is_active
) values (
  '9e000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Cascade',
  'Student',
  true
);

insert into public.classes (
  id, school_id, name_en, is_active
) values (
  '9a000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Archived Cascade Class',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values (
  '9b000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Cascade Subject',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values (
  '9c000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '9a000000-0000-4000-8000-000000000001',
  '9b000000-0000-4000-8000-000000000001',
  true
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, is_active
) values (
  '9d000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '9c000000-0000-4000-8000-000000000001',
  'Cascade Group',
  true
);

insert into public.class_enrollments (
  id, school_id, class_id, student_id, starts_on
) values (
  '9f000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '9a000000-0000-4000-8000-000000000001',
  '9e000000-0000-4000-8000-000000000001',
  date '2026-09-01'
);

insert into public.subject_group_memberships (
  id,
  school_id,
  class_subject_id,
  subject_group_id,
  student_id,
  starts_on
) values (
  '91000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '9c000000-0000-4000-8000-000000000001',
  '9d000000-0000-4000-8000-000000000001',
  '9e000000-0000-4000-8000-000000000001',
  date '2026-09-01'
);

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '92000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '9c000000-0000-4000-8000-000000000001',
  '9d000000-0000-4000-8000-000000000001',
  date '2026-09-01'
);

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
  $$select public.archive_entity(
    'CLASS',
    '9a000000-0000-4000-8000-000000000001'
  )$$,
  'admin can archive the Class first'
);

select lives_ok(
  $$select public.permanently_delete_archived_entity(
    'CLASS',
    '9a000000-0000-4000-8000-000000000001',
    'Archived Cascade Class'
  )$$,
  'archived Class can delete its dependency tree with Class-name confirmation'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.classes
    where id = '9a000000-0000-4000-8000-000000000001'
  ),
  0,
  'Class is deleted'
);

select is(
  (
    select count(*)::integer
    from public.class_subjects
    where class_id = '9a000000-0000-4000-8000-000000000001'
  ),
  0,
  'Class Subjects are deleted'
);

select is(
  (
    select count(*)::integer
    from public.subject_groups
    where class_subject_id = '9c000000-0000-4000-8000-000000000001'
  ),
  0,
  'Class Groups are deleted'
);

select is(
  (
    select count(*)::integer
    from public.class_enrollments
    where class_id = '9a000000-0000-4000-8000-000000000001'
  ),
  0,
  'Class enrollments are deleted'
);

select is(
  (
    select count(*)::integer
    from public.subject_group_memberships
    where class_subject_id = '9c000000-0000-4000-8000-000000000001'
  ),
  0,
  'Class Group memberships are deleted'
);

select is(
  (
    select count(*)::integer
    from public.teaching_assignments
    where class_subject_id = '9c000000-0000-4000-8000-000000000001'
  ),
  0,
  'Class teaching assignments are deleted'
);

select is(
  (
    select count(*)::integer
    from public.subjects
    where id = '9b000000-0000-4000-8000-000000000001'
  ),
  1,
  'shared Subject record itself is preserved'
);

select is(
  (
    select count(*)::integer
    from public.students
    where id = '9e000000-0000-4000-8000-000000000001'
  ),
  1,
  'student record itself is preserved'
);

select * from finish();
rollback;
