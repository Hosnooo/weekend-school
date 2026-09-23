begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

select has_table('public', 'weekly_submissions', 'independent weekly submissions table exists');
select has_table('public', 'weekly_submission_students', 'per-student weekly observations table exists');

-- Dedicated Class/Subject/Group fixtures for independent teacher-authored submissions.
insert into public.classes (id, school_id, name_en, name_ar) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Weekly Class', 'فصل الأسبوع');

insert into public.subjects (id, school_id, name_en, name_ar) values
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Weekly Quran', 'قرآن الأسبوع'),
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Weekly Arabic', 'عربي الأسبوع'),
  ('a2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Other Subject', 'مادة أخرى');

insert into public.class_subjects (id, school_id, class_id, subject_id) values
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003');

insert into public.subject_groups (id, school_id, class_subject_id, name_en, name_ar) values
  ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'Quran Group A', 'مجموعة القرآن أ'),
  ('a4000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'Other Group', 'مجموعة أخرى');

-- Ahmed (English teacher) has whole-Subject Quran access and whole-class Arabic.
-- Omar (Arabic teacher) shares Quran Group A exactly.
insert into public.teaching_assignments (
  id, school_id, teacher_profile_id, class_subject_id, subject_group_id, starts_on
) values
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', null, date '2026-09-01'),
  ('a5000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', date '2026-09-01'),
  ('a5000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000002', null, date '2026-09-01');

insert into public.class_enrollments (
  id, school_id, class_id, student_id, starts_on
) values (
  'a6000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', date '2026-09-01'
);
insert into public.subject_group_memberships (
  id, school_id, class_subject_id, subject_group_id, student_id, starts_on
) values (
  'a7000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001', date '2026-09-01'
);

select lives_ok($teacher_one$
  insert into public.weekly_submissions (
    id, school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start
  ) values (
    'a8000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002', date '2026-09-20'
  );
$teacher_one$, 'first teacher can author Quran Group A for the week');

select lives_ok($teacher_two$
  insert into public.weekly_submissions (
    id, school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start
  ) values (
    'a8000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003', date '2026-09-20'
  );
$teacher_two$, 'co-teacher can author the same teaching context in the same week');

select throws_ok($duplicate$
  insert into public.weekly_submissions (
    school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', date '2026-09-20'
  );
$duplicate$, '23505', null, 'one teacher cannot duplicate one logical context/week submission');

select lives_ok($whole_class$
  insert into public.weekly_submissions (
    id, school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start
  ) values (
    'a8000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000002', null,
    'c0000000-0000-0000-0000-000000000002', date '2026-09-20'
  );
$whole_class$, 'a whole-class Subject stores subject_group_id = null');

select throws_ok($wrong_group$
  insert into public.weekly_submissions (
    school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', date '2026-09-27'
  );
$wrong_group$, '23503', null, 'Group must belong to the submitted Class Subject');

select throws_ok($unassigned_teacher$
  insert into public.weekly_submissions (
    school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', date '2026-09-20'
  );
$unassigned_teacher$, '42501', null, 'submission author must have an effective teaching assignment');

select throws_ok($late$
  insert into public.weekly_submission_students (
    school_id, submission_id, student_id, attendance_status
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001', 'LATE'
  );
$late$, '23514', null, 'Late cannot be stored in the new weekly attendance observation');

select throws_ok($excused$
  insert into public.weekly_submission_students (
    school_id, submission_id, student_id, attendance_status
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001', 'EXCUSED'
  );
$excused$, '23514', null, 'Excused cannot be stored in the new weekly attendance observation');

select * from finish();
rollback;
