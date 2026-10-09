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
