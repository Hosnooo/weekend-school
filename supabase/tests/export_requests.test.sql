begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_table('public','export_requests','expiring export request table exists');
select has_column('public','export_requests','school_id','export requests are school-owned');
select has_column('public','export_requests','requested_by_profile_id','export requests record the requesting admin');
select has_column('public','export_requests','request','export requests store the validated request');
select has_column('public','export_requests','expires_at','export requests expire');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.export_requests'::regclass),
  'export requests have row level security enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.export_requests'::regclass),
  'export requests force row level security'
);
select has_index('public','export_requests','export_requests_school_expiry_idx','expired export requests can be cleaned up efficiently');

select * from finish();
rollback;
