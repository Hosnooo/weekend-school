begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

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

select lives_ok($teachers$
  insert into public.teachers (id, school_id, display_name, email)
  values
    ('2a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Same Teacher', 'same@example.test'),
    ('2a000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Same Teacher', 'same@example.test')
$teachers$, 'teacher names and business emails may repeat');

select lives_ok($admins$
  insert into public.administrators (id, school_id, display_name, email)
  values
    ('2b000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Same Admin', 'same-admin@example.test'),
    ('2b000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Same Admin', 'same-admin@example.test')
$admins$, 'administrator names and business emails may repeat');

select lives_ok($cross_role$
  insert into public.administrators (id, school_id, display_name, email)
  values ('2b000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Cross Role Person', 'same@example.test')
$cross_role$, 'the same business email may exist on administrator and teacher records');

select lives_ok($admin_link$
  insert into public.administrator_accounts (school_id, administrator_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001')
$admin_link$, 'a login profile may link explicitly to an administrator record');

select lives_ok($teacher_link$
  insert into public.teacher_accounts (school_id, teacher_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')
$teacher_link$, 'the same login profile may also link explicitly to a teacher record');

insert into public.schools (id, name_en, name_ar, timezone, default_language)
values ('a0000000-0000-0000-0000-000000000002', 'Other School', 'مدرسة أخرى', 'America/Edmonton', 'en');

select throws_ok($cross_school_teacher$
  insert into public.teacher_accounts (school_id, teacher_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')
$cross_school_teacher$, '23503', null, 'cross-school teacher account links are rejected');

select throws_ok($cross_school_admin$
  insert into public.administrator_accounts (school_id, administrator_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000002', '2b000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001')
$cross_school_admin$, '23503', null, 'cross-school administrator account links are rejected');

select * from finish();
rollback;
