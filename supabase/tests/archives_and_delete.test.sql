begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

select has_function('public','archive_entity',array['text','uuid'],'archive operation exists');
select has_function('public','restore_entity',array['text','uuid'],'restore operation exists');
select has_function('public','get_delete_impact',array['text','uuid'],'delete-impact operation exists');
select has_function('public','permanently_delete_archived_entity',array['text','uuid','text'],'permanent delete operation exists');

insert into public.schools (id,name_en,name_ar,timezone,default_language)
values ('a0000000-0000-0000-0000-000000000099','Other School','مدرسة أخرى','America/Edmonton','en');
insert into public.students (id,school_id,first_name_en,last_name_en,is_active)
values ('e0000000-0000-0000-0000-000000000099','a0000000-0000-0000-0000-000000000099','Other','Student',false);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.archive_entity('STUDENT','e0000000-0000-0000-0000-000000000001')$$,
  'admin can archive a student'
);
select results_eq(
  $$select is_active from public.students where id='e0000000-0000-0000-0000-000000000001'$$,
  array[false],
  'archived student leaves active state'
);

select lives_ok(
  $$select public.restore_entity('STUDENT','e0000000-0000-0000-0000-000000000001')$$,
  'admin can restore a student'
);
select results_eq(
  $$select is_active from public.students where id='e0000000-0000-0000-0000-000000000001'$$,
  array[true],
  'restored student returns to active state'
);

select throws_ok(
  $$select public.permanently_delete_archived_entity('STUDENT','e0000000-0000-0000-0000-000000000001','DELETE e0000000-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'active student cannot be permanently deleted'
);

select lives_ok(
  $$select public.archive_entity('STUDENT','e0000000-0000-0000-0000-000000000001')$$,
  'student can be archived before deletion impact review'
);

select ok(
  (select impact ? 'counts'
      and impact->'counts' ? 'memberships'
      and impact->'counts' ? 'attendanceObservations'
      and impact->'counts' ? 'attendanceResolutions'
      and impact->'counts' ? 'comments'
      and impact->'counts' ? 'reports'
      and impact->'counts' ? 'emailDeliveries'
   from (select public.get_delete_impact('STUDENT','e0000000-0000-0000-0000-000000000001') as impact) x),
  'delete impact exposes all student history categories before mutation'
);

select throws_ok(
  $$select public.permanently_delete_archived_entity('STUDENT','e0000000-0000-0000-0000-000000000001','DELETE wrong-id')$$,
  '22023',
  null,
  'permanent deletion requires exact explicit confirmation'
);

select lives_ok(
  $$select public.permanently_delete_archived_entity('STUDENT','e0000000-0000-0000-0000-000000000001','DELETE e0000000-0000-0000-0000-000000000001')$$,
  'confirmed archived student deletion succeeds transactionally'
);
select results_eq(
  $$select count(*)::bigint from public.students where id='e0000000-0000-0000-0000-000000000001'$$,
  array[0::bigint],
  'deleted student row is removed'
);
select results_eq(
  $$select count(*)::bigint from public.students where id='e0000000-0000-0000-0000-000000000002'$$,
  array[1::bigint],
  'unrelated same-school student remains'
);
select results_eq(
  $$select count(*)::bigint from public.students where id='e0000000-0000-0000-0000-000000000099'$$,
  array[1::bigint],
  'other-school student remains untouched'
);

select * from finish();
rollback;
