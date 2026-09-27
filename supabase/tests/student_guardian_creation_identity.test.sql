begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_function(
  'public',
  'create_student_with_enrollment_v3',
  array[
    'text','text','text','text',
    'text','uuid',
    'text','text','text',
    'public.report_language',
    'uuid','date','jsonb'
  ],
  'explicit Guardian-identity Student creation RPC exists'
);

insert into public.classes (
  id,
  school_id,
  name_en
) values (
  '9b000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Guardian Identity Class'
);

insert into public.guardians (
  id,
  school_id,
  name,
  email,
  phone,
  report_language,
  is_active
) values
(
  '9b100000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Existing Parent',
  'existing.identity@example.test',
  '+1 780 555 0300',
  'en',
  true
),
(
  '9b100000-0000-4000-8000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Archived Parent',
  'archived.identity@example.test',
  '+1 780 555 0400',
  'ar',
  false
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

create temporary table identity_students (
  key text primary key,
  id uuid not null
);

select lives_ok($no_guardian$
  insert into identity_students(key, id)
  select
    'none',
    public.create_student_with_enrollment_v3(
      'No',
      'Guardian',
      '',
      '',
      'none',
      null,
      null,
      null,
      null,
      null,
      '9b000000-0000-4000-8000-000000000001',
      date '2026-09-27',
      '[]'::jsonb
    );
$no_guardian$, 'Student can explicitly be created without a Guardian');

select results_eq(
  $$select count(*)::bigint
    from public.student_guardians
    where student_id = (
      select id from identity_students where key = 'none'
    )$$,
  array[0::bigint],
  'No-Guardian mode creates no Guardian relationship'
);

select lives_ok($existing_guardian$
  insert into identity_students(key, id)
  select
    'existing',
    public.create_student_with_enrollment_v3(
      'Existing',
      'Child',
      '',
      '',
      'existing',
      '9b100000-0000-4000-8000-000000000001',
      null,
      null,
      null,
      null,
      '9b000000-0000-4000-8000-000000000001',
      date '2026-09-27',
      '[]'::jsonb
    );
$existing_guardian$, 'Existing Guardian is linked by explicit Guardian ID');

select results_eq(
  $$select guardian_id
    from public.student_guardians
    where student_id = (
      select id from identity_students where key = 'existing'
    )$$,
  array['9b100000-0000-4000-8000-000000000001'::uuid],
  'Existing mode links exactly the requested Guardian ID'
);

select lives_ok($archived_guardian$
  insert into identity_students(key, id)
  select
    'archived',
    public.create_student_with_enrollment_v3(
      'Archived',
      'Child',
      '',
      '',
      'existing',
      '9b100000-0000-4000-8000-000000000002',
      null,
      null,
      null,
      null,
      '9b000000-0000-4000-8000-000000000001',
      date '2026-09-27',
      '[]'::jsonb
    );
$archived_guardian$, 'Archived Guardian can be explicitly restored and linked');

select results_eq(
  $$select is_active
    from public.guardians
    where id = '9b100000-0000-4000-8000-000000000002'$$,
  array[true],
  'Explicitly linking an archived Guardian restores it'
);

select lives_ok($new_guardian$
  insert into identity_students(key, id)
  select
    'new',
    public.create_student_with_enrollment_v3(
      'New',
      'Child',
      '',
      '',
      'new',
      null,
      'New Parent',
      'new.identity@example.test',
      '+1 780 555 0500',
      'both',
      '9b000000-0000-4000-8000-000000000001',
      date '2026-09-27',
      '[]'::jsonb
    );
$new_guardian$, 'New Guardian mode creates a new Guardian explicitly');

select results_eq(
  $$select count(*)::bigint
    from public.student_guardians sg
    join public.guardians g
      on g.school_id = sg.school_id
     and g.id = sg.guardian_id
    where sg.student_id = (
      select id from identity_students where key = 'new'
    )
      and g.email = 'new.identity@example.test'$$,
  array[1::bigint],
  'New Guardian is linked to the new Student'
);

select throws_ok(
  $$select public.create_student_with_enrollment_v3(
    'Duplicate',
    'Guardian',
    '',
    '',
    'new',
    null,
    'Duplicate Submitted Parent',
    'existing.identity@example.test',
    '+1 780 555 9999',
    'en',
    '9b000000-0000-4000-8000-000000000001',
    date '2026-09-27',
    '[]'::jsonb
  )$$,
  '23505',
  null,
  'New mode rejects an email that already belongs to a Guardian'
);

select results_eq(
  $$select count(*)::bigint
    from public.guardians
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and email = 'existing.identity@example.test'$$,
  array[1::bigint],
  'Duplicate email never creates a second Guardian'
);

select results_eq(
  $$select count(*)::bigint
    from public.students
    where school_id = 'a0000000-0000-0000-0000-000000000001'
      and first_name_en = 'Duplicate'
      and last_name_en = 'Guardian'$$,
  array[0::bigint],
  'Rejected duplicate Guardian creation leaves no partial Student'
);

select * from finish();
rollback;
