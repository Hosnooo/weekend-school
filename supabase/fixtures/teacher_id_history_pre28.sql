-- Task 3 upgrade-path fixture.
-- This file is loaded only after migrations 1-27 + seed.sql and before migration 28,
-- so it intentionally uses the legacy Profile-owned teaching columns.

insert into public.classes (id, school_id, name_en, name_ar)
values (
  '3a000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Task 3 Legacy Class',
  'فصل ترحيل المعلم'
);

insert into public.subjects (id, school_id, name_en, name_ar)
values (
  '3b000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Task 3 Legacy Subject',
  'مادة ترحيل المعلم'
);

insert into public.class_subjects (id, school_id, class_id, subject_id)
values (
  '3c000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '3a000000-0000-0000-0000-000000000001',
  '3b000000-0000-0000-0000-000000000001'
);

insert into public.teaching_assignments (
  id, school_id, teacher_profile_id, class_subject_id, subject_group_id, starts_on
) values (
  '3e000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '3c000000-0000-0000-0000-000000000001',
  null,
  date '2026-09-01'
);

insert into public.weekly_submissions (
  id, school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start,
  status, progress_en
) values (
  '3f000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '3c000000-0000-0000-0000-000000000001',
  null,
  'c0000000-0000-0000-0000-000000000002',
  date '2026-09-21',
  'DRAFT',
  'Legacy Teacher history preserved through Task 3'
);
