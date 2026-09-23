begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

select has_function(
  'public',
  'create_student_with_enrollment',
  array['text','text','text','text','text','text','public.report_language','uuid','date','jsonb'],
  'atomic student creation with Class enrollment exists'
);
select has_function(
  'public', 'change_student_class', array['uuid','uuid','date'],
  'atomic Class change exists'
);
select has_function(
  'public', 'set_student_subject_excluded', array['uuid','uuid','boolean','date'],
  'atomic Subject inclusion/exclusion operation exists'
);
select has_function(
  'public', 'move_student_subject_group', array['uuid','uuid','uuid','date'],
  'atomic per-Subject Group move exists'
);

-- Dedicated Class/Subject fixtures for transaction-oriented enrollment behavior.
insert into public.classes (id, school_id, name_en, name_ar) values
  ('91000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Enrollment Class A', 'فصل التسجيل أ'),
  ('91000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Enrollment Class B', 'فصل التسجيل ب');

insert into public.subjects (id, school_id, name_en, name_ar) values
  ('92000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Enrollment Quran', 'قرآن التسجيل'),
  ('92000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Enrollment Arabic', 'عربي التسجيل'),
  ('92000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Enrollment Islamic', 'إسلامي التسجيل');

insert into public.class_subjects (id, school_id, class_id, subject_id) values
  ('93000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001'),
  ('93000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002'),
  ('93000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003'),
  ('93000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001');

insert into public.subject_groups (id, school_id, class_subject_id, name_en, name_ar) values
  ('94000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', 'Quran A', 'قرآن أ'),
  ('94000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', 'Quran B', 'قرآن ب'),
  ('94000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000004', 'New Class Quran', 'قرآن الفصل الجديد');

update public.class_subjects
set default_group_id = case id
  when '93000000-0000-0000-0000-000000000001'::uuid then '94000000-0000-0000-0000-000000000001'::uuid
  when '93000000-0000-0000-0000-000000000004'::uuid then '94000000-0000-0000-0000-000000000004'::uuid
  else default_group_id
end
where id in (
  '93000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000004'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

create temporary table enrollment_created_student (id uuid);
select lives_ok($create$
  with created as (
    select public.create_student_with_enrollment(
      'Enrollment',
      'Student',
      '',
      '',
      'Enrollment Guardian',
      'enrollment.guardian@example.test',
      'en'::public.report_language,
      '91000000-0000-0000-0000-000000000001',
      date '2026-09-01',
      '[{"classSubjectId":"93000000-0000-0000-0000-000000000003","included":false}]'::jsonb
    ) as id
  )
  insert into enrollment_created_student(id) select id from created;
$create$, 'student, guardian, Class enrollment, exclusions, and defaults are created atomically');

select results_eq(
  $$select count(*)::bigint from public.class_enrollments ce
    join enrollment_created_student x on x.id = ce.student_id
    where ce.class_id = '91000000-0000-0000-0000-000000000001'
      and ce.starts_on = date '2026-09-01'
      and ce.ends_on is null$$,
  array[1::bigint],
  'new student has exactly one active Class enrollment'
);
select results_eq(
  $$select sgm.subject_group_id from public.subject_group_memberships sgm
    join enrollment_created_student x on x.id = sgm.student_id
    where sgm.class_subject_id = '93000000-0000-0000-0000-000000000001'
      and sgm.ends_on is null$$,
  array['94000000-0000-0000-0000-000000000001'::uuid],
  'grouped Subject uses its default Group for a new student'
);
select results_eq(
  $$select count(*)::bigint from public.subject_group_memberships sgm
    join enrollment_created_student x on x.id = sgm.student_id
    where sgm.class_subject_id = '93000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'whole-class Subject stores no fake Group membership'
);
select results_eq(
  $$select count(*)::bigint from public.subject_exclusions se
    join enrollment_created_student x on x.id = se.student_id
    where se.class_subject_id = '93000000-0000-0000-0000-000000000003'
      and se.ends_on is null$$,
  array[1::bigint],
  'explicit Subject exclusion is stored for the new student'
);

select lives_ok($move_group$
  select public.move_student_subject_group(
    (select id from enrollment_created_student),
    '93000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000002',
    date '2026-09-20'
  );
$move_group$, 'student can move only within one Class Subject');
select results_eq(
  $$select ends_on from public.subject_group_memberships sgm
    join enrollment_created_student x on x.id = sgm.student_id
    where sgm.class_subject_id = '93000000-0000-0000-0000-000000000001'
      and sgm.subject_group_id = '94000000-0000-0000-0000-000000000001'$$,
  array[date '2026-09-19'],
  'old per-Subject Group membership is preserved and ended the day before the move'
);
select results_eq(
  $$select subject_group_id from public.subject_group_memberships sgm
    join enrollment_created_student x on x.id = sgm.student_id
    where sgm.class_subject_id = '93000000-0000-0000-0000-000000000001'
      and sgm.ends_on is null$$,
  array['94000000-0000-0000-0000-000000000002'::uuid],
  'new per-Subject Group membership is active after the move'
);

select lives_ok($include_subject$
  select public.set_student_subject_excluded(
    (select id from enrollment_created_student),
    '93000000-0000-0000-0000-000000000003',
    false,
    date '2026-09-22'
  );
$include_subject$, 'excluded Subject can be included again without inventing a Group');
select results_eq(
  $$select ends_on from public.subject_exclusions se
    join enrollment_created_student x on x.id = se.student_id
    where se.class_subject_id = '93000000-0000-0000-0000-000000000003'$$,
  array[date '2026-09-21'],
  'including a Subject preserves and ends its exclusion history'
);

select lives_ok($change_class$
  select public.change_student_class(
    (select id from enrollment_created_student),
    '91000000-0000-0000-0000-000000000002',
    date '2026-10-01'
  );
$change_class$, 'Class change is one atomic operation');
select results_eq(
  $$select class_id, starts_on, ends_on from public.class_enrollments ce
    join enrollment_created_student x on x.id = ce.student_id
    order by starts_on$$,
  $$values
    ('91000000-0000-0000-0000-000000000001'::uuid, date '2026-09-01', date '2026-09-30'),
    ('91000000-0000-0000-0000-000000000002'::uuid, date '2026-10-01', null::date)$$,
  'Class change preserves the old enrollment and opens the new Class'
);
select results_eq(
  $$select count(*)::bigint from public.subject_group_memberships sgm
    join enrollment_created_student x on x.id = sgm.student_id
    where sgm.ends_on is null
      and sgm.class_subject_id in (
        '93000000-0000-0000-0000-000000000001',
        '93000000-0000-0000-0000-000000000002',
        '93000000-0000-0000-0000-000000000003'
      )$$,
  array[0::bigint],
  'Class change ends active Group memberships from the old Class'
);
select results_eq(
  $$select subject_group_id from public.subject_group_memberships sgm
    join enrollment_created_student x on x.id = sgm.student_id
    where sgm.class_subject_id = '93000000-0000-0000-0000-000000000004'
      and sgm.ends_on is null$$,
  array['94000000-0000-0000-0000-000000000004'::uuid],
  'Class change initializes target grouped Subjects from their defaults'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select throws_ok(
  $$select public.change_student_class(
    'e0000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000002',
    date '2026-10-01'
  )$$,
  '42501',
  null,
  'anonymous callers cannot execute enrollment mutation helpers'
);

select * from finish();
rollback;
