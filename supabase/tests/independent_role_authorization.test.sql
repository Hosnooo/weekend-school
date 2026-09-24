begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

-- Matching business/login email never creates an Administrator capability.
insert into public.administrators (id, school_id, display_name, email)
values (
  'f2000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Email Match Only',
  'teacher.en@example.test'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select public.is_admin()$$,
  array[false],
  'matching email without an Administrator account link grants no admin capability'
);

reset role;
select has_function(
  'public',
  'current_teacher_ids',
  array[]::text[],
  'explicit Teacher capabilities are exposed by current_teacher_ids()'
);

-- A legacy role label must no longer authorize once its explicit account link is removed.
delete from public.administrator_accounts
where school_id = 'a0000000-0000-0000-0000-000000000001'
  and profile_id = 'c0000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select public.is_admin()$$,
  array[false],
  'ADMIN profile role alone grants no admin capability without an explicit link'
);

-- The same authenticated Profile may explicitly hold both independent capabilities.
reset role;
insert into public.administrator_accounts (school_id, administrator_id, profile_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001'
);
insert into public.teachers (id, school_id, display_name, email)
values (
  'f2000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Admin Teaching Record',
  'admin.teacher@example.test'
);
insert into public.teacher_accounts (school_id, teacher_id, profile_id)
values (
  'a0000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select public.is_admin()$$,
  array[true],
  'explicit Administrator link grants admin capability even when a Teacher link also exists'
);

-- Removing one capability must leave the other relationship untouched.
reset role;
delete from public.administrator_accounts
where school_id = 'a0000000-0000-0000-0000-000000000001'
  and profile_id = 'c0000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select public.is_admin()$$,
  array[false],
  'removing the Administrator link removes only admin capability'
);

reset role;
select results_eq(
  $$select count(*)::bigint from public.teacher_accounts
    where profile_id = 'c0000000-0000-0000-0000-000000000001'
      and teacher_id = 'f2000000-0000-0000-0000-000000000002'$$,
  array[1::bigint],
  'removing Administrator access preserves the explicit Teacher link'
);

-- Teaching visibility also requires the explicit Teacher account link.
delete from public.teacher_accounts
where school_id = 'a0000000-0000-0000-0000-000000000001'
  and profile_id = 'c0000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select count(*)::bigint from public.groups$$,
  array[0::bigint],
  'teacher profile loses teaching visibility when its explicit Teacher link is removed'
);

select * from finish();
rollback;
