begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

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

select ok(
  has_function_privilege(
    'authenticated',
    'public.import_student_roster_with_classes(text,jsonb)',
    'EXECUTE'
  ),
  'the authenticated roster import RPC remains callable'
);

select * from finish();
rollback;
