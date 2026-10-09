-- Forward-only numeric attendance for Teacher Teaching Updates.
-- Existing submitted PRESENT/ABSENT observations remain archived as legacy status.
-- New Teacher saves set status NULL and persist actual session counts.
-- NEVER backfill attendance totals from weekly/date ranges.

alter table public.weekly_submission_students
  add column if not exists attendance_attended integer,
  add column if not exists attendance_total integer;

alter table public.weekly_submission_students
  alter column attendance_status drop not null;

alter table public.weekly_submission_students
  add constraint weekly_submission_students_attendance_pair_chk
  check (
    (
      attendance_status is not null
      and attendance_attended is null
      and attendance_total is null
    ) or (
      attendance_status is null
      and attendance_attended is not null
      and attendance_total is not null
      and attendance_attended >= 0
      and attendance_total >= 0
      and attendance_attended <= attendance_total
    )
  );

-- New Teaching Updates are explicitly marked numeric. Existing legacy rows,
-- including historical fixtures and compatibility API records, are preserved.
alter table public.weekly_submissions
  add column if not exists attendance_format text not null default 'LEGACY';
alter table public.weekly_submissions
  add constraint weekly_submissions_attendance_format_check
  check (attendance_format in ('LEGACY', 'NUMERIC'));

-- Replace exactly the existing UUID-signature function, preserving its access
-- controls, teacher/school context checks and optimistic version locking.
-- Flexible Teacher-authored Teaching Update draft persistence.
-- The foundational flexible lifecycle/request contract lives in migrations
-- 20260927220000 and 20260927221000. This migration adds only the missing
-- atomic Teacher draft mutation required by the application.

create or replace function public.save_teaching_update_draft(
  p_teacher_id uuid,
  p_submission_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_coverage_kind text,
  p_period_start date,
  p_period_end date,
  p_dates date[],
  p_progress_en text,
  p_progress_ar text,
  p_default_performance public.performance_level,
  p_attendance jsonb,
  p_exceptions jsonb,
  p_expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();
  target_submission_id uuid := p_submission_id;
  target_status public.session_status;
  target_version integer;
  target_teacher_id uuid;
  target_request_set_id uuid;
  normalized_dates date[];
  normalized_start date;
  normalized_end date;
begin
  if target_school_id is null or target_profile_id is null then
    raise exception 'authenticated school access required'
      using errcode = '42501';
  end if;

  if p_teacher_id is null
     or p_teacher_id not in (select public.current_teacher_ids()) then
    raise exception 'Teacher access required'
      using errcode = '42501';
  end if;

  if p_class_subject_id is null
     or p_period_start is null
     or p_period_end is null
     or p_period_end < p_period_start
     or p_coverage_kind not in ('RANGE', 'DATES') then
    raise exception 'invalid Teaching Update coverage'
      using errcode = '22023';
  end if;

  if p_coverage_kind = 'RANGE' then
    normalized_start := p_period_start;
    normalized_end := p_period_end;
    normalized_dates := array[]::date[];
  else
    select
      array_agg(distinct covered_on order by covered_on),
      min(covered_on),
      max(covered_on)
    into
      normalized_dates,
      normalized_start,
      normalized_end
    from unnest(coalesce(p_dates, array[]::date[])) covered_on;

    if coalesce(array_length(normalized_dates, 1), 0) = 0
       or normalized_start is distinct from p_period_start
       or normalized_end is distinct from p_period_end then
      raise exception 'exact Teaching Update dates must match the coverage bounds'
        using errcode = '22023';
    end if;
  end if;

  if not public.teacher_can_teach_period_context(
    p_teacher_id,
    p_class_subject_id,
    p_subject_group_id,
    normalized_start,
    normalized_end
  ) then
    raise exception 'assigned Teaching Subject required'
      using errcode = '42501';
  end if;

  if p_subject_group_id is not null
     and not exists (
       select 1
       from public.subject_groups subject_group
       where subject_group.school_id = target_school_id
         and subject_group.class_subject_id = p_class_subject_id
         and subject_group.id = p_subject_group_id
         and subject_group.is_active
     ) then
    raise exception 'active Subject Group not found'
      using errcode = 'P0002';
  end if;

  if target_submission_id is null then
    insert into public.weekly_submissions (
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_id,
      week_start,
      status,
      progress_en,
      progress_ar,
      default_performance,
      coverage_kind,
      period_start,
      period_end,
      created_by_profile_id,
      attendance_format,
      version
    ) values (
      target_school_id,
      p_class_subject_id,
      p_subject_group_id,
      p_teacher_id,
      normalized_start,
      'DRAFT',
      nullif(trim(coalesce(p_progress_en, '')), ''),
      nullif(trim(coalesce(p_progress_ar, '')), ''),
      p_default_performance,
      p_coverage_kind,
      normalized_start,
      normalized_end,
      target_profile_id,
      'NUMERIC',
      1
    )
    returning id into target_submission_id;
  else
    select
      submission.status,
      submission.version,
      submission.teacher_id,
      submission.request_set_id
    into
      target_status,
      target_version,
      target_teacher_id,
      target_request_set_id
    from public.weekly_submissions submission
    where submission.school_id = target_school_id
      and submission.id = target_submission_id
      and submission.class_subject_id = p_class_subject_id
      and submission.subject_group_id is not distinct from p_subject_group_id
    for update;

    if target_status is null then
      raise exception 'Teaching Update not found'
        using errcode = 'P0002';
    end if;

    if target_status <> 'DRAFT' then
      raise exception 'completed Teaching Updates are immutable'
        using errcode = '55000';
    end if;

    if target_teacher_id is not null
       and target_teacher_id <> p_teacher_id then
      raise exception 'Teaching Update belongs to another Teacher'
        using errcode = '42501';
    end if;

    if target_teacher_id is null
       and target_request_set_id is null then
      raise exception 'unclaimed Teaching Update is not an Admin request'
        using errcode = '42501';
    end if;

    if p_expected_version is null
       or p_expected_version <> target_version then
      raise exception 'Teaching Update version conflict'
        using errcode = '40001';
    end if;

    update public.weekly_submissions
    set
      week_start = normalized_start,
      coverage_kind = p_coverage_kind,
      period_start = normalized_start,
      period_end = normalized_end,
      progress_en = nullif(trim(coalesce(p_progress_en, '')), ''),
      progress_ar = nullif(trim(coalesce(p_progress_ar, '')), ''),
      default_performance = p_default_performance,
      attendance_format = 'NUMERIC',
      version = version + 1
    where school_id = target_school_id
      and id = target_submission_id;
  end if;

  delete from public.weekly_submission_dates exact_date
  where exact_date.school_id = target_school_id
    and exact_date.submission_id = target_submission_id;

  if p_coverage_kind = 'DATES' then
    insert into public.weekly_submission_dates (
      school_id,
      submission_id,
      covered_on
    )
    select
      target_school_id,
      target_submission_id,
      covered_on
    from unnest(normalized_dates) covered_on;
  end if;

  -- A draft may have incomplete attendance. Persist only students that already
  -- have an attendance value, matching the existing weekly storage contract.
  delete from public.weekly_submission_students observation
  where observation.school_id = target_school_id
    and observation.submission_id = target_submission_id;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
      as attendance_item(student_id uuid, attended integer, total integer)
    where not exists (
      select 1
      from public.get_weekly_submission_roster(
        p_class_subject_id,
        p_subject_group_id,
        normalized_end
      ) roster
      where roster.student_id = attendance_item.student_id
    )
  ) then
    raise exception 'Teaching Update attendance contains a student outside the roster'
      using errcode = '22023';
  end if;

  -- Never let one student be saved twice or invalid counts reach storage.
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
      as item(student_id uuid, attended integer, total integer)
    group by student_id having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
      as item(student_id uuid, attended integer, total integer)
    where student_id is null or attended is null or total is null
       or attended < 0 or total < 0 or attended > total
  ) then
    raise exception 'attendance must contain one valid attended/total pair per student'
      using errcode = '22023';
  end if;

  insert into public.weekly_submission_students (
    school_id,
    submission_id,
    student_id,
    attendance_status,
    attendance_attended,
    attendance_total,
    performance_override,
    comment_en,
    comment_ar
  )
  with attendance_items as (
    select *
    from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
      as attendance_item(
        student_id uuid,
        attended integer,
        total integer
      )
  ),
  exception_items as (
    select *
    from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb))
      as exception_item(
        student_id uuid,
        performance_override public.performance_level,
        comment_en text,
        comment_ar text
      )
  )
  select
    target_school_id,
    target_submission_id,
    attendance_item.student_id,
    null::public.attendance_status,
    attendance_item.attended,
    attendance_item.total,
    exception_item.performance_override,
    nullif(trim(coalesce(exception_item.comment_en, '')), ''),
    nullif(trim(coalesce(exception_item.comment_ar, '')), '')
  from attendance_items attendance_item
  left join exception_items exception_item
    on exception_item.student_id = attendance_item.student_id;

  return target_submission_id;
end;
$$;

-- A newly submitted Teaching Update must have an actual attended/total pair
-- for every student in its effective roster, not Present/Absent flags.
-- Existing SUBMITTED data is intentionally not modified by this guard.
create or replace function public.assert_numeric_teaching_update_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_count integer;
  recorded_count integer;
begin
  if new.status = 'SUBMITTED'
     and old.status is distinct from 'SUBMITTED'
     and new.attendance_format = 'NUMERIC'
  then
    select count(*) into expected_count
    from public.get_weekly_submission_roster(
      new.class_subject_id,
      new.subject_group_id,
      new.period_end
    );
    select count(*) into recorded_count
    from public.weekly_submission_students observation
    where observation.school_id = new.school_id
      and observation.submission_id = new.id
      and observation.attendance_status is null
      and observation.attendance_attended is not null
      and observation.attendance_total is not null
      and observation.attendance_total > 0;
    if expected_count <> recorded_count then
      raise exception
        'Enter attended and total sessions for every student before submitting'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.assert_numeric_teaching_update_attendance() from public, anon, authenticated;

drop trigger if exists require_numeric_teaching_update_attendance on public.weekly_submissions;
create trigger require_numeric_teaching_update_attendance
before update of status on public.weekly_submissions
for each row execute function public.assert_numeric_teaching_update_attendance();

-- The original weekly_status RPC remains solely for compatibility with
-- archived clients/fixtures. No current Teacher form calls that API.
-- Public-facing Teacher UI and save_teaching_update_draft use NUMERIC only.
