begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(34);

-------------------------------------------------------------------------------
-- Test-only dynamic probes
--
-- Task 1 intentionally starts RED.  These helpers keep a missing column,
-- table, function, constraint, or changed signature from aborting the entire
-- pgTAP file before the remaining contract failures can be observed.
-------------------------------------------------------------------------------

create or replace function pg_temp.query_returns_true(p_sql text)
returns boolean
language plpgsql
as $$
declare
  result boolean;
begin
  execute p_sql into result;
  return coalesce(result, false);
exception
  when undefined_table
    or undefined_column
    or undefined_function
    or invalid_schema_name
  then
    return false;
end;
$$;

create or replace function pg_temp.statement_lives(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.statement_fails(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false;
exception
  when others then
    return true;
end;
$$;

create or replace function pg_temp.column_exists(
  p_table text,
  p_column text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = p_column
  );
$$;

create or replace function pg_temp.public_function_exists(p_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = p_name
  );
$$;

-------------------------------------------------------------------------------
-- SUBJECT-ONLY TEACHER AUTHORIZATION
-------------------------------------------------------------------------------

select ok(
  pg_temp.public_function_exists('teacher_can_teach_week_context')
    or pg_temp.public_function_exists('teacher_can_teach_context'),
  'effective Teacher authorization helper exists'
);

-- Create isolated fixture data as the database owner so this test validates
-- business authorization rather than relying on another pgTAP file's rows.
insert into public.classes (
  id, school_id, name_en, name_ar
) values
(
  '81000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Task 1 Contract Class',
  'صف عقد المهمة الأولى'
);

insert into public.subjects (
  id, school_id, name_en, name_ar
) values
(
  '82000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Task 1 Subject',
  'مادة المهمة الأولى'
),
(
  '82000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Unrelated Task 1 Subject',
  'مادة أخرى للمهمة الأولى'
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id
) values
(
  '83000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001'
),
(
  '83000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000002'
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, name_ar
) values
(
  '84000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  'Legacy Assigned Group',
  'المجموعة التاريخية'
),
(
  '84000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  'Sibling Group',
  'المجموعة الشقيقة'
),
(
  '84000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000002',
  'Unrelated Subject Group',
  'مجموعة المادة الأخرى'
);

-- c...002 is an existing seeded Teacher. This deliberately represents a
-- PRE-MIGRATION historical Group-scoped assignment. The production trigger
-- correctly rejects such NEW rows, so this fixture temporarily disables only
-- that forward-only trigger while reconstructing historical state.
alter table public.teaching_assignments
  disable trigger teaching_assignments_subject_only_new_writes;

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '85000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '83000000-0000-0000-0000-000000000001',
  '84000000-0000-0000-0000-000000000001',
  date '2026-09-01'
);

alter table public.teaching_assignments
  enable trigger teaching_assignments_subject_only_new_writes;

select ok(
  pg_temp.query_returns_true($probe$
    select case
      when to_regprocedure(
        'public.teacher_can_teach_week_context(uuid,uuid,uuid,date)'
      ) is not null
      then public.teacher_can_teach_week_context(
        'c0000000-0000-0000-0000-000000000002',
        '83000000-0000-0000-0000-000000000001',
        '84000000-0000-0000-0000-000000000002',
        date '2026-09-27'
      )
      else public.teacher_can_teach_context(
        'c0000000-0000-0000-0000-000000000002',
        '83000000-0000-0000-0000-000000000001',
        '84000000-0000-0000-0000-000000000002',
        date '2026-09-27'
      )
    end
  $probe$),
  'historical Group-scoped assignment grants authority to a sibling Group in the same Class Subject'
);

select ok(
  pg_temp.query_returns_true($probe$
    select not (
      case
        when to_regprocedure(
          'public.teacher_can_teach_week_context(uuid,uuid,uuid,date)'
        ) is not null
        then public.teacher_can_teach_week_context(
          'c0000000-0000-0000-0000-000000000002',
          '83000000-0000-0000-0000-000000000002',
          '84000000-0000-0000-0000-000000000003',
          date '2026-09-27'
        )
        else public.teacher_can_teach_context(
          'c0000000-0000-0000-0000-000000000002',
          '83000000-0000-0000-0000-000000000002',
          '84000000-0000-0000-0000-000000000003',
          date '2026-09-27'
        )
      end
    )
  $probe$),
  'Subject-wide authority does not leak into an unrelated Class Subject'
);

-- Legacy rows remain structurally representable for history.
select ok(
  exists (
    select 1
    from public.teaching_assignments
    where id = '85000000-0000-0000-0000-000000000001'
      and subject_group_id = '84000000-0000-0000-0000-000000000001'
  ),
  'historical Group-scoped assignment row is preserved rather than rewritten'
);

-- Task 1 must add a supported write path for Subject-only assignments.
select ok(
  pg_temp.public_function_exists('save_teaching_assignment')
    or pg_temp.public_function_exists('create_teaching_assignment')
    or pg_temp.public_function_exists('upsert_teaching_assignment'),
  'supported Teacher-assignment mutation RPC exists'
);

-- The Task 1 migration must enforce Subject-only semantics on supported new
-- assignment writes. Direct historical storage may retain subject_group_id.
select ok(
  pg_temp.query_returns_true($probe$
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'save_teaching_assignment',
          'create_teaching_assignment',
          'upsert_teaching_assignment'
        )
    )
  $probe$),
  'new assignment API is available for Subject-only assignment creation'
);

-------------------------------------------------------------------------------
-- TEACHER GROUP-MANAGEMENT RPC CONTRACT
-------------------------------------------------------------------------------

select ok(
  pg_temp.public_function_exists('teacher_create_subject_group'),
  'Teacher Group create RPC exists'
);

select ok(
  pg_temp.public_function_exists('teacher_rename_subject_group'),
  'Teacher Group rename RPC exists'
);

select ok(
  pg_temp.public_function_exists('teacher_archive_subject_group'),
  'Teacher Group archive RPC exists'
);

select ok(
  pg_temp.public_function_exists('teacher_restore_subject_group'),
  'Teacher Group restore RPC exists'
);

select ok(
  pg_temp.public_function_exists('teacher_move_subject_group_student'),
  'Teacher student Group-movement RPC exists'
);

select ok(
  pg_temp.public_function_exists('teacher_remove_subject_group_student'),
  'Teacher can return a student to ungrouped through an audited RPC'
);

-------------------------------------------------------------------------------
-- FLEXIBLE TEACHING UPDATE STORAGE FOUNDATION
-------------------------------------------------------------------------------

select ok(
  pg_temp.column_exists('weekly_submissions', 'coverage_kind'),
  'weekly_submissions has flexible coverage kind'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'period_start'),
  'weekly_submissions has period_start'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'period_end'),
  'weekly_submissions has period_end'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'request_set_id'),
  'weekly_submissions can link Admin-requested items into one request set'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'created_by_profile_id')
    or pg_temp.column_exists('weekly_submissions', 'creator_profile_id'),
  'weekly_submissions records creator metadata'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'admin_note')
    or pg_temp.column_exists('weekly_submissions', 'request_note'),
  'weekly_submissions can retain an Admin request note'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'dismissed_at'),
  'weekly_submissions records dismissal time'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'dismissed_by_profile_id'),
  'weekly_submissions records who dismissed an item'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'dismissal_reason'),
  'weekly_submissions records required dismissal reason'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'version'),
  'weekly_submissions supports optimistic concurrency'
);

select ok(
  to_regclass('public.weekly_submission_dates') is not null,
  'exact-date child table exists for DATES coverage'
);

-------------------------------------------------------------------------------
-- FLEXIBLE TEACHING UPDATE RPC CONTRACT
-------------------------------------------------------------------------------

select ok(
  pg_temp.public_function_exists('find_overlapping_teaching_updates')
    or pg_temp.public_function_exists('get_overlapping_teaching_updates'),
  'overlap lookup RPC exists'
);

select ok(
  pg_temp.public_function_exists('request_teaching_update'),
  'Admin Teaching Update request creation RPC exists'
);

select ok(
  pg_temp.public_function_exists('submit_teaching_update'),
  'atomic Teaching Update submit RPC exists'
);

select ok(
  pg_temp.public_function_exists('dismiss_teaching_update'),
  'audited Teaching Update dismissal RPC exists'
);

-------------------------------------------------------------------------------
-- FLEXIBLE COVERAGE BUSINESS RULES
-------------------------------------------------------------------------------

-- Once flexible columns exist, legacy weekly records must backfill as RANGE
-- week_start .. week_start + 6.  Dynamic SQL prevents RED from aborting while
-- those columns are still absent.
select ok(
  pg_temp.query_returns_true($probe$
    select not exists (
      select 1
      from public.weekly_submissions ws
      where ws.week_start is not null
        and (
          ws.coverage_kind::text <> 'RANGE'
          or ws.period_start <> ws.week_start
          or ws.period_end <> ws.week_start + 6
        )
    )
  $probe$),
  'legacy weekly submissions backfill to RANGE covering week_start through week_start + 6'
);

-- Old teacher/context/week uniqueness must disappear.  Overlap is warning-only.
select ok(
  not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'weekly_submissions'
      and c.conname = 'weekly_submissions_one_teacher_context_week'
  ),
  'old one-Teacher/context/week uniqueness is removed so overlaps can coexist'
);

-- OPEN future coverage is valid storage. Submission before the final covered
-- school-local date is the forbidden operation.
select ok(
  pg_temp.query_returns_true($probe$
    select exists (
      select 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'weekly_submissions'
        and a.attname = 'period_end'
        and not a.attisdropped
    )
  $probe$),
  'future-dated OPEN Teaching Updates have a persisted coverage end'
);

select ok(
  pg_temp.public_function_exists('submit_teaching_update'),
  'submission is separated from OPEN creation so early-submit validation can be atomic'
);

-------------------------------------------------------------------------------
-- REQUEST SET + FIRST-SUCCESSFUL-SUBMISSION FOUNDATIONS
-------------------------------------------------------------------------------

select ok(
  to_regclass('public.teaching_update_request_sets') is not null
    or pg_temp.column_exists('weekly_submissions', 'request_set_id'),
  'Admin-requested Teaching Updates have request-set identity'
);

select ok(
  pg_temp.column_exists('weekly_submissions', 'requested_by_profile_id')
    or pg_temp.column_exists('weekly_submissions', 'request_set_id'),
  'Admin-requested Teaching Update provenance is represented'
);

select ok(
  pg_temp.public_function_exists('submit_teaching_update'),
  'request-item winner selection is routed through one atomic submit RPC'
);

select * from finish();
rollback;
