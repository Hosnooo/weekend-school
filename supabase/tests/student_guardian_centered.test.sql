begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

select has_column(
  'public',
  'guardians',
  'phone',
  'Guardians have a phone field'
);

select has_function(
  'public',
  'create_student_with_enrollment_v2',
  array[
    'text','text','text','text','text','text','text',
    'public.report_language','uuid','date','jsonb'
  ],
  'optional-Guardian Student creation RPC exists'
);

select has_function(
  'public',
  'link_student_guardian',
  array[
    'uuid','text','text','text',
    'public.report_language','boolean','boolean'
  ],
  'Student Guardian link RPC exists'
);

select has_function(
  'public',
  'update_student_guardian_link',
  array[
    'uuid','uuid','text','text','text',
    'public.report_language','boolean','boolean'
  ],
  'Student Guardian update RPC exists'
);

select has_function(
  'public',
  'unlink_student_guardian',
  array['uuid','uuid'],
  'Student Guardian unlink RPC exists'
);

insert into public.classes (
  id,
  school_id,
  name_en
) values (
  '9a000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Guardian Workflow Class'
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

create temporary table guardian_students (
  key text primary key,
  id uuid not null
);

select lives_ok($student_one$
  insert into guardian_students(key, id)
  select
    'one',
    public.create_student_with_enrollment_v2(
      'No',
      'Guardian',
      '',
      '',
      null,
      null,
      null,
      'en'::public.report_language,
      '9a000000-0000-4000-8000-000000000001',
      date '2026-09-26',
      '[]'::jsonb
    );
$student_one$, 'Student can be created without a Guardian');

select results_eq(
  $$select count(*)::bigint
    from public.student_guardians
    where student_id = (
      select id from guardian_students where key = 'one'
    )$$,
  array[0::bigint],
  'Student without Guardian has no fabricated Guardian link'
);

select lives_ok($first_guardian$
  select public.link_student_guardian(
    (select id from guardian_students where key = 'one'),
    'Fatima Ahmed',
    'fatima.guardian@example.test',
    '+1 780 555 0100',
    'en'::public.report_language,
    false,
    false
  );
$first_guardian$, 'First Guardian can be linked');

select results_eq(
  $$select is_primary, receives_reports
    from public.student_guardians
    where student_id = (
      select id from guardian_students where key = 'one'
    )$$,
  $$values (true, true)$$,
  'First Guardian defaults to Primary and receives reports'
);

select lives_ok($student_two$
  insert into guardian_students(key, id)
  select
    'two',
    public.create_student_with_enrollment_v2(
      'Sibling',
      'Student',
      '',
      '',
      null,
      null,
      null,
      'en'::public.report_language,
      '9a000000-0000-4000-8000-000000000001',
      date '2026-09-26',
      '[]'::jsonb
    );
$student_two$, 'Second Student can be created without a Guardian');

select lives_ok($reuse_guardian$
  select public.link_student_guardian(
    (select id from guardian_students where key = 'two'),
    'Different Submitted Name',
    'fatima.guardian@example.test',
    '+1 780 555 9999',
    'ar'::public.report_language,
    false,
    true
  );
$reuse_guardian$, 'Existing same-school Guardian email is reused');

select results_eq(
  $$select count(*)::bigint
    from public.guardians
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and email = 'fatima.guardian@example.test'$$,
  array[1::bigint],
  'Sibling linking does not duplicate the Guardian'
);

select results_eq(
  $$select phone
    from public.guardians
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and email = 'fatima.guardian@example.test'$$,
  array['+1 780 555 0100'::text],
  'Reusing a Guardian does not silently overwrite existing contact data'
);

select throws_ok(
  $$select public.link_student_guardian(
    (select id from guardian_students where key = 'one'),
    'Fatima Ahmed',
    'fatima.guardian@example.test',
    '+1 780 555 0100',
    'en'::public.report_language,
    true,
    true
  )$$,
  '23505',
  null,
  'Duplicate Student/Guardian link is rejected'
);

select lives_ok($second_guardian$
  select public.link_student_guardian(
    (select id from guardian_students where key = 'one'),
    'Omar Ahmed',
    'omar.guardian@example.test',
    '+1 780 555 0200',
    'both'::public.report_language,
    true,
    true
  );
$second_guardian$, 'A second Guardian can become Primary');

select results_eq(
  $$select count(*)::bigint
    from public.student_guardians
    where student_id = (
      select id from guardian_students where key = 'one'
    )
      and is_primary$$,
  array[1::bigint],
  'A Student has at most one Primary Guardian'
);

select lives_ok($unlink$
  select public.unlink_student_guardian(
    (select id from guardian_students where key = 'one'),
    (
      select id
      from public.guardians
      where email = 'omar.guardian@example.test'
        and school_id = 'a0000000-0000-0000-0000-000000000001'
    )
  );
$unlink$, 'Guardian can be unlinked from one Student');

select results_eq(
  $$select count(*)::bigint
    from public.guardians
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and email = 'omar.guardian@example.test'$$,
  array[1::bigint],
  'Unlinking does not delete the Guardian record'
);

select results_eq(
  $$select count(*)::bigint
    from public.student_guardians
    where guardian_id = (
      select id
      from public.guardians
      where email = 'fatima.guardian@example.test'
        and school_id = 'a0000000-0000-0000-0000-000000000001'
    )$$,
  array[2::bigint],
  'One Guardian can be linked to multiple Students'
);

select results_eq(
  $$select count(*)::bigint
    from public.guardians
    where phone is not null
      and length(trim(phone)) = 0$$,
  array[0::bigint],
  'Stored non-null Guardian phone numbers are nonblank'
);

select * from finish();
rollback;
