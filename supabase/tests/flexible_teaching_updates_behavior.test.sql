begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-------------------------------------------------------------------------------
-- Test helpers: missing Task 1 migration-2 objects must become TAP failures,
-- not abort the file.
-------------------------------------------------------------------------------

create or replace function pg_temp.statement_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000';
exception
  when others then
    return sqlstate;
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
  when others then
    raise notice 'query_returns_true failed [%]: %', sqlstate, sqlerrm;
    return false;
end;
$$;

-------------------------------------------------------------------------------
-- Isolated academic context
-------------------------------------------------------------------------------

insert into public.classes (
  id, school_id, name_en, name_ar
) values (
  '91000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Flexible Update Contract Class',
  'صف عقد التحديث المرن'
);

insert into public.subjects (
  id, school_id, name_en, name_ar
) values (
  '92000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Flexible Update Subject',
  'مادة التحديث المرن'
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id
) values (
  '93000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001'
);

insert into public.subject_groups (
  id, school_id, class_subject_id, name_en, name_ar
) values
(
  '94000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'Flexible Group A',
  'المجموعة أ'
),
(
  '94000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'Flexible Group B',
  'المجموعة ب'
);

-- Two Teachers share this Class Subject so first-winner request semantics can
-- be tested.
insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values
(
  '95000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000001',
  null,
  date '2025-01-01'
),
(
  '95000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  '93000000-0000-0000-0000-000000000001',
  null,
  date '2025-01-01'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

-------------------------------------------------------------------------------
-- 1. New assignment writes must be Subject-only.
--
-- Historical Group-scoped rows remain readable, but a new direct write after
-- the migration must not create another Group-scoped assignment.
-------------------------------------------------------------------------------

select is(
  pg_temp.statement_sqlstate($probe$
    insert into public.teaching_assignments (
      id,
      school_id,
      teacher_id,
      class_subject_id,
      subject_group_id,
      starts_on
    ) values (
      '95000000-0000-0000-0000-000000000099',
      'a0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000002',
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      date '2027-01-01'
    )
  $probe$),
  '23514',
  'new Group-scoped Teacher assignment writes are rejected'
);

-------------------------------------------------------------------------------
-- 2. Overlapping Teaching Updates are permitted.
-------------------------------------------------------------------------------

select ok(
  pg_temp.statement_lives($probe$
    insert into public.weekly_submissions (
      id,
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_id,
      week_start
    ) values
    (
      '96000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000002',
      date '2026-01-05'
    ),
    (
      '96000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000002',
      date '2026-01-05'
    )
  $probe$),
  'overlapping Teaching Updates are allowed rather than uniqueness-blocked'
);

-------------------------------------------------------------------------------
-- 3. Admin request snapshots current active Groups: two Groups -> two items.
-------------------------------------------------------------------------------

create or replace function pg_temp.admin_request_fans_out()
returns boolean
language plpgsql
as $$
declare
  target_request_set_id uuid;
  item_count integer;
begin
  select public.request_teaching_update(
    '93000000-0000-0000-0000-000000000001',
    'RANGE',
    date '2026-02-01',
    date '2026-02-07',
    null::date[],
    'February request'
  )
  into target_request_set_id;

  select count(*)
  into item_count
  from public.weekly_submissions submission
  where submission.request_set_id = target_request_set_id;

  return item_count = 2;
exception
  when others then
    raise notice 'admin_request_fans_out failed [%]: %',
      sqlstate, sqlerrm;
    return false;
end;
$$;

select ok(
  pg_temp.admin_request_fans_out(),
  'Admin Subject request creates one linked item per active Group'
);

-------------------------------------------------------------------------------
-- 4. DATES coverage stores each exact non-consecutive covered date.
-------------------------------------------------------------------------------

create or replace function pg_temp.dates_request_is_preserved()
returns boolean
language plpgsql
as $$
declare
  target_request_set_id uuid;
  exact_row_count integer;
  distinct_date_count integer;
begin
  select public.request_teaching_update(
    '93000000-0000-0000-0000-000000000001',
    'DATES',
    null::date,
    null::date,
    array[
      date '2026-03-01',
      date '2026-03-08',
      date '2026-03-22'
    ],
    'Non-consecutive dates'
  )
  into target_request_set_id;

  select
    count(*),
    count(distinct exact_date.covered_on)
  into
    exact_row_count,
    distinct_date_count
  from public.weekly_submission_dates exact_date
  join public.weekly_submissions submission
    on submission.school_id = exact_date.school_id
   and submission.id = exact_date.submission_id
  where submission.request_set_id = target_request_set_id;

  return
    exact_row_count = 6
    and distinct_date_count = 3;
exception
  when others then
    raise notice 'dates_request_is_preserved failed [%]: %',
      sqlstate, sqlerrm;
    return false;
end;
$$;

select ok(
  pg_temp.dates_request_is_preserved(),
  'DATES request preserves exact dates for every snapshotted Group item'
);

-------------------------------------------------------------------------------
-- 5. Future OPEN requests may be created.
-------------------------------------------------------------------------------

create or replace function pg_temp.future_request_can_exist()
returns boolean
language plpgsql
as $$
declare
  target_request_set_id uuid;
  item_count integer;
begin
  select public.request_teaching_update(
    '93000000-0000-0000-0000-000000000001',
    'RANGE',
    date '2099-06-01',
    date '2099-06-07',
    null::date[],
    'Future request'
  )
  into target_request_set_id;

  select count(*)
  into item_count
  from public.weekly_submissions submission
  where submission.request_set_id = target_request_set_id
    and submission.status = 'DRAFT';

  return item_count = 2;
exception
  when others then
    raise notice 'future_request_can_exist failed [%]: %',
      sqlstate, sqlerrm;
    return false;
end;
$$;

select ok(
  pg_temp.future_request_can_exist(),
  'future-dated OPEN Teaching Update request can exist'
);

-------------------------------------------------------------------------------
-- Helpers for state-transition behavior.
-------------------------------------------------------------------------------

create or replace function pg_temp.future_submit_is_blocked()
returns boolean
language plpgsql
as $$
declare
  target_request_set_id uuid;
  target_submission_id uuid;
  target_version integer;
  result boolean;
begin
  -- Admin creates the future request.
  perform set_config(
    'request.jwt.claim.sub',
    'b0000000-0000-0000-0000-000000000001',
    true
  );

  execute $q$
    select public.request_teaching_update(
      '93000000-0000-0000-0000-000000000001'::uuid,
      'RANGE',
      date '2099-07-01',
      date '2099-07-07',
      null::date[],
      'Early submit guard'
    )
  $q$
  into target_request_set_id;

  select submission.id, submission.version
  into target_submission_id, target_version
  from public.weekly_submissions submission
  where submission.request_set_id = target_request_set_id
  order by submission.id
  limit 1;

  -- Teacher attempts submission before the coverage has occurred.
  perform set_config(
    'request.jwt.claim.sub',
    'b0000000-0000-0000-0000-000000000002',
    true
  );

  begin
    execute
      'select public.submit_teaching_update($1,$2,$3)'
      into result
      using
        target_submission_id,
        'c0000000-0000-0000-0000-000000000002'::uuid,
        target_version;

    return false;
  exception
    when check_violation then
      return true;
    when others then
      return false;
  end;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.first_submitter_wins()
returns boolean
language plpgsql
as $$
declare
  target_request_set_id uuid;
  target_submission_id uuid;
  target_version integer;
  first_result boolean;
  second_result boolean;
begin
  perform set_config(
    'request.jwt.claim.sub',
    'b0000000-0000-0000-0000-000000000001',
    true
  );

  execute $q$
    select public.request_teaching_update(
      '93000000-0000-0000-0000-000000000001'::uuid,
      'RANGE',
      date '2026-01-01',
      date '2026-01-02',
      null::date[],
      'Atomic winner test'
    )
  $q$
  into target_request_set_id;

  select submission.id, submission.version
  into target_submission_id, target_version
  from public.weekly_submissions submission
  where submission.request_set_id = target_request_set_id
  order by submission.id
  limit 1;

  perform set_config(
    'request.jwt.claim.sub',
    'b0000000-0000-0000-0000-000000000002',
    true
  );

  execute
    'select public.submit_teaching_update($1,$2,$3)'
    into first_result
    using
      target_submission_id,
      'c0000000-0000-0000-0000-000000000002'::uuid,
      target_version;

  perform set_config(
    'request.jwt.claim.sub',
    'b0000000-0000-0000-0000-000000000003',
    true
  );

  begin
    execute
      'select public.submit_teaching_update($1,$2,$3)'
      into second_result
      using
        target_submission_id,
        'c0000000-0000-0000-0000-000000000003'::uuid,
        target_version;

    return false;
  exception
    when others then
      return first_result is true;
  end;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.dismissal_is_audited()
returns boolean
language plpgsql
as $$
declare
  target_request_set_id uuid;
  target_submission_id uuid;
  target_version integer;
  dismiss_result boolean;
  missing_reason_blocked boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    'b0000000-0000-0000-0000-000000000001',
    true
  );

  execute $q$
    select public.request_teaching_update(
      '93000000-0000-0000-0000-000000000001'::uuid,
      'RANGE',
      date '2026-04-01',
      date '2026-04-07',
      null::date[],
      'Dismissal audit test'
    )
  $q$
  into target_request_set_id;

  select submission.id, submission.version
  into target_submission_id, target_version
  from public.weekly_submissions submission
  where submission.request_set_id = target_request_set_id
  order by submission.id
  limit 1;

  perform set_config(
    'request.jwt.claim.sub',
    'b0000000-0000-0000-0000-000000000002',
    true
  );

  begin
    execute
      'select public.dismiss_teaching_update($1,$2,$3)'
      using target_submission_id, null::text, target_version;
  exception
    when check_violation then
      missing_reason_blocked := true;
    when others then
      return false;
  end;

  if not missing_reason_blocked then
    return false;
  end if;

  execute
    'select public.dismiss_teaching_update($1,$2,$3)'
    into dismiss_result
    using
      target_submission_id,
      'Not applicable for this Group',
      target_version;

  return
    dismiss_result
    and exists (
      select 1
      from public.weekly_submissions submission
      where submission.id = target_submission_id
        and submission.status = 'DISMISSED'
        and submission.dismissed_at is not null
        and submission.dismissed_by_profile_id is not null
        and submission.dismissal_reason =
          'Not applicable for this Group'
    );
exception
  when others then
    return false;
end;
$$;

-------------------------------------------------------------------------------
-- 6. Future submit guard.
-------------------------------------------------------------------------------

select ok(
  pg_temp.future_submit_is_blocked(),
  'future OPEN Teaching Update cannot be submitted early'
);

-------------------------------------------------------------------------------
-- 7. One Admin-request item has exactly one winning Teacher submission.
-------------------------------------------------------------------------------

select ok(
  pg_temp.first_submitter_wins(),
  'first successful Teacher submission atomically completes request item'
);

-------------------------------------------------------------------------------
-- 8. Admin-request dismissal requires and records an audit reason.
-------------------------------------------------------------------------------

select ok(
  pg_temp.dismissal_is_audited(),
  'Teacher dismissal of Admin-requested item requires audited reason'
);

select * from finish();
rollback;
