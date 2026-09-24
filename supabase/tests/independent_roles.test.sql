begin;

select plan(15);

select has_table('public', 'administrators', 'administrators table exists');
select has_table('public', 'teachers', 'teachers table exists');
select has_table('public', 'administrator_accounts', 'administrator account links exist');
select has_table('public', 'teacher_accounts', 'teacher account links exist');

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('administrators', 'teachers', 'administrator_accounts', 'teacher_accounts')
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  4,
  'all independent role tables enable and force RLS'
);

select lives_ok($$
  insert into public.teachers (id, school_id, display_name, email)
  values
    ('2a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Same Teacher', 'same@example.test'),
    ('2a000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Same Teacher', 'same@example.test')
$$, 'teacher names and business emails may repeat');

select lives_ok($$
  insert into public.administrators (id, school_id, display_name, email)
  values ('2b000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Same Teacher', 'same@example.test')
$$, 'the same business email may exist on an administrator and teacher');

select is(
  (select count(*)::integer from public.administrators where id = 'c0000000-0000-0000-0000-000000000001'),
  1,
  'legacy admin seed maps to one administrator record'
);

select is(
  (select count(*)::integer from public.teachers where id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'legacy admin seed is not implicitly a teacher'
);

select is(
  (select count(*)::integer from public.teachers where id = 'c0000000-0000-0000-0000-000000000002'),
  1,
  'legacy teacher seed maps to one teacher record'
);

select is(
  (select count(*)::integer from public.administrators where id = 'c0000000-0000-0000-0000-000000000002'),
  0,
  'legacy teacher seed is not implicitly an administrator'
);

select is(
  (
    select count(*)::integer
    from public.administrator_accounts
    where administrator_id = 'c0000000-0000-0000-0000-000000000001'
      and profile_id = 'c0000000-0000-0000-0000-000000000001'
  ),
  1,
  'legacy admin seed has an explicit administrator account link'
);

select is(
  (
    select count(*)::integer
    from public.teacher_accounts
    where teacher_id = 'c0000000-0000-0000-0000-000000000002'
      and profile_id = 'c0000000-0000-0000-0000-000000000002'
  ),
  1,
  'legacy teacher seed has an explicit teacher account link'
);

select lives_ok($$
  insert into public.teachers (id, school_id, display_name, email)
  values ('2a000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Admin Teacher Record', 'admin@example.test');
  insert into public.teacher_accounts (school_id, teacher_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001')
$$, 'one login profile may explicitly link to both administrator and teacher records');

insert into public.schools (id, name_en, name_ar, timezone, default_language)
values ('a0000000-0000-0000-0000-000000000002', 'Other School', 'مدرسة أخرى', 'America/Edmonton', 'en');

select throws_ok($$
  insert into public.teacher_accounts (school_id, teacher_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002')
$$, '23503', null, 'cross-school teacher account links are rejected');

select * from finish();
rollback;
