-- Teachers may correct submitted weekly work until it has been used in a
-- finalized parent-facing report. Unfinished report approvals are invalidated
-- when their Teacher source is reopened.

create or replace function public.protect_submitted_weekly_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'SUBMITTED' then
    if tg_op = 'UPDATE'
      and new.status = 'DRAFT'
      and new.submitted_at is null
      and coalesce(
        current_setting(
          'app.reopening_weekly_submission',
          true
        ),
        ''
      ) = 'on'
    then
      return new;
    end if;

    raise exception 'submitted weekly submissions are immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.reopen_weekly_submission(
  p_submission_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_submission public.weekly_submissions%rowtype;
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  select submission.*
  into target_submission
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = p_submission_id
    and submission.teacher_id in (
      select public.current_teacher_ids()
    )
  for update;

  if not found then
    raise exception 'weekly submission access required'
      using errcode = '42501';
  end if;

  if target_submission.status = 'DRAFT' then
    return true;
  end if;

  if exists (
    select 1
    from public.report_section_sources source
    join public.report_section_approvals approval
      on approval.school_id = source.school_id
     and approval.id = source.approval_id
    join public.report_batches batch
      on batch.school_id = approval.school_id
     and batch.id = approval.batch_id
    where source.school_id = target_school_id
      and source.weekly_submission_id = p_submission_id
      and batch.status = 'FINALIZED'
  ) then
    raise exception
      'finalized report already uses this submission'
      using errcode = '55000';
  end if;

  -- A legacy REVIEW batch becomes editable again if one of its sources changes.
  update public.report_batches batch
  set
    status = 'DRAFT',
    finalized_at = null
  where batch.school_id = target_school_id
    and batch.status = 'REVIEW'
    and exists (
      select 1
      from public.report_section_approvals approval
      join public.report_section_sources source
        on source.school_id = approval.school_id
       and source.approval_id = approval.id
      where approval.school_id = batch.school_id
        and approval.batch_id = batch.id
        and source.weekly_submission_id = p_submission_id
    );

  -- Drop the whole unfinished approval context so the Admin cannot
  -- unknowingly finalize stale wording/performance from the old submission.
  delete from public.report_section_approvals approval
  where approval.school_id = target_school_id
    and exists (
      select 1
      from public.report_section_sources source
      join public.report_batches batch
        on batch.school_id = approval.school_id
       and batch.id = approval.batch_id
      where source.school_id = approval.school_id
        and source.approval_id = approval.id
        and source.weekly_submission_id = p_submission_id
        and batch.status <> 'FINALIZED'
    );

  perform set_config(
    'app.reopening_weekly_submission',
    'on',
    true
  );

  update public.weekly_submissions
  set
    status = 'DRAFT',
    submitted_at = null
  where school_id = target_school_id
    and id = p_submission_id;

  perform set_config(
    'app.reopening_weekly_submission',
    'off',
    true
  );

  return true;
end;
$$;

revoke all
on function public.reopen_weekly_submission(uuid)
from public;

revoke execute
on function public.reopen_weekly_submission(uuid)
from anon;

grant execute
on function public.reopen_weekly_submission(uuid)
to authenticated;
