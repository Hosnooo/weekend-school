-- CANDIDATE pgTAP TEST. Copy into supabase/tests/ after the migration
-- is created locally with the Supabase CLI. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

insert into public.schools (id, name_en, name_ar)
values ('6a000000-0000-4000-8000-000000000001','Race Guard Fixture','مدرسة اختبار');

insert into public.administrators (id, school_id, display_name, email, is_active)
values
('6b000000-0000-4000-8000-000000000001',
 '6a000000-0000-4000-8000-000000000001','Admin One','admin-one-race@example.test',true),
('6b000000-0000-4000-8000-000000000002',
 '6a000000-0000-4000-8000-000000000001','Admin Two','admin-two-race@example.test',true);

select has_trigger(
  'public','administrators','administrators_preserve_last_active',
  'Administrator last-active guard is installed'
);

select has_function(
  'public','delete_administrator_with_accounts',array['uuid','uuid'],
  'Atomic account-unlink + Administrator deletion RPC exists'
);

select lives_ok(
  $$update public.administrators set is_active=false where id='6b000000-0000-4000-8000-000000000001'$$,
  'Deactivating one of two active Administrators is allowed'
);

select throws_ok(
  $$update public.administrators set is_active=false where id='6b000000-0000-4000-8000-000000000002'$$,
  'P0001',null,
  'The sole remaining active Administrator cannot be deactivated'
);

select results_eq(
  $$select count(*)::bigint from public.administrators
    where school_id='6a000000-0000-4000-8000-000000000001' and is_active$$,
  $$values (1::bigint)$$,
  'Failed second deactivation does not change the active count'
);

select lives_ok(
  $$update public.administrators set is_active=true where id='6b000000-0000-4000-8000-000000000001'$$,
  'Reactivating an inactive Administrator is allowed'
);

select lives_ok(
  $select public.delete_administrator_with_accounts(
     '6a000000-0000-4000-8000-000000000001',
     '6b000000-0000-4000-8000-000000000002')$,
  'Atomic removal of an active Administrator succeeds when another remains'
);

select throws_ok(
  $$delete from public.administrators where id='6b000000-0000-4000-8000-000000000001'$$,
  'P0001',null,
  'Deleting the final active Administrator is blocked'
);

select results_eq(
  $select count(*)::bigint from public.administrators
    where school_id='6a000000-0000-4000-8000-000000000001' and is_active$,
  $values (1::bigint)$,
  'Failed deletion preserves the sole active Administrator'
);

select throws_ok(
  $select public.delete_administrator_with_accounts(
    '6a000000-0000-4000-8000-000000000001',
    '6b000000-0000-4000-8000-000000000001')$,
  'P0001',null,
  'Atomic RPC refuses to remove the last Administrator'
);

insert into public.administrators (id, school_id, display_name, is_active)
values ('6b000000-0000-4000-8000-000000000003',
        '6a000000-0000-4000-8000-000000000001',
        'Inactive Admin', false);

select lives_ok(
  $$delete from public.administrators where id='6b000000-0000-4000-8000-000000000003'$$,
  'Deleting an inactive Administrator is allowed'
);

select results_eq(
  $$select count(*)::bigint from public.administrators
    where school_id='6a000000-0000-4000-8000-000000000001' and is_active$$,
  $$values (1::bigint)$$,
  'Inactive-record cleanup cannot reduce active Administrator coverage'
);

select ok(
  exists (select 1 from public.administrators where
    id='6b000000-0000-4000-8000-000000000001' and is_active),
  'The last active Administrator stays present and active'
);

select * from finish();
rollback;
