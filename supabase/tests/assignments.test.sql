begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

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

select throws_ok(
  $$select public.update_group_with_teacher(
    'd0000000-0000-0000-0000-000000000002',
    'Intermediate', '', null,
    'c0000000-0000-0000-0000-000000000002'
  )$$,
  '23505',
  'primary teacher conflict',
  'group form cannot silently replace an occupied primary teacher'
);

reset role;
insert into public.teachers (id, school_id, display_name, email, preferred_language)
values (
  '2c000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Admin Teacher Record',
  'admin.teacher@example.test',
  'en'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select public.create_group_with_teacher(
    'Profile-only class', '', null,
    'c0000000-0000-0000-0000-000000000001'
  )$$,
  '23503',
  'active teacher not found',
  'admin Profile cannot be assigned as a Teacher without an independent Teacher record'
);

select lives_ok(
  $$select public.create_group_with_teacher(
    'Admin-led class', '', null,
    '2c000000-0000-0000-0000-000000000001'
  )$$,
  'group assignment accepts an independent Teacher record'
);

select throws_ok(
  $$insert into public.group_teachers (school_id, group_id, teacher_id, assignment_type)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000003',
      'PRIMARY'
    )$$,
  '23505',
  'duplicate key value violates unique constraint "group_teachers_one_primary_idx"',
  'database enforces one primary teacher per group'
);

select throws_ok(
  $$select public.save_weekly_update(
    null, (select id from public.groups where name_en = 'Admin-led class'),
    '2026-10-01', '', '', null, '[]'::jsonb, '[]'::jsonb, false
  )$$,
  '42501',
  'assigned teacher access required',
  'admin-only account cannot teach merely because a Teacher record is assigned'
);

reset role;
insert into public.teacher_accounts (school_id, teacher_id, profile_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  '2c000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.save_weekly_update(
    null, (select id from public.groups where name_en = 'Admin-led class'),
    '2026-10-01', '', '', null, '[]'::jsonb, '[]'::jsonb, false
  )$$,
  'explicit Teacher link independently grants teaching capability to the same login'
);

select throws_ok(
  $$select public.save_weekly_update(
    null, 'd0000000-0000-0000-0000-000000000003',
    '2026-10-01', '', '', null, '[]'::jsonb, '[]'::jsonb, false
  )$$,
  '42501',
  'assigned teacher access required',
  'Teacher capability still requires assignment to the requested group'
);

select * from finish();
rollback;
