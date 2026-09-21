begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

-- A second tenant proves that knowing a valid identifier never bypasses school isolation.
insert into public.schools (id, name_en, name_ar, timezone, default_language)
values (
  'a0000000-0000-0000-0000-000000000002',
  'Other School',
  'مدرسة أخرى',
  'America/Edmonton',
  'en'
);

insert into public.groups (id, school_id, name_en, name_ar)
values (
  'd0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000002',
  'Other Group',
  'مجموعة أخرى'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- admin own school
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);
select results_eq(
  $$select count(*)::bigint from public.groups$$,
  array[3::bigint],
  'admin own school sees every own-school group and no other tenant'
);
select results_eq(
  $$select count(*)::bigint from public.students$$,
  array[12::bigint],
  'admin own school sees every own-school student'
);

-- assigned teacher
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);
select results_eq(
  $$select count(*)::bigint from public.groups$$,
  array[2::bigint],
  'assigned teacher sees only directly assigned groups'
);
select results_eq(
  $$select count(*)::bigint from public.students$$,
  array[8::bigint],
  'assigned teacher sees only students in directly assigned groups'
);

-- unrelated teacher
select results_eq(
  $$select count(*)::bigint from public.groups where id = 'd0000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'unrelated teacher cannot read another teacher group by identifier'
);
select results_eq(
  $$select count(*)::bigint from public.students where id = 'e0000000-0000-0000-0000-000000000005'$$,
  array[0::bigint],
  'unrelated teacher cannot read another teacher student by identifier'
);

-- inactive profile
reset role;
update public.profiles
set is_active = false
where id = 'c0000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000003',
  true
);
select results_eq(
  $$select count(*)::bigint from public.groups$$,
  array[0::bigint],
  'inactive profile receives no school data'
);

-- cross-school identifier and teacher cannot send reports
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);
select results_eq(
  $$select count(*)::bigint from public.groups where id = 'd0000000-0000-0000-0000-000000000004'$$,
  array[0::bigint],
  'cross-school identifier remains invisible'
);
select throws_ok(
  $$select public.reserve_report_delivery(
    '70000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    'test'
  )$$,
  '42501',
  'administrator access required',
  'teacher cannot send reports'
);

select * from finish();
rollback;
