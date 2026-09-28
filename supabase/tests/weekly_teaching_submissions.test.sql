begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

select has_table('public', 'weekly_submissions', 'independent weekly submissions table exists');
select has_table('public', 'weekly_submission_students', 'per-student weekly observations table exists');
select has_function(
  'public',
  'get_weekly_submission_roster',
  array['uuid','uuid','date'],
  'authorized weekly roster function exists'
);
select has_function(
  'public',
  'save_weekly_submission',
  array['uuid','uuid','uuid','date','text','text','public.performance_level','jsonb','jsonb','boolean'],
  'atomic weekly submission save function exists'
);
select has_function(
  'public',
  'get_weekly_submission_context',
  array['uuid'],
  'author-owned historical context function exists'
);

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

insert into public.teachers (id, school_id, display_name, email, preferred_language) values
  ('a9000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Unassigned Weekly Teacher', 'unassigned.weekly@example.test', 'en');

-- English Teacher has whole-Subject Quran access and whole-class Arabic.
-- Arabic Teacher shares Quran Group A exactly.
insert into public.teaching_assignments (
  id, school_id, teacher_id, class_subject_id, subject_group_id, starts_on
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
    id, school_id, class_subject_id, subject_group_id, teacher_id, week_start
  ) values (
    'a8000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002', date '2026-09-20'
  );
$teacher_one$, 'first teacher can author Quran Group A for the week');

select lives_ok($teacher_two$
  insert into public.weekly_submissions (
    id, school_id, class_subject_id, subject_group_id, teacher_id, week_start
  ) values (
    'a8000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003', date '2026-09-20'
  );
$teacher_two$, 'co-teacher can author the same teaching context in the same week');

select lives_ok($duplicate$
  insert into public.weekly_submissions (
    school_id, class_subject_id, subject_group_id, teacher_id, week_start
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', date '2026-09-20'
  );
$duplicate$, 'one teacher may create overlapping Teaching Updates for the same context and dates');

select lives_ok($whole_class$
  insert into public.weekly_submissions (
    id, school_id, class_subject_id, subject_group_id, teacher_id, week_start
  ) values (
    'a8000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000002', null,
    'c0000000-0000-0000-0000-000000000002', date '2026-09-20'
  );
$whole_class$, 'a whole-class Subject stores subject_group_id = null');

select throws_ok($wrong_group$
  insert into public.weekly_submissions (
    school_id, class_subject_id, subject_group_id, teacher_id, week_start
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', date '2026-09-27'
  );
$wrong_group$, '23503', null, 'Group must belong to the submitted Class Subject');

select throws_ok($unassigned_teacher$
  insert into public.weekly_submissions (
    school_id, class_subject_id, subject_group_id, teacher_id, week_start
  ) values (
    'a0000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', date '2026-09-20'
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

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select count(*)::bigint from public.weekly_submissions
    where class_subject_id = 'a3000000-0000-0000-0000-000000000001'
      and subject_group_id = 'a4000000-0000-0000-0000-000000000001'
      and week_start = date '2026-09-20'$$,
  array[2::bigint],
  'teacher history shows both own overlapping updates while excluding the co-teacher row'
);

select results_eq(
  $$select student_id from public.get_weekly_submission_roster(
    'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    date '2026-09-14'
  ) order by student_id$$,
  array['e0000000-0000-0000-0000-000000000001'::uuid],
  'authorized teacher receives only the dated roster for the teaching context'
);

select lives_ok($save_submission$
  select public.save_weekly_submission(
    null,
    'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    date '2026-09-14',
    'Reviewed memorization',
    null,
    'GOOD'::public.performance_level,
    '[{"student_id":"e0000000-0000-0000-0000-000000000001","status":"PRESENT"}]'::jsonb,
    '[{"student_id":"e0000000-0000-0000-0000-000000000001","performance_override":"EXCELLENT","comment_en":"Strong work","comment_ar":null}]'::jsonb,
    true
  );
$save_submission$, 'authorized teacher can atomically submit a complete weekly update');

select results_eq(
  $$select ws.status::text from public.weekly_submissions ws
    where ws.teacher_id = 'c0000000-0000-0000-0000-000000000002'
      and ws.class_subject_id = 'a3000000-0000-0000-0000-000000000001'
      and ws.subject_group_id = 'a4000000-0000-0000-0000-000000000001'
      and ws.week_start = date '2026-09-14'$$,
  array['SUBMITTED'::text],
  'atomic save finalizes the teacher-owned submission'
);

reset role;
update public.teaching_assignments
set ends_on = date '2026-09-20'
where id = 'a5000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select class_name_en, subject_name_en, group_name_en
    from public.get_weekly_submission_context('a8000000-0000-0000-0000-000000000001')$$,
  $$values ('Weekly Class'::text, 'Weekly Quran'::text, 'Quran Group A'::text)$$,
  'teacher retains context labels for an authored submission after the assignment ends'
);

reset role;
select * from finish();
rollback;
