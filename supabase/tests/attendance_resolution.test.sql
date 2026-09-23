begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

select has_table('public', 'attendance_resolutions', 'manual attendance resolution table exists');
select has_function(
  'public',
  'get_effective_attendance',
  array['uuid','uuid','date','uuid'],
  'official attendance resolver exists'
);
select has_function(
  'public',
  'resolve_attendance_conflict',
  array['uuid','uuid','date','uuid','public.attendance_status'],
  'admin conflict resolution function exists'
);

select * from finish();
rollback;
