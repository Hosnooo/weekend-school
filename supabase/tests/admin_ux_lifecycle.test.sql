begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(30);

-- Isolated records exercise lifecycle support without destroying seeded history.
insert into public.teachers (id, school_id, display_name, email, preferred_language, is_active)
values ('f1000000-0000-4000-8000-000000000001','a0000000-0000-0000-0000-000000000001','Lifecycle Teacher','lifecycle.teacher@example.test','en',true);

insert into public.guardians (id, school_id, name, email, report_language, is_active)
values ('f2000000-0000-4000-8000-000000000001','a0000000-0000-0000-0000-000000000001','Lifecycle Guardian','lifecycle.guardian@example.test','en',true);

insert into public.classes (id, school_id, name_en, is_active)
values
  ('f3000000-0000-4000-8000-000000000001','a0000000-0000-0000-0000-000000000001','Lifecycle Class',true),
  ('f3000000-0000-4000-8000-000000000002','a0000000-0000-0000-0000-000000000001','Group Parent Class',true);

insert into public.subjects (id, school_id, name_en, is_active)
values
  ('f4000000-0000-4000-8000-000000000001','a0000000-0000-0000-0000-000000000001','Lifecycle Subject',true),
  ('f4000000-0000-4000-8000-000000000002','a0000000-0000-0000-0000-000000000001','Group Parent Subject',true);

insert into public.class_subjects (id, school_id, class_id, subject_id, is_active)
values ('f5000000-0000-4000-8000-000000000001','a0000000-0000-0000-0000-000000000001','f3000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000002',true);

insert into public.subject_groups (id, school_id, class_subject_id, name_en, is_active)
values ('f6000000-0000-4000-8000-000000000001','a0000000-0000-0000-0000-000000000001','f5000000-0000-4000-8000-000000000001','Lifecycle Group',true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select lives_ok($$select public.archive_entity('TEACHER','f1000000-0000-4000-8000-000000000001')$$,'admin can archive Teacher');
select lives_ok($$select public.restore_entity('TEACHER','f1000000-0000-4000-8000-000000000001')$$,'admin can restore Teacher');
select lives_ok($$select public.archive_entity('GUARDIAN','f2000000-0000-4000-8000-000000000001')$$,'admin can archive Guardian');
select lives_ok($$select public.restore_entity('GUARDIAN','f2000000-0000-4000-8000-000000000001')$$,'admin can restore Guardian');
select lives_ok($$select public.archive_entity('CLASS','f3000000-0000-4000-8000-000000000001')$$,'admin can archive Class');
select lives_ok($$select public.restore_entity('CLASS','f3000000-0000-4000-8000-000000000001')$$,'admin can restore Class');
select lives_ok($$select public.archive_entity('SUBJECT','f4000000-0000-4000-8000-000000000001')$$,'admin can archive Subject');
select lives_ok($$select public.restore_entity('SUBJECT','f4000000-0000-4000-8000-000000000001')$$,'admin can restore Subject');
select lives_ok($$select public.archive_entity('GROUP','f6000000-0000-4000-8000-000000000001')$$,'admin can archive Group');
select lives_ok($$select public.restore_entity('GROUP','f6000000-0000-4000-8000-000000000001')$$,'admin can restore Group');

select lives_ok($$select public.archive_entity('TEACHER','f1000000-0000-4000-8000-000000000001')$$,'Teacher can be re-archived before deletion');
select lives_ok($$select public.archive_entity('GUARDIAN','f2000000-0000-4000-8000-000000000001')$$,'Guardian can be re-archived before deletion');
select lives_ok($$select public.archive_entity('CLASS','f3000000-0000-4000-8000-000000000001')$$,'Class can be re-archived before deletion');
select lives_ok($$select public.archive_entity('SUBJECT','f4000000-0000-4000-8000-000000000001')$$,'Subject can be re-archived before deletion');
select lives_ok($$select public.archive_entity('GROUP','f6000000-0000-4000-8000-000000000001')$$,'Group can be re-archived before deletion');

select ok((public.get_delete_impact('TEACHER','f1000000-0000-4000-8000-000000000001')->>'canPermanentlyDelete')::boolean,'isolated archived Teacher is safe to delete');
select ok((public.get_delete_impact('GUARDIAN','f2000000-0000-4000-8000-000000000001')->>'canPermanentlyDelete')::boolean,'isolated archived Guardian is safe to delete');
select ok((public.get_delete_impact('CLASS','f3000000-0000-4000-8000-000000000001')->>'canPermanentlyDelete')::boolean,'isolated archived Class is safe to delete');
select ok((public.get_delete_impact('SUBJECT','f4000000-0000-4000-8000-000000000001')->>'canPermanentlyDelete')::boolean,'isolated archived Subject is safe to delete');
select ok((public.get_delete_impact('GROUP','f6000000-0000-4000-8000-000000000001')->>'canPermanentlyDelete')::boolean,'isolated archived Group is safe to delete');

select lives_ok($$select public.permanently_delete_archived_entity('TEACHER','f1000000-0000-4000-8000-000000000001','Lifecycle Teacher')$$,'safe archived Teacher can be permanently deleted');
select lives_ok($$select public.permanently_delete_archived_entity('GUARDIAN','f2000000-0000-4000-8000-000000000001','Lifecycle Guardian')$$,'safe archived Guardian can be permanently deleted');
select lives_ok($$select public.permanently_delete_archived_entity('CLASS','f3000000-0000-4000-8000-000000000001','Lifecycle Class')$$,'safe archived Class can be permanently deleted');
select lives_ok($$select public.permanently_delete_archived_entity('SUBJECT','f4000000-0000-4000-8000-000000000001','Lifecycle Subject')$$,'safe archived Subject can be permanently deleted');
select lives_ok($$select public.permanently_delete_archived_entity('GROUP','f6000000-0000-4000-8000-000000000001','Lifecycle Group')$$,'safe archived Group can be permanently deleted');

reset role;
select results_eq($$select count(*)::bigint from public.teachers where id='f1000000-0000-4000-8000-000000000001'$$,array[0::bigint],'Teacher row removed');
select results_eq($$select count(*)::bigint from public.guardians where id='f2000000-0000-4000-8000-000000000001'$$,array[0::bigint],'Guardian row removed');
select results_eq($$select count(*)::bigint from public.classes where id='f3000000-0000-4000-8000-000000000001'$$,array[0::bigint],'Class row removed');
select results_eq($$select count(*)::bigint from public.subjects where id='f4000000-0000-4000-8000-000000000001'$$,array[0::bigint],'Subject row removed');
select results_eq($$select count(*)::bigint from public.subject_groups where id='f6000000-0000-4000-8000-000000000001'$$,array[0::bigint],'Group row removed');

select * from finish();
rollback;
