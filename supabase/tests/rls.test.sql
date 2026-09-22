begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

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
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);
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

select is_empty(
  $$update public.sessions
    set session_date = session_date
    where id = '10000000-0000-0000-0000-000000000001'
    returning id$$,
  'teacher cannot mutate an already submitted session'
);

-- Administrator mutations remain tenant-scoped, and report snapshots remain immutable.
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);
select is_empty(
  $$update public.groups
    set name_en = 'Cross-school write'
    where id = 'd0000000-0000-0000-0000-000000000004'
    returning id$$,
  'admin cannot mutate a cross-school row even with its identifier'
);

reset role;
insert into public.reports (
  id, school_id, student_id, period_start, period_end, language, status, snapshot_json
) values
  ('70000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31','en','READY','{}'),
  ('70000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31','ar','READY','{}');
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$update public.reports
    set snapshot_json = '{"changed":true}'
    where id = '70000000-0000-0000-0000-000000000011'$$,
  '55000',
  'report snapshots are immutable',
  'generated report snapshots cannot be changed'
);

select lives_ok(
  $$select public.complete_report_delivery(
      (public.reserve_report_delivery(
        '70000000-0000-0000-0000-000000000011',
        'f0000000-0000-0000-0000-000000000001',
        'test'
      )->>'delivery_id')::uuid,
      true,
      'provider-message-1',
      null
    )$$,
  'admin can complete the first logical delivery'
);

update public.guardians
set report_language = 'ar'
where id = 'f0000000-0000-0000-0000-000000000001';

select results_eq(
  $$select (public.reserve_report_delivery(
      '70000000-0000-0000-0000-000000000012',
      'f0000000-0000-0000-0000-000000000001',
      'test'
    )->>'should_send')::boolean$$,
  array[false],
  'changing report language cannot create a duplicate logical delivery'
);

select * from finish();
rollback;
