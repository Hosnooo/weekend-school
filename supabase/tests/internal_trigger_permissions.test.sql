begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select ok(
  not has_function_privilege(
    'anon',
    'public.protect_weekly_submission_date_change()',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the weekly submission date trigger helper'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  0::bigint,
  'trigger-only helpers are not directly executable by application roles'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
      and not exists (
        select 1
        from pg_trigger t
        where t.tgfoid = p.oid
          and not t.tgisinternal
      )
  ),
  0::bigint,
  'every affected public trigger function belongs to a table trigger'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.import_student_roster_with_classes(text,jsonb)',
    'EXECUTE'
  ),
  'the authenticated roster import RPC remains callable'
);

insert into public.classes (id, school_id, name_en, name_ar)
values (
  'd1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Trigger Permission Class',
  'فصل اختبار الصلاحيات'
);

insert into public.subjects (id, school_id, name_en, name_ar)
values (
  'd2000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Trigger Permission Subject',
  'مادة اختبار الصلاحيات'
);

insert into public.class_subjects (id, school_id, class_id, subject_id)
values (
  'd3000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd2000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $request$
    select public.request_teaching_update(
      'd3000000-0000-0000-0000-000000000001',
      'DATES',
      null::date,
      null::date,
      array[date '2026-09-13'],
      'Trigger permission regression'
    )
  $request$,
  'authenticated Admin request can fire Teaching Update and date triggers'
);

select lives_ok(
  $update$
    update public.classes
    set name_en = 'Trigger Permission Class Updated'
    where id = 'd1000000-0000-0000-0000-000000000001'
  $update$,
  'authenticated Admin Class update can fire updated_at trigger'
);

reset role;

select is(
  (
    select count(*)
    from public.weekly_submission_dates covered_date
    join public.weekly_submissions submission
      on submission.school_id = covered_date.school_id
     and submission.id = covered_date.submission_id
    where submission.class_subject_id =
      'd3000000-0000-0000-0000-000000000001'
      and covered_date.covered_on = date '2026-09-13'
  ),
  1::bigint,
  'the authorized request persists its exact covered date'
);

select is(
  (
    select name_en
    from public.classes
    where id = 'd1000000-0000-0000-0000-000000000001'
  ),
  'Trigger Permission Class Updated',
  'the authorized Class update persists after its trigger runs'
);

select * from finish();
rollback;
