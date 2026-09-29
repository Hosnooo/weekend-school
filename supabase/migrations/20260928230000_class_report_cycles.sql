-- Class Report Cycles.
--
-- Reuse report_batches / report_section_approvals / report_section_sources.
-- Historical SUBJECT/GROUP report batches remain unchanged.
-- New Class cycles select overlapping SUBMITTED Teaching Updates.

alter table public.report_section_sources
  add column included boolean not null default true;

create index report_section_sources_batch_selection_idx
  on public.report_section_sources (
    school_id,
    approval_id,
    included,
    weekly_submission_id
  );

-------------------------------------------------------------------------------
-- Recompute one approval from the currently included source links.
-------------------------------------------------------------------------------

create or replace function public.refresh_report_cycle_approval(
  p_approval_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
begin
  update public.report_section_approvals approval
  set
    approved_progress_en = (
      select string_agg(
        nullif(btrim(submission.progress_en), ''),
        E'\n\n'
        order by
          submission.period_start,
          submission.period_end,
          submission.created_at
      )
      from public.report_section_sources source
      join public.weekly_submissions submission
        on submission.school_id = source.school_id
       and submission.id = source.weekly_submission_id
      where source.school_id = target_school_id
        and source.approval_id = approval.id
        and source.included
    ),
    approved_progress_ar = (
      select string_agg(
        nullif(btrim(submission.progress_ar), ''),
        E'\n\n'
        order by
          submission.period_start,
          submission.period_end,
          submission.created_at
      )
      from public.report_section_sources source
      join public.weekly_submissions submission
        on submission.school_id = source.school_id
       and submission.id = source.weekly_submission_id
      where source.school_id = target_school_id
        and source.approval_id = approval.id
        and source.included
    ),
    performance = (
      select submission.default_performance
      from public.report_section_sources source
      join public.weekly_submissions submission
        on submission.school_id = source.school_id
       and submission.id = source.weekly_submission_id
      where source.school_id = target_school_id
        and source.approval_id = approval.id
        and source.included
        and submission.default_performance is not null
      order by
        submission.period_end desc,
        submission.period_start desc,
        submission.created_at desc
      limit 1
    ),
    updated_at = now()
  where approval.school_id = target_school_id
    and approval.id = p_approval_id;
end;
$$;

revoke all on function
  public.refresh_report_cycle_approval(uuid)
from public;

revoke execute on function
  public.refresh_report_cycle_approval(uuid)
from anon;

-------------------------------------------------------------------------------
-- Create one Class Report Cycle and snapshot its initial eligible sources.
-------------------------------------------------------------------------------

create or replace function public.create_class_report_cycle(
  p_class_id uuid,
  p_period_start date,
  p_period_end date,
  p_template_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  actor_profile_id uuid := public.current_profile_id();
  target_batch_id uuid;
  context_record record;
  target_approval_id uuid;
begin
  if target_school_id is null
    or actor_profile_id is null
    or not public.is_admin()
  then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  if p_class_id is null
    or p_period_start is null
    or p_period_end is null
    or p_period_end < p_period_start
  then
    raise exception 'invalid report cycle period'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.classes class_record
    where class_record.school_id = target_school_id
      and class_record.id = p_class_id
  ) then
    raise exception 'class not found'
      using errcode = 'P0002';
  end if;

  insert into public.report_batches (
    school_id,
    scope_type,
    class_id,
    class_subject_id,
    subject_group_id,
    period_start,
    period_end,
    template_id,
    status,
    created_by_profile_id
  )
  values (
    target_school_id,
    'CLASS',
    p_class_id,
    null,
    null,
    p_period_start,
    p_period_end,
    p_template_id,
    'DRAFT',
    actor_profile_id
  )
  returning id into target_batch_id;

  for context_record in
    select distinct
      submission.class_subject_id,
      submission.subject_group_id
    from public.weekly_submissions submission
    join public.class_subjects class_subject
      on class_subject.school_id = submission.school_id
     and class_subject.id = submission.class_subject_id
    where submission.school_id = target_school_id
      and class_subject.class_id = p_class_id
      and submission.status = 'SUBMITTED'
      and (
        (
          submission.coverage_kind = 'RANGE'
          and submission.period_start <= p_period_end
          and submission.period_end >= p_period_start
        )
        or
        (
          submission.coverage_kind = 'DATES'
          and exists (
            select 1
            from public.weekly_submission_dates covered_date
            where covered_date.school_id = submission.school_id
              and covered_date.submission_id = submission.id
              and covered_date.covered_on
                between p_period_start and p_period_end
          )
        )
      )
  loop
    insert into public.report_section_approvals (
      school_id,
      batch_id,
      class_subject_id,
      subject_group_id
    )
    values (
      target_school_id,
      target_batch_id,
      context_record.class_subject_id,
      context_record.subject_group_id
    )
    returning id into target_approval_id;

    insert into public.report_section_sources (
      school_id,
      approval_id,
      weekly_submission_id,
      included
    )
    select
      target_school_id,
      target_approval_id,
      submission.id,
      true
    from public.weekly_submissions submission
    join public.class_subjects class_subject
      on class_subject.school_id = submission.school_id
     and class_subject.id = submission.class_subject_id
    where submission.school_id = target_school_id
      and class_subject.class_id = p_class_id
      and submission.status = 'SUBMITTED'
      and submission.class_subject_id =
        context_record.class_subject_id
      and submission.subject_group_id
        is not distinct from context_record.subject_group_id
      and (
        (
          submission.coverage_kind = 'RANGE'
          and submission.period_start <= p_period_end
          and submission.period_end >= p_period_start
        )
        or
        (
          submission.coverage_kind = 'DATES'
          and exists (
            select 1
            from public.weekly_submission_dates covered_date
            where covered_date.school_id = submission.school_id
              and covered_date.submission_id = submission.id
              and covered_date.covered_on
                between p_period_start and p_period_end
          )
        )
      );

    perform public.refresh_report_cycle_approval(
      target_approval_id
    );
  end loop;

  return target_batch_id;
end;
$$;

revoke all on function
  public.create_class_report_cycle(uuid, date, date, uuid)
from public;

revoke execute on function
  public.create_class_report_cycle(uuid, date, date, uuid)
from anon;

grant execute on function
  public.create_class_report_cycle(uuid, date, date, uuid)
to authenticated;

-------------------------------------------------------------------------------
-- Admin source override.
-------------------------------------------------------------------------------

create or replace function public.set_report_cycle_source_included(
  p_batch_id uuid,
  p_submission_id uuid,
  p_included boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_status text;
  target_approval_id uuid;
begin
  if target_school_id is null
    or not public.is_admin()
  then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  select
    batch.status,
    approval.id
  into
    target_status,
    target_approval_id
  from public.report_batches batch
  join public.report_section_approvals approval
    on approval.school_id = batch.school_id
   and approval.batch_id = batch.id
  join public.report_section_sources source
    on source.school_id = approval.school_id
   and source.approval_id = approval.id
  where batch.school_id = target_school_id
    and batch.id = p_batch_id
    and source.weekly_submission_id = p_submission_id
  for update of batch;

  if not found then
    raise exception 'report cycle source not found'
      using errcode = 'P0002';
  end if;

  if target_status = 'FINALIZED' then
    raise exception
      'finalized report cycle sources cannot be changed'
      using errcode = '23514';
  end if;

  update public.report_section_sources source
  set included = p_included
  where source.school_id = target_school_id
    and source.approval_id = target_approval_id
    and source.weekly_submission_id = p_submission_id;

  perform public.refresh_report_cycle_approval(
    target_approval_id
  );
end;
$$;

revoke all on function
  public.set_report_cycle_source_included(uuid, uuid, boolean)
from public;

revoke execute on function
  public.set_report_cycle_source_included(uuid, uuid, boolean)
from anon;

grant execute on function
  public.set_report_cycle_source_included(uuid, uuid, boolean)
to authenticated;

-------------------------------------------------------------------------------
-- Finalization must use the frozen included source set for conflict checks.
-------------------------------------------------------------------------------

create or replace function public.finalize_report_batch(
  p_batch_id uuid,
  p_reports jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_batch public.report_batches%rowtype;
  inserted_count integer;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  select *
  into target_batch
  from public.report_batches
  where school_id = target_school_id
    and id = p_batch_id
  for update;

  if not found then
    raise exception 'report batch not found'
      using errcode = 'P0002';
  end if;

  if target_batch.status <> 'REVIEW' then
    raise exception
      'report batch must be in review before finalization'
      using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_reports, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_reports) = 0
  then
    raise exception
      'finalized reports must be a non-empty array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_reports) as item(
      student_id uuid,
      language public.report_language,
      snapshot_json jsonb
    )
    where item.student_id is null
      or item.language is null
      or coalesce(
        jsonb_typeof(item.snapshot_json),
        ''
      ) <> 'object'
      or item.snapshot_json ->> 'version' <> '2'
      or not exists (
        select 1
        from public.students student
        where student.school_id = target_school_id
          and student.id = item.student_id
      )
  ) then
    raise exception
      'invalid finalized report snapshot input'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(p_reports) as item(
      student_id uuid,
      language public.report_language,
      snapshot_json jsonb
    )
  ) <> (
    select count(
      distinct (item.student_id, item.language)
    )
    from jsonb_to_recordset(p_reports) as item(
      student_id uuid,
      language public.report_language,
      snapshot_json jsonb
    )
  ) then
    raise exception
      'duplicate student report language in batch'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.report_section_approvals approval
    join public.report_section_sources source
      on source.school_id = approval.school_id
     and source.approval_id = approval.id
     and source.included
    join public.weekly_submissions submission
      on submission.school_id = source.school_id
     and submission.id = source.weekly_submission_id
    join public.weekly_submission_students observation
      on observation.school_id = submission.school_id
     and observation.submission_id = submission.id
    where approval.school_id = target_school_id
      and approval.batch_id = target_batch.id
    group by
      submission.class_subject_id,
      submission.subject_group_id,
      submission.week_start,
      observation.student_id
    having count(
      distinct observation.attendance_status
    ) > 1
      and not exists (
        select 1
        from public.attendance_resolutions resolution
        where resolution.school_id = target_school_id
          and resolution.class_subject_id =
            submission.class_subject_id
          and resolution.subject_group_id
            is not distinct from
              submission.subject_group_id
          and resolution.week_start =
            submission.week_start
          and resolution.student_id =
            observation.student_id
      )
  ) then
    raise exception
      'unresolved attendance conflicts block report finalization'
      using errcode = '23514';
  end if;

  insert into public.reports (
    school_id,
    student_id,
    period_start,
    period_end,
    language,
    status,
    snapshot_json,
    batch_id,
    revision,
    supersedes_report_id,
    snapshot_version,
    finalized_at
  )
  select
    target_school_id,
    item.student_id,
    target_batch.period_start,
    target_batch.period_end,
    item.language,
    'READY',
    item.snapshot_json,
    target_batch.id,
    coalesce(previous.revision, 0) + 1,
    previous.id,
    2,
    now()
  from jsonb_to_recordset(p_reports) as item(
    student_id uuid,
    language public.report_language,
    snapshot_json jsonb
  )
  left join lateral (
    select report.id, report.revision
    from public.reports report
    where report.school_id = target_school_id
      and report.student_id = item.student_id
      and report.period_start =
        target_batch.period_start
      and report.period_end =
        target_batch.period_end
      and report.language = item.language
    order by report.revision desc
    limit 1
  ) previous on true;

  get diagnostics inserted_count = row_count;

  update public.report_batches
  set
    status = 'FINALIZED',
    finalized_at = now()
  where school_id = target_school_id
    and id = target_batch.id;

  return inserted_count;
end;
$$;

revoke all on function
  public.finalize_report_batch(uuid, jsonb)
from public;

revoke execute on function
  public.finalize_report_batch(uuid, jsonb)
from anon;

grant execute on function
  public.finalize_report_batch(uuid, jsonb)
to authenticated;
