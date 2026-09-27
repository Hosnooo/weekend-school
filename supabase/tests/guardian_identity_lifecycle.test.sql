begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into public.students (
  id, school_id, first_name_en, last_name_en, is_active
) values
  (
    '96000000-0000-4000-8000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Guardian', 'Student One', true
  ),
  (
    '96000000-0000-4000-8000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Guardian', 'Student Two', true
  ),
  (
    '96000000-0000-4000-8000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Guardian', 'Student Three', true
  );

insert into public.guardians (
  id, school_id, name, email, phone, report_language, is_active
) values
  (
    '97000000-0000-4000-8000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Shared Guardian',
    'guardian.identity.test@example.test',
    '+1 780 555 1001',
    'en',
    true
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Orphan Guardian',
    'guardian.orphan.test@example.test',
    '+1 780 555 1002',
    'en',
    true
  ),
  (
    '97000000-0000-4000-8000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Archived Guardian',
    'guardian.archived.test@example.test',
    '+1 780 555 1003',
    'en',
    false
  );

insert into public.student_guardians (
  school_id, student_id, guardian_id, receives_reports, is_primary
) values
  (
    'a0000000-0000-0000-0000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    '97000000-0000-4000-8000-000000000001',
    true,
    true
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    '96000000-0000-4000-8000-000000000002',
    '97000000-0000-4000-8000-000000000001',
    true,
    true
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    '97000000-0000-4000-8000-000000000002',
    true,
    false
  );

select throws_ok(
  $duplicate$
    insert into public.guardians (
      school_id, name, email, phone, report_language
    ) values (
      'a0000000-0000-0000-0000-000000000001',
      'Duplicate Guardian',
      'guardian.identity.test@example.test',
      '+1 780 555 9999',
      'en'
    )
  $duplicate$,
  '23505',
  null,
  'A school cannot contain two Guardians with the same normalized email'
);

select throws_ok(
  $duplicate_update$
    update public.guardians
    set email = 'guardian.identity.test@example.test'
    where id = '97000000-0000-4000-8000-000000000002'
  $duplicate_update$,
  '23505',
  null,
  'Editing a Guardian cannot take another Guardian email'
);

select has_function(
  'public',
  'link_existing_student_guardian',
  array['uuid','uuid','boolean','boolean'],
  'Existing Guardians are linked explicitly by Guardian ID'
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

select lives_ok(
  $restore_link$
    select public.link_existing_student_guardian(
      '96000000-0000-4000-8000-000000000003',
      '97000000-0000-4000-8000-000000000003',
      false,
      true
    )
  $restore_link$,
  'An archived existing Guardian can be restored and linked'
);

select results_eq(
  $$
    select is_active
    from public.guardians
    where id = '97000000-0000-4000-8000-000000000003'
  $$,
  $$ values (true) $$,
  'Linking an archived Guardian restores the Guardian'
);

select lives_ok(
  $shared_unlink$
    select public.unlink_student_guardian(
      '96000000-0000-4000-8000-000000000001',
      '97000000-0000-4000-8000-000000000001'
    )
  $shared_unlink$,
  'A shared Guardian can be removed from one Student'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.student_guardians
    where guardian_id = '97000000-0000-4000-8000-000000000001'
  $$,
  array[1::bigint],
  'Removing a shared Guardian preserves the other Student relationship'
);

select results_eq(
  $$
    select is_active
    from public.guardians
    where id = '97000000-0000-4000-8000-000000000001'
  $$,
  $$ values (true) $$,
  'A Guardian linked to another Student stays active'
);

select lives_ok(
  $orphan_unlink$
    select public.unlink_student_guardian(
      '96000000-0000-4000-8000-000000000001',
      '97000000-0000-4000-8000-000000000002'
    )
  $orphan_unlink$,
  'A last Student relationship can be removed'
);

select results_eq(
  $$
    select is_active
    from public.guardians
    where id = '97000000-0000-4000-8000-000000000002'
  $$,
  $$ values (false) $$,
  'A Guardian with no remaining Students is automatically archived'
);

select ok(
  (
    public.get_delete_impact(
      'GUARDIAN',
      '97000000-0000-4000-8000-000000000001'
    )->'dependencies'
  ) ? 'emailDeliveries',
  'Guardian permanent-delete impact includes historical email deliveries'
);

select * from finish();

rollback;
