begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

select has_table(
  'public',
  'roster_imports',
  'roster import audit table exists'
);

select has_function(
  'public',
  'import_student_roster',
  array['text', 'jsonb'],
  'transactional roster import RPC exists'
);

-- Main-school academic structure.
insert into public.classes (
  id, school_id, name_en, is_active
) values (
  'a1000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Roster Import Class',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values
(
  'a2000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Roster Quran',
  true
),
(
  'a2000000-0000-4000-8000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Roster Arabic',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values
(
  'a3000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  true
),
(
  'a3000000-0000-4000-8000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000002',
  true
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, is_active
) values
(
  'a4000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'Default Quran',
  true
),
(
  'a4000000-0000-4000-8000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'Advanced Quran',
  true
),
(
  'a4000000-0000-4000-8000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'Arabic A',
  true
);

update public.class_subjects
set default_group_id = 'a4000000-0000-4000-8000-000000000001'
where id = 'a3000000-0000-4000-8000-000000000001';

insert into public.guardians (
  id,
  school_id,
  name,
  email,
  phone,
  report_language,
  is_active
) values (
  'a5000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Existing Roster Guardian',
  'existing.roster@example.test',
  '7805550100',
  'both',
  true
);

-- Other-school records prove that IDs cannot cross tenant boundaries.
insert into public.schools (
  id, name_en, name_ar, timezone, default_language
) values (
  'a0000000-0000-0000-0000-000000000099',
  'Roster Other School',
  'مدرسة أخرى',
  'America/Edmonton',
  'en'
);

insert into public.classes (
  id, school_id, name_en, is_active
) values (
  'a1000000-0000-4000-8000-000000000099',
  'a0000000-0000-0000-0000-000000000099',
  'Other School Class',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values (
  'a2000000-0000-4000-8000-000000000099',
  'a0000000-0000-0000-0000-000000000099',
  'Other Quran',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values (
  'a3000000-0000-4000-8000-000000000099',
  'a0000000-0000-0000-0000-000000000099',
  'a1000000-0000-4000-8000-000000000099',
  'a2000000-0000-4000-8000-000000000099',
  true
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, is_active
) values (
  'a4000000-0000-4000-8000-000000000099',
  'a0000000-0000-0000-0000-000000000099',
  'a3000000-0000-4000-8000-000000000099',
  'Other Group',
  true
);

set local role authenticated;

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

-- Seed administrator account.
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $admin_import$
    select public.import_student_roster(
      repeat('1', 64),
      '[
        {
          "firstNameEn": "RosterSara",
          "lastNameEn": "UniqueAli",
          "firstNameAr": "سارة",
          "lastNameAr": "علي",
          "guardianId": "a5000000-0000-4000-8000-000000000001",
          "guardianName": "Different Submitted Name",
          "guardianEmail": "existing.roster@example.test",
          "guardianPhone": "9999999999",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000001",
          "startsOn": "2026-09-01",
          "groups": [
            {
              "classSubjectId": "a3000000-0000-4000-8000-000000000001",
              "groupId": null
            },
            {
              "classSubjectId": "a3000000-0000-4000-8000-000000000002",
              "groupId": null
            }
          ]
        }
      ]'::jsonb
    )
  $admin_import$,
  'Administrator can import a roster'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.students
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and first_name_en = 'RosterSara'
      and last_name_en = 'UniqueAli'
  $$,
  array[1::bigint],
  'Roster import creates the Student'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.guardians
    where id = 'a5000000-0000-4000-8000-000000000001'
      and name = 'Existing Roster Guardian'
      and phone = '7805550100'
      and report_language = 'both'
  $$,
  array[1::bigint],
  'Existing Guardian is reused without modification'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.subject_group_memberships membership
    join public.students student
      on student.school_id = membership.school_id
     and student.id = membership.student_id
    where student.first_name_en = 'RosterSara'
      and student.last_name_en = 'UniqueAli'
      and membership.subject_group_id =
        'a4000000-0000-4000-8000-000000000001'
  $$,
  array[1::bigint],
  'Blank Quran Group uses the configured default Group'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.subject_group_memberships membership
    join public.students student
      on student.school_id = membership.school_id
     and student.id = membership.student_id
    where student.first_name_en = 'RosterSara'
      and student.last_name_en = 'UniqueAli'
      and membership.class_subject_id =
        'a3000000-0000-4000-8000-000000000002'
  $$,
  array[0::bigint],
  'Subject without a default may remain ungrouped'
);

select lives_ok(
  $siblings$
    select public.import_student_roster(
      repeat('2', 64),
      '[
        {
          "firstNameEn": "Omar",
          "lastNameEn": "Family",
          "guardianId": null,
          "guardianName": "Shared Parent",
          "guardianEmail": "shared.family@example.test",
          "guardianPhone": "7805550200",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000001",
          "startsOn": "2026-09-01",
          "groups": [
            {
              "classSubjectId": "a3000000-0000-4000-8000-000000000001",
              "groupId": "a4000000-0000-4000-8000-000000000002"
            }
          ]
        },
        {
          "firstNameEn": "Mariam",
          "lastNameEn": "Family",
          "guardianId": null,
          "guardianName": "Shared Parent",
          "guardianEmail": "SHARED.FAMILY@example.test",
          "guardianPhone": "7805550200",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000001",
          "startsOn": "2026-09-01",
          "groups": []
        }
      ]'::jsonb
    )
  $siblings$,
  'Sibling rows sharing one new Guardian email import together'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.guardians
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and email = 'shared.family@example.test'
  $$,
  array[1::bigint],
  'Sibling import creates the shared Guardian only once'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.student_guardians link
    join public.guardians guardian
      on guardian.school_id = link.school_id
     and guardian.id = link.guardian_id
    where guardian.email = 'shared.family@example.test'
  $$,
  array[2::bigint],
  'Shared Guardian is linked to both sibling Students'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.subject_group_memberships membership
    join public.students student
      on student.school_id = membership.school_id
     and student.id = membership.student_id
    where student.first_name_en = 'Omar'
      and membership.subject_group_id =
        'a4000000-0000-4000-8000-000000000002'
  $$,
  array[1::bigint],
  'Explicit per-Subject Group is honored'
);

select results_eq(
  $$
    select
      row_count::bigint,
      students_created::bigint,
      guardians_created::bigint
    from public.roster_imports
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and import_hash = repeat('2', 64)
  $$,
  $$
    values (2::bigint, 2::bigint, 1::bigint)
  $$,
  'Import audit records summary counts'
);

select throws_ok(
  $$
    select public.import_student_roster(
      repeat('2', 64),
      '[
        {
          "firstNameEn": "Duplicate",
          "lastNameEn": "Import",
          "guardianId": null,
          "guardianName": "Another Parent",
          "guardianEmail": "another@example.test",
          "guardianPhone": "7805550300",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000001",
          "startsOn": "2026-09-01",
          "groups": []
        }
      ]'::jsonb
    )
  $$,
  '23505',
  null,
  'Identical completed import hash is rejected'
);

select throws_ok(
  $$
    select public.import_student_roster(
      repeat('3', 64),
      '[
        {
          "firstNameEn": "Wrong",
          "lastNameEn": "School",
          "guardianId": null,
          "guardianName": "Wrong Parent",
          "guardianEmail": "wrong@example.test",
          "guardianPhone": "7805550400",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000099",
          "startsOn": "2026-09-01",
          "groups": []
        }
      ]'::jsonb
    )
  $$,
  '23503',
  null,
  'Cross-school Class ID is rejected'
);

select throws_ok(
  $$
    select public.import_student_roster(
      repeat('4', 64),
      '[
        {
          "firstNameEn": "Wrong",
          "lastNameEn": "Group",
          "guardianId": null,
          "guardianName": "Wrong Group Parent",
          "guardianEmail": "wrong.group@example.test",
          "guardianPhone": "7805550500",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000001",
          "startsOn": "2026-09-01",
          "groups": [
            {
              "classSubjectId": "a3000000-0000-4000-8000-000000000001",
              "groupId": "a4000000-0000-4000-8000-000000000099"
            }
          ]
        }
      ]'::jsonb
    )
  $$,
  '23503',
  null,
  'Cross-school or wrong-context Group ID is rejected'
);

select throws_ok(
  $$
    select public.import_student_roster(
      repeat('5', 64),
      '[
        {
          "firstNameEn": "Rollback",
          "lastNameEn": "Good",
          "guardianId": null,
          "guardianName": "Rollback Parent",
          "guardianEmail": "rollback@example.test",
          "guardianPhone": "7805550600",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000001",
          "startsOn": "2026-09-01",
          "groups": []
        },
        {
          "firstNameEn": "Rollback",
          "lastNameEn": "Bad",
          "guardianId": null,
          "guardianName": "Rollback Parent 2",
          "guardianEmail": "rollback2@example.test",
          "guardianPhone": "7805550601",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000099",
          "startsOn": "2026-09-01",
          "groups": []
        }
      ]'::jsonb
    )
  $$,
  '23503',
  null,
  'One invalid row aborts the complete import transaction'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.students
    where first_name_en = 'Rollback'
  $$,
  array[0::bigint],
  'Failed multi-row import leaves no partial Students'
);

-- Teacher account must not gain import capability.
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$
    select public.import_student_roster(
      repeat('6', 64),
      '[
        {
          "firstNameEn": "Teacher",
          "lastNameEn": "Denied",
          "guardianId": null,
          "guardianName": "Teacher Parent",
          "guardianEmail": "teacher.denied@example.test",
          "guardianPhone": "7805550700",
          "reportLanguage": "en",
          "classId": "a1000000-0000-4000-8000-000000000001",
          "startsOn": "2026-09-01",
          "groups": []
        }
      ]'::jsonb
    )
  $$,
  '42501',
  null,
  'Teacher cannot import a roster'
);

select * from finish();
rollback;
