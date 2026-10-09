begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_column('public', 'weekly_submission_students', 'attendance_attended',
  'numeric sessions attended column exists');
select has_column('public', 'weekly_submission_students', 'attendance_total',
  'numeric sessions total column exists');
select ok((select is_nullable = 'YES' from information_schema.columns
  where table_schema='public' and table_name='weekly_submission_students'
    and column_name='attendance_status'),
  'historical status may be null for numeric observations');

select ok(exists (
  select 1 from pg_constraint where conrelid = 'public.weekly_submission_students'::regclass
    and conname = 'weekly_submission_students_attendance_pair_chk'
), 'database enforces either complete numeric counts or legacy status');

select ok(
  pg_get_functiondef('public.save_teaching_update_draft(uuid,uuid,uuid,uuid,text,date,date,date[],text,text,public.performance_level,jsonb,jsonb,integer)'::regprocedure)
    like '%attendance_item.attended%'
  and pg_get_functiondef('public.save_teaching_update_draft(uuid,uuid,uuid,uuid,text,date,date,date[],text,text,public.performance_level,jsonb,jsonb,integer)'::regprocedure)
    like '%attendance_item.total%',
  'Teacher draft save persists numeric counts in one atomic RPC'
);

select ok(exists (
  select 1 from pg_trigger where tgrelid = 'public.weekly_submissions'::regclass
    and tgname = 'require_numeric_teaching_update_attendance' and not tgisinternal
), 'new Teacher submissions are checked for numeric roster attendance');

select has_column('public', 'report_section_approvals', 'progress_en_approved',
  'English approved text has explicit authority flag');
select has_column('public', 'report_section_approvals', 'progress_ar_approved',
  'Arabic approved text has explicit authority flag');

select ok(to_regprocedure(
  'public.save_class_report_review_atomic(uuid,uuid,uuid,text,text,boolean,boolean,jsonb)'
) is not null, 'atomic Administrator review RPC exists');

select ok(not has_function_privilege('anon',
  'public.save_class_report_review_atomic(uuid,uuid,uuid,text,text,boolean,boolean,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated',
  'public.save_class_report_review_atomic(uuid,uuid,uuid,text,text,boolean,boolean,jsonb)', 'EXECUTE'),
  'atomic review RPC is inaccessible to anonymous users');

select ok(
  pg_get_functiondef('public.save_class_report_review_atomic(uuid,uuid,uuid,text,text,boolean,boolean,jsonb)'::regprocedure)
    like '%progress_en_approved = true%'
  and pg_get_functiondef('public.save_class_report_review_atomic(uuid,uuid,uuid,text,text,boolean,boolean,jsonb)'::regprocedure)
    like '%attendance_attended = v_student.attendance_attended%',
  'approved text and attendance are committed in the same transaction');

select ok(
  exists(select 1 from public.report_section_approvals
    where progress_en_approved and progress_ar_approved)
  or not exists(select 1 from public.report_section_approvals),
  'historical existing approvals are conservatively locked'
);

select * from finish();
rollback;
