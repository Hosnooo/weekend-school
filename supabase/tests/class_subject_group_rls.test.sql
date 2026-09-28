begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

-- Build an academic context in the seeded school plus one row in a second tenant.
insert into public.schools (id, name_en, name_ar, timezone, default_language)
values ('81000000-0000-0000-0000-000000000099', 'Other Academic School', 'مدرسة أخرى', 'America/Edmonton', 'en');

insert into public.classes (id, school_id, name_en, name_ar) values
  ('81000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Class RLS', 'صف الصلاحيات'),
  ('81000000-0000-0000-0000-000000000099', '81000000-0000-0000-0000-000000000099', 'Other Class', 'صف آخر');

insert into public.subjects (id, school_id, name_en, name_ar) values
  ('82000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'RLS Subject', 'مادة الصلاحيات'),
  ('82000000-0000-0000-0000-000000000099', '81000000-0000-0000-0000-000000000099', 'Other Subject', 'مادة أخرى');

insert into public.class_subjects (id, school_id, class_id, subject_id) values
  ('83000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001'),
  ('83000000-0000-0000-0000-000000000099', '81000000-0000-0000-0000-000000000099', '81000000-0000-0000-0000-000000000099', '82000000-0000-0000-0000-000000000099');

insert into public.subject_groups (id, school_id, class_subject_id, name_en, name_ar) values
  ('84000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Group A', 'المجموعة أ'),
  ('84000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Group B', 'المجموعة ب'),
  ('84000000-0000-0000-0000-000000000099', '81000000-0000-0000-0000-000000000099', '83000000-0000-0000-0000-000000000099', 'Other Group', 'مجموعة أخرى');

-- Dedicated students are intentionally not present in legacy group_memberships so this suite
-- measures only the new Class/Subject/Group authorization model.
insert into public.students (id, school_id, first_name_en, last_name_en, is_active) values
  ('e0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'Academic', 'One', true),
  ('e0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'Academic', 'Two', true),
  ('e0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'Academic', 'Three', true);

insert into public.class_enrollments (id, school_id, class_id, student_id, starts_on) values
  ('85000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000013', current_date - 10),
  ('85000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000014', current_date - 10),
  ('85000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000015', current_date - 10);

insert into public.subject_group_memberships (id, school_id, class_subject_id, subject_group_id, student_id, starts_on) values
  ('86000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000013', current_date - 10),
  ('86000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000014', current_date - 10),
  ('86000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000015', current_date - 10);

insert into public.subject_exclusions (id, school_id, class_subject_id, student_id, starts_on) values
  ('87000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000014', current_date - 5);

-- Teacher 1 covers the full Subject. Teacher 2 covers only Group A.
insert into public.teaching_assignments (id, school_id, teacher_id, class_subject_id, subject_group_id, starts_on) values
  ('88000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000001', null, current_date - 10),
  ('88000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', current_date - 10);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Admin is same-school only and can manage its academic structure.
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select count(*)::bigint from public.classes where id in (
    '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000099'
  )$$,
  array[1::bigint],
  'admin sees only own-school Classes'
);
select results_eq(
  $$update public.classes set name_en = 'Class RLS Updated'
    where id = '81000000-0000-0000-0000-000000000001' returning id$$,
  array['81000000-0000-0000-0000-000000000001'::uuid],
  'admin can update an own-school Class'
);
select is_empty(
  $$update public.classes set name_en = 'Cross school write'
    where id = '81000000-0000-0000-0000-000000000099' returning id$$,
  'admin cannot update another school Class'
);

-- Whole-Subject teacher sees all active Groups and participating non-excluded students.
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select count(*)::bigint from public.subject_groups
    where class_subject_id = '83000000-0000-0000-0000-000000000001'$$,
  array[2::bigint],
  'whole-Subject teacher sees every Group in the Subject'
);
select results_eq(
  $$select count(*)::bigint from public.students
    where id in (
      'e0000000-0000-0000-0000-000000000013',
      'e0000000-0000-0000-0000-000000000014',
      'e0000000-0000-0000-0000-000000000015'
    )$$,
  array[2::bigint],
  'whole-Subject teacher sees participating students but not the excluded student'
);
select results_eq(
  $$select count(*)::bigint from public.classes where id = '81000000-0000-0000-0000-000000000099'$$,
  array[0::bigint],
  'teacher cannot read another school Class by identifier'
);

-- Exact-Group teacher sees only that Group and its participating roster.
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select count(*)::bigint from public.subject_groups
    where id in (
      '84000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000002'
    )$$,
  array[2::bigint],
  'historical Group-assigned teacher sees every Group in the Subject'
);
select results_eq(
  $$select count(*)::bigint from public.students
    where id in (
      'e0000000-0000-0000-0000-000000000013',
      'e0000000-0000-0000-0000-000000000014',
      'e0000000-0000-0000-0000-000000000015'
    )$$,
  array[2::bigint],
  'historical Group-assigned teacher sees all non-excluded Subject participants'
);
select results_eq(
  $$select count(*)::bigint from public.subject_group_memberships
    where subject_group_id = '84000000-0000-0000-0000-000000000002'$$,
  array[1::bigint],
  'historical Group-assigned teacher can read sibling Group memberships'
);
select results_eq(
  $$select count(*)::bigint from public.teaching_assignments$$,
  array[1::bigint],
  'teacher sees only their own teaching assignment rows'
);
select throws_ok(
  $$insert into public.classes (school_id, name_en) values (
    'a0000000-0000-0000-0000-000000000001', 'Teacher Created Class'
  )$$,
  '42501',
  'new row violates row-level security policy for table "classes"',
  'teacher cannot create school structure'
);

-- Inactive teacher loses all academic access and cannot write. Clear the JWT subject before
-- changing the profile so the existing profile-protection trigger sees an internal setup write.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set is_active = false where id = 'c0000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select count(*)::bigint from public.class_subjects where id = '83000000-0000-0000-0000-000000000001'$$,
  array[0::bigint],
  'inactive teacher cannot read the former teaching context'
);
select throws_ok(
  $$insert into public.subject_group_memberships (
      school_id, class_subject_id, subject_group_id, student_id, starts_on
    ) values (
      'a0000000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000013',
      current_date
    )$$,
  '42501',
  'new row violates row-level security policy for table "subject_group_memberships"',
  'inactive teacher cannot write academic membership data'
);

-- Anonymous callers must not execute the security-definer academic helpers.
reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select throws_ok(
  $$select public.teacher_can_teach_context(
    'c0000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000001',
    null,
    current_date
  )$$,
  '42501',
  null,
  'anon cannot execute teaching-context helper'
);
select throws_ok(
  $$select public.student_participates_in_class_subject(
    'e0000000-0000-0000-0000-000000000013',
    '83000000-0000-0000-0000-000000000001',
    current_date
  )$$,
  '42501',
  null,
  'anon cannot execute participation helper'
);

select * from finish();
rollback;
