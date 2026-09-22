begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select public.update_teacher_administration_confirmed(
    'c0000000-0000-0000-0000-000000000002',
    'English Teacher',
    'en',
    array['d0000000-0000-0000-0000-000000000002']::uuid[],
    false
  )$$,
  '23505',
  'primary teacher conflict',
  'occupied group requires explicit reassignment'
);

select lives_ok(
  $$select public.create_group_with_teacher(
    'Admin-led class', '', null,
    'c0000000-0000-0000-0000-000000000001'
  )$$,
  'active admin can be assigned to a new group'
);

select throws_ok(
  $$insert into public.group_teachers (school_id, group_id, teacher_profile_id, assignment_type)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000001',
      'PRIMARY'
    )$$,
  '23505',
  'duplicate key value violates unique constraint "group_teachers_one_primary_idx"',
  'database enforces one primary teacher per group'
);

select * from finish();
rollback;
