begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(31);

select has_table('public', 'classes', 'classes table exists');
select has_table('public', 'subjects', 'subjects table exists');
select has_table('public', 'class_subjects', 'class_subjects table exists');
select has_table('public', 'subject_groups', 'subject_groups table exists');
select has_table('public', 'class_enrollments', 'class_enrollments table exists');
select has_table('public', 'subject_exclusions', 'subject_exclusions table exists');
select has_table('public', 'subject_group_memberships', 'subject_group_memberships table exists');
select has_table('public', 'teaching_assignments', 'teaching_assignments table exists');

select has_function(
  'public', 'create_subject_group', array['uuid', 'text', 'text'],
  'create_subject_group helper exists'
);
select has_function(
  'public', 'student_participates_in_class_subject', array['uuid', 'uuid', 'date'],
  'student participation helper exists'
);
select has_function(
  'public', 'teacher_can_teach_context', array['uuid', 'uuid', 'uuid', 'date'],
  'teacher context helper exists'
);

select lives_ok($setup$
  insert into public.schools (id, name_en, name_ar, timezone, default_language)
  values (
    '70000000-0000-0000-0000-000000000002',
    'Second School',
    'مدرسة ثانية',
    'America/Edmonton',
    'en'
  );

  insert into public.classes (id, school_id, name_en, name_ar) values
    ('71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Class A', 'الصف أ'),
    ('71000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Class B', 'الصف ب'),
    ('71000000-0000-0000-0000-000000000099', '70000000-0000-0000-0000-000000000002', 'Other Class', 'صف آخر');

  insert into public.subjects (id, school_id, name_en, name_ar) values
    ('72000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Quran', 'القرآن'),
    ('72000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Arabic', 'العربية'),
    ('72000000-0000-0000-0000-000000000099', '70000000-0000-0000-0000-000000000002', 'Other Subject', 'مادة أخرى');

  insert into public.class_subjects (id, school_id, class_id, subject_id) values
    ('73000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001'),
    ('73000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002'),
    ('73000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001');

  insert into public.subject_groups (id, school_id, class_subject_id, name_en, name_ar) values
    ('74000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Quran A', 'قرآن أ'),
    ('74000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Quran B', 'قرآن ب'),
    ('74000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'Arabic A', 'عربي أ');

  update public.class_subjects
  set default_group_id = case id
    when '73000000-0000-0000-0000-000000000001'::uuid then '74000000-0000-0000-0000-000000000001'::uuid
    when '73000000-0000-0000-0000-000000000002'::uuid then '74000000-0000-0000-0000-000000000003'::uuid
    else default_group_id
  end
  where id in (
    '73000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000002'
  );
$setup$, 'foundation rows can be created with school-safe references');

select lives_ok($enrollment$
  insert into public.class_enrollments (
    id, school_id, class_id, student_id, starts_on
  ) values (
    '75000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    date '2026-09-01'
  );
$enrollment$, 'student can have one active Class enrollment');

select throws_ok($overlap$
  insert into public.class_enrollments (
    id, school_id, class_id, student_id, starts_on
  ) values (
    '75000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000001',
    date '2026-09-15'
  );
$overlap$, '23P01', 'conflicting key value violates exclusion constraint "class_enrollments_one_active_class_per_student"', 'student cannot have overlapping active Classes');

select lives_ok($memberships$
  insert into public.subject_group_memberships (
    id, school_id, class_subject_id, subject_group_id, student_id, starts_on
  ) values
    (
      '76000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000001',
      date '2026-09-01'
    ),
    (
      '76000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000002',
      '74000000-0000-0000-0000-000000000003',
      'e0000000-0000-0000-0000-000000000001',
      date '2026-09-01'
    );
$memberships$, 'same student can be in different Groups for different Subjects');

select throws_ok($group_overlap$
  insert into public.subject_group_memberships (
    id, school_id, class_subject_id, subject_group_id, student_id, starts_on
  ) values (
    '76000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000001',
    date '2026-09-10'
  );
$group_overlap$, '23P01', 'conflicting key value violates exclusion constraint "subject_group_memberships_one_group_per_class_subject"', 'student cannot have overlapping Groups in one Class Subject');

select lives_ok($change_default$
  update public.class_subjects
  set default_group_id = '74000000-0000-0000-0000-000000000002'
  where id = '73000000-0000-0000-0000-000000000001';
$change_default$, 'admin can change a Class Subject default Group');

select is(
  (
    select subject_group_id
    from public.subject_group_memberships
    where id = '76000000-0000-0000-0000-000000000001'
  ),
  '74000000-0000-0000-0000-000000000001'::uuid,
  'changing default Group does not move an existing student'
);

select lives_ok($teachers$
  insert into public.teaching_assignments (
    id, school_id, teacher_profile_id, class_subject_id, subject_group_id, starts_on
  ) values
    (
      '77000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000001',
      null,
      date '2026-09-01'
    ),
    (
      '77000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000003',
      '73000000-0000-0000-0000-000000000001',
      null,
      date '2026-09-01'
    ),
    (
      '77000000-0000-0000-0000-000000000003',
      'a0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000001',
      date '2026-09-01'
    ),
    (
      '77000000-0000-0000-0000-000000000004',
      'a0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000003',
      '73000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000001',
      date '2026-09-01'
    ),
    (
      '77000000-0000-0000-0000-000000000005',
      'a0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000001',
      date '2026-09-01'
    );
$teachers$, 'multiple teachers can share a Class Subject or Group');

select throws_ok($duplicate_teacher$
  insert into public.teaching_assignments (
    id, school_id, teacher_profile_id, class_subject_id, subject_group_id, starts_on
  ) values (
    '77000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001',
    null,
    date '2026-09-15'
  );
$duplicate_teacher$, '23P01', 'conflicting key value violates exclusion constraint "teaching_assignments_no_duplicate_overlap"', 'duplicate overlapping teacher assignment is rejected');

select throws_ok($cross_school$
  insert into public.class_subjects (
    id, school_id, class_id, subject_id
  ) values (
    '73000000-0000-0000-0000-000000000098',
    'a0000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000099'
  );
$cross_school$, '23503', 'insert or update on table "class_subjects" violates foreign key constraint "class_subjects_subject_school_fk"', 'cross-school Subject reference is rejected');

select throws_ok($wrong_group_context$
  insert into public.subject_group_memberships (
    id, school_id, class_subject_id, subject_group_id, student_id, starts_on
  ) values (
    '76000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000002',
    date '2026-09-01'
  );
$wrong_group_context$, '23503', 'insert or update on table "subject_group_memberships" violates foreign key constraint "subject_group_memberships_group_context_fk"', 'Group must belong to the supplied Class Subject');

select lives_ok(
  $$select public.create_subject_group(
    '73000000-0000-0000-0000-000000000003', 'First generated Group', 'المجموعة الأولى'
  )$$,
  'first Group can be created through the school-scoped helper'
);
select lives_ok(
  $$select public.create_subject_group(
    '73000000-0000-0000-0000-000000000003', 'Second generated Group', 'المجموعة الثانية'
  )$$,
  'second Group can be created through the helper'
);
select is(
  (
    select cs.default_group_id
    from public.class_subjects cs
    where cs.id = '73000000-0000-0000-0000-000000000003'
  ),
  (
    select sg.id
    from public.subject_groups sg
    where sg.class_subject_id = '73000000-0000-0000-0000-000000000003'
      and sg.name_en = 'First generated Group'
  ),
  'the first created Group becomes default and later Groups do not replace it'
);

select ok(
  public.student_participates_in_class_subject(
    'e0000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000002',
    date '2026-09-15'
  ),
  'enrolled student participates in an active Class Subject by default'
);

select lives_ok($exclude_student$
  insert into public.subject_exclusions (
    id, school_id, class_subject_id, student_id, starts_on
  ) values (
    '78000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000001',
    date '2026-09-10'
  );
$exclude_student$, 'student can be explicitly excluded from one Subject');

select ok(
  not public.student_participates_in_class_subject(
    'e0000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000002',
    date '2026-09-15'
  ),
  'Subject exclusion removes only that Subject participation'
);

select ok(
  public.teacher_can_teach_context(
    'c0000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000002',
    date '2026-09-15'
  ),
  'whole-Class-Subject assignment grants access to every Group in that Subject'
);
select ok(
  public.teacher_can_teach_context(
    'c0000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    date '2026-09-15'
  ),
  'exact Group assignment grants access to that Group'
);
select ok(
  not public.teacher_can_teach_context(
    'c0000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000002',
    date '2026-09-15'
  ),
  'exact Group assignment does not grant a sibling Group'
);

select * from finish();
rollback;
