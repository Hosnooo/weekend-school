begin;

select plan(8);

create or replace function pg_temp.function_definition(
  signature text
)
returns text
language sql
as $$
  select coalesce(
    pg_get_functiondef(
      to_regprocedure(signature)
    ),
    ''
  );
$$;

select has_column(
  'public',
  'report_section_sources',
  'included',
  'Report Cycle source links persist Admin include/exclude state'
);

select ok(
  to_regprocedure(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) is not null,
  'Class Report Cycles have an atomic creation function'
);

select ok(
  to_regprocedure(
    'public.set_report_cycle_source_included(uuid,uuid,boolean)'
  ) is not null,
  'Report Cycle source inclusion has a guarded mutation'
);

select ok(
  pg_temp.function_definition(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) ilike '%scope_type%'
  and pg_temp.function_definition(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) ilike '%CLASS%',
  'new Report Cycles are Class scoped'
);

select ok(
  pg_temp.function_definition(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) ilike '%SUBMITTED%'
  and pg_temp.function_definition(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) ilike '%weekly_submission_dates%'
  and pg_temp.function_definition(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) ilike '%coverage_kind%',
  'cycle creation selects only submitted flexible Teaching Updates including exact-date coverage'
);

select ok(
  pg_temp.function_definition(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) ilike '%report_section_approvals%'
  and pg_temp.function_definition(
    'public.create_class_report_cycle(uuid,date,date,uuid)'
  ) ilike '%report_section_sources%',
  'eligible Teaching Updates are linked into the existing report approval/source engine'
);

select ok(
  pg_temp.function_definition(
    'public.set_report_cycle_source_included(uuid,uuid,boolean)'
  ) ilike '%included%'
  and (
    pg_temp.function_definition(
      'public.set_report_cycle_source_included(uuid,uuid,boolean)'
    ) ilike '%FINALIZED%'
    or pg_temp.function_definition(
      'public.set_report_cycle_source_included(uuid,uuid,boolean)'
    ) ilike '%status%'
  ),
  'source include/exclude mutation is blocked once the cycle is finalized'
);

select ok(
  pg_temp.function_definition(
    'public.finalize_report_batch(uuid,jsonb)'
  ) ilike '%included%',
  'finalization uses only included Report Cycle sources'
);

select * from finish();

rollback;
