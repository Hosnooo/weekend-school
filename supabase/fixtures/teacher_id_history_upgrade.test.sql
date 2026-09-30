begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select has_column(
  'public', 'teaching_assignments', 'teacher_id',
  'teaching assignments are keyed to Teacher records'
);
select hasnt_column(
  'public', 'teaching_assignments', 'teacher_profile_id',
  'teaching assignments no longer store Profile ownership'
);
select has_column(
  'public', 'weekly_submissions', 'teacher_id',
  'weekly submission authorship is keyed to Teacher records'
);
select hasnt_column(
  'public', 'weekly_submissions', 'teacher_profile_id',
  'weekly submissions no longer store Profile authorship'
);
select hasnt_column(
  'public', 'profiles', 'role',
  'profiles no longer carry a single business role'
);
select hasnt_function(
  'public', 'current_app_role', array[]::text[],
  'legacy current_app_role helper is removed after role cutover'
);

select results_eq(
  $$select (to_jsonb(ta)->>'teacher_id')::uuid
    from public.teaching_assignments ta
    where ta.id = '3e000000-0000-0000-0000-000000000001'$$,
  array['c0000000-0000-0000-0000-000000000002'::uuid],
  'legacy teaching assignment maps to its explicit Teacher record'
);

select results_eq(
  $$select (to_jsonb(ws)->>'teacher_id')::uuid
    from public.weekly_submissions ws
    where ws.id = '3f000000-0000-0000-0000-000000000001'$$,
  array['c0000000-0000-0000-0000-000000000002'::uuid],
  'legacy weekly submission preserves Teacher attribution'
);

update public.teachers
set is_active = false
where id = 'c0000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select count(*)::bigint
    from public.teaching_assignments
    where id = '3e000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'Administrator retains access to historical assignment after Teacher deactivation'
);

select results_eq(
  $$select count(*)::bigint
    from public.weekly_submissions
    where id = '3f000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'Administrator retains access to historical Teacher submission after deactivation'
);

reset role;
select * from finish();
rollback;
