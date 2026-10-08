begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

-- Make this reversible test safe even if a local E2E template is active.
-- Rollback restores the original selection and configuration.
update public.report_templates
set is_active = false
where school_id = 'a0000000-0000-0000-0000-000000000001' and is_active;

-- Fixture rows are rolled back after the test; no hosted data is touched.
insert into public.report_templates (school_id, name, is_active, performance_enabled)
values
  ('a0000000-0000-0000-0000-000000000001', 'RLS Teacher Active Template', true, true),
  ('a0000000-0000-0000-0000-000000000001', 'RLS Teacher Inactive Template', false, false);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select count(*)::bigint from public.report_templates
      where name = 'RLS Teacher Active Template' and performance_enabled$$,
  array[1::bigint],
  'active Teacher reads the current school active report template'
);

select results_eq(
  $$select count(*)::bigint from public.report_templates
      where name = 'RLS Teacher Inactive Template'$$,
  array[0::bigint],
  'Teacher cannot read archived report template configurations'
);

select results_eq(
  $with changed as (
      update public.report_templates
      set performance_enabled = false
      where name = 'RLS Teacher Active Template'
      returning id
    )
    select count(*)::bigint from changed$,
  array[0::bigint],
  'Teachers cannot edit the active report template'
);

select set_config('request.jwt.claim.sub', 'b9999999-9999-4999-8999-999999999999', true);
select results_eq(
  $$select count(*)::bigint from public.report_templates
      where name = 'RLS Teacher Active Template'$$,
  array[0::bigint],
  'a user without a linked Teacher identity cannot read school templates'
);

reset role;
select * from finish();
rollback;
