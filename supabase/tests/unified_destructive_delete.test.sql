begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

-- =========================================================
-- GROUP
-- Deleting a Group removes Group-owned data only.
-- Student and Class enrollment remain.
-- =========================================================

insert into public.students (
  id, school_id, first_name_en, last_name_en, is_active
) values (
  '91000000-0000-4000-8000-000000000101',
  'a0000000-0000-0000-0000-000000000001',
  'Group',
  'Student',
  true
);


insert into public.classes (
  id, school_id, name_en, is_active
) values (
  '91100000-0000-4000-8000-000000000101',
  'a0000000-0000-0000-0000-000000000001',
  'Group Parent Class',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values (
  '91100000-0000-4000-8000-000000000102',
  'a0000000-0000-0000-0000-000000000001',
  'Group Parent Subject',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values (
  '91100000-0000-4000-8000-000000000103',
  'a0000000-0000-0000-0000-000000000001',
  '91100000-0000-4000-8000-000000000101',
  '91100000-0000-4000-8000-000000000102',
  true
);

insert into public.class_enrollments (
  id, school_id, class_id, student_id, starts_on
) values (
  '91000000-0000-4000-8000-000000000102',
  'a0000000-0000-0000-0000-000000000001',
  '91100000-0000-4000-8000-000000000101',
  '91000000-0000-4000-8000-000000000101',
  date '2026-09-01'
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, is_active
) values (
  '91000000-0000-4000-8000-000000000103',
  'a0000000-0000-0000-0000-000000000001',
  '91100000-0000-4000-8000-000000000103',
  'Temporary Group',
  true
);

insert into public.subject_group_memberships (
  id,
  school_id,
  class_subject_id,
  subject_group_id,
  student_id,
  starts_on
) values (
  '91000000-0000-4000-8000-000000000104',
  'a0000000-0000-0000-0000-000000000001',
  '91100000-0000-4000-8000-000000000103',
  '91000000-0000-4000-8000-000000000103',
  '91000000-0000-4000-8000-000000000101',
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
  '91000000-0000-4000-8000-000000000105',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '91100000-0000-4000-8000-000000000103',
  '91000000-0000-4000-8000-000000000103',
  date '2026-09-01'
);

insert into public.weekly_submissions (
  id,
  school_id,
  class_subject_id,
  subject_group_id,
  teacher_id,
  week_start,
  status
) values (
  '91000000-0000-4000-8000-000000000106',
  'a0000000-0000-0000-0000-000000000001',
  '91100000-0000-4000-8000-000000000103',
  '91000000-0000-4000-8000-000000000103',
  'c0000000-0000-0000-0000-000000000002',
  date '2026-10-05',
  'DRAFT'
);

insert into public.weekly_submission_students (
  id,
  school_id,
  submission_id,
  student_id,
  attendance_status
) values (
  '91000000-0000-4000-8000-000000000107',
  'a0000000-0000-0000-0000-000000000001',
  '91000000-0000-4000-8000-000000000106',
  '91000000-0000-4000-8000-000000000101',
  'PRESENT'
);

update public.weekly_submissions
set
  status = 'SUBMITTED',
  submitted_at = now()
where id = '91000000-0000-4000-8000-000000000106';

update public.class_subjects
set default_group_id = '91000000-0000-4000-8000-000000000103'
where id = '91100000-0000-4000-8000-000000000103';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$select public.archive_entity(
    'GROUP',
    '91000000-0000-4000-8000-000000000103'
  )$$,
  'Group can be archived'
);

select lives_ok(
  $$select public.permanently_delete_archived_entity(
    'GROUP',
    '91000000-0000-4000-8000-000000000103',
    'Temporary Group'
  )$$,
  'Group can be permanently deleted by name'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.subject_groups
    where id = '91000000-0000-4000-8000-000000000103'
  ),
  0,
  'Group row is removed'
);

select is(
  (
    select count(*)::integer
    from public.subject_group_memberships
    where subject_group_id =
      '91000000-0000-4000-8000-000000000103'
  ),
  0,
  'Group memberships are removed'
);

select is(
  (
    select count(*)::integer
    from public.teaching_assignments
    where subject_group_id =
      '91000000-0000-4000-8000-000000000103'
  ),
  0,
  'Group-specific assignments are removed'
);

select is(
  (
    select count(*)::integer
    from public.weekly_submissions
    where subject_group_id =
      '91000000-0000-4000-8000-000000000103'
  ),
  0,
  'Group weekly history is removed'
);

select is(
  (
    select count(*)::integer
    from public.class_enrollments
    where student_id =
      '91000000-0000-4000-8000-000000000101'
  ),
  1,
  'Student remains enrolled in mother Class'
);

select is(
  (
    select count(*)::integer
    from public.students
    where id =
      '91000000-0000-4000-8000-000000000101'
  ),
  1,
  'Student itself remains'
);

select ok(
  (
    select default_group_id is null
    from public.class_subjects
    where id =
      '91100000-0000-4000-8000-000000000103'
  ),
  'Deleting default Group leaves Subject with no default Group'
);

-- =========================================================
-- SUBJECT
-- Delete Subject-owned Class usages; preserve Class itself.
-- =========================================================


insert into public.classes (
  id, school_id, name_en, is_active
) values (
  '92100000-0000-4000-8000-000000000101',
  'a0000000-0000-0000-0000-000000000001',
  'Subject Parent Class',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values (
  '92000000-0000-4000-8000-000000000101',
  'a0000000-0000-0000-0000-000000000001',
  'Temporary Subject',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values (
  '92000000-0000-4000-8000-000000000102',
  'a0000000-0000-0000-0000-000000000001',
  '92100000-0000-4000-8000-000000000101',
  '92000000-0000-4000-8000-000000000101',
  true
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, is_active
) values (
  '92000000-0000-4000-8000-000000000103',
  'a0000000-0000-0000-0000-000000000001',
  '92000000-0000-4000-8000-000000000102',
  'Temporary Subject Group',
  true
);

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '92000000-0000-4000-8000-000000000104',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '92000000-0000-4000-8000-000000000102',
  '92000000-0000-4000-8000-000000000103',
  date '2026-09-01'
);

insert into public.weekly_submissions (
  id,
  school_id,
  class_subject_id,
  subject_group_id,
  teacher_id,
  week_start,
  status
) values (
  '92000000-0000-4000-8000-000000000105',
  'a0000000-0000-0000-0000-000000000001',
  '92000000-0000-4000-8000-000000000102',
  '92000000-0000-4000-8000-000000000103',
  'c0000000-0000-0000-0000-000000000002',
  date '2026-10-12',
  'DRAFT'
);

update public.weekly_submissions
set
  status = 'SUBMITTED',
  submitted_at = now()
where id = '92000000-0000-4000-8000-000000000105';

set local role authenticated;

select lives_ok(
  $$select public.archive_entity(
    'SUBJECT',
    '92000000-0000-4000-8000-000000000101'
  )$$,
  'Subject can be archived'
);

select lives_ok(
  $$select public.permanently_delete_archived_entity(
    'SUBJECT',
    '92000000-0000-4000-8000-000000000101',
    'Temporary Subject'
  )$$,
  'Subject can delete all of its Class usages by name'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.subjects
    where id = '92000000-0000-4000-8000-000000000101'
  ),
  0,
  'Subject is removed'
);

select is(
  (
    select count(*)::integer
    from public.class_subjects
    where subject_id =
      '92000000-0000-4000-8000-000000000101'
  ),
  0,
  'Subject Class usages are removed'
);

select is(
  (
    select count(*)::integer
    from public.subject_groups
    where class_subject_id =
      '92000000-0000-4000-8000-000000000102'
  ),
  0,
  'Subject Groups are removed'
);

select is(
  (
    select count(*)::integer
    from public.classes
    where id =
      '92100000-0000-4000-8000-000000000101'
  ),
  1,
  'Parent Class remains'
);

-- =========================================================
-- TEACHER
-- Delete Teacher role data; preserve shared Profile.
-- =========================================================


insert into public.classes (
  id, school_id, name_en, is_active
) values (
  '93100000-0000-4000-8000-000000000101',
  'a0000000-0000-0000-0000-000000000001',
  'Teacher Parent Class',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values (
  '93100000-0000-4000-8000-000000000102',
  'a0000000-0000-0000-0000-000000000001',
  'Teacher Parent Subject',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values (
  '93100000-0000-4000-8000-000000000103',
  'a0000000-0000-0000-0000-000000000001',
  '93100000-0000-4000-8000-000000000101',
  '93100000-0000-4000-8000-000000000102',
  true
);

insert into public.teachers (
  id,
  school_id,
  display_name,
  email,
  preferred_language,
  is_active
) values (
  '93000000-0000-4000-8000-000000000101',
  'a0000000-0000-0000-0000-000000000001',
  'Temporary Teacher',
  'temporary.teacher@example.test',
  'en',
  true
);

insert into public.teacher_accounts (
  school_id,
  teacher_id,
  profile_id
) values (
  'a0000000-0000-0000-0000-000000000001',
  '93000000-0000-4000-8000-000000000101',
  'c0000000-0000-0000-0000-000000000002'
);

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '93000000-0000-4000-8000-000000000102',
  'a0000000-0000-0000-0000-000000000001',
  '93000000-0000-4000-8000-000000000101',
  '93100000-0000-4000-8000-000000000103',
  null,
  date '2026-10-01'
);

insert into public.weekly_submissions (
  id,
  school_id,
  class_subject_id,
  subject_group_id,
  teacher_id,
  week_start,
  status
) values (
  '93000000-0000-4000-8000-000000000103',
  'a0000000-0000-0000-0000-000000000001',
  '93100000-0000-4000-8000-000000000103',
  null,
  '93000000-0000-4000-8000-000000000101',
  date '2026-10-19',
  'DRAFT'
);

update public.weekly_submissions
set
  status = 'SUBMITTED',
  submitted_at = now()
where id = '93000000-0000-4000-8000-000000000103';

set local role authenticated;

select lives_ok(
  $$select public.archive_entity(
    'TEACHER',
    '93000000-0000-4000-8000-000000000101'
  )$$,
  'Teacher can be archived'
);

select lives_ok(
  $$select public.permanently_delete_archived_entity(
    'TEACHER',
    '93000000-0000-4000-8000-000000000101',
    'Temporary Teacher'
  )$$,
  'Teacher can be permanently deleted by name'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.teachers
    where id =
      '93000000-0000-4000-8000-000000000101'
  ),
  0,
  'Teacher record is removed'
);

select is(
  (
    select count(*)::integer
    from public.teacher_accounts
    where teacher_id =
      '93000000-0000-4000-8000-000000000101'
  ),
  0,
  'Teacher account links are removed'
);

select is(
  (
    select count(*)::integer
    from public.teaching_assignments
    where teacher_id =
      '93000000-0000-4000-8000-000000000101'
  ),
  0,
  'Teacher assignments are removed'
);

select is(
  (
    select count(*)::integer
    from public.weekly_submissions
    where teacher_id =
      '93000000-0000-4000-8000-000000000101'
  ),
  0,
  'Teacher-authored weekly rows are removed'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id =
      'c0000000-0000-0000-0000-000000000002'
  ),
  1,
  'shared login Profile remains'
);

-- =========================================================
-- GUARDIAN
-- Delete Guardian links; preserve Student.
-- =========================================================

insert into public.guardians (
  id,
  school_id,
  name,
  email,
  report_language,
  is_active
) values (
  '94000000-0000-4000-8000-000000000101',
  'a0000000-0000-0000-0000-000000000001',
  'Temporary Guardian',
  'temporary.guardian@example.test',
  'en',
  true
);

insert into public.student_guardians (
  school_id,
  student_id,
  guardian_id,
  receives_reports,
  is_primary
) values (
  'a0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  '94000000-0000-4000-8000-000000000101',
  true,
  false
);

set local role authenticated;

select lives_ok(
  $$select public.archive_entity(
    'GUARDIAN',
    '94000000-0000-4000-8000-000000000101'
  )$$,
  'Guardian can be archived'
);

select lives_ok(
  $$select public.permanently_delete_archived_entity(
    'GUARDIAN',
    '94000000-0000-4000-8000-000000000101',
    'Temporary Guardian'
  )$$,
  'Guardian can be permanently deleted by name'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.guardians
    where id =
      '94000000-0000-4000-8000-000000000101'
  ),
  0,
  'Guardian record is removed'
);

select is(
  (
    select count(*)::integer
    from public.student_guardians
    where guardian_id =
      '94000000-0000-4000-8000-000000000101'
  ),
  0,
  'Guardian Student links are removed'
);

select is(
  (
    select count(*)::integer
    from public.students
    where id =
      'e0000000-0000-0000-0000-000000000001'
  ),
  1,
  'linked Student remains'
);

select * from finish();
rollback;
