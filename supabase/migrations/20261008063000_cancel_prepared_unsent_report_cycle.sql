-- Atomic admin-only dismissal of unfinished or prepared-unsent Class Report Cycles.
-- Prepared snapshots are not deliveries; teacher Teaching Updates are untouched.
create or replace function public.cancel_class_report_cycle(
  p_batch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_batch public.report_batches%rowtype;
  removed_count integer;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  select batch.*
  into target_batch
  from public.report_batches batch
  where batch.school_id = target_school_id
    and batch.id = p_batch_id
  for update;

  if not found then
    raise exception 'report cycle not found'
      using errcode = 'P0002';
  end if;

  if target_batch.scope_type <> 'CLASS' then
    raise exception 'only Class Report Cycles can be dismissed'
      using errcode = '23514';
  end if;

  if target_batch.status not in ('DRAFT', 'REVIEW', 'FINALIZED') then
    raise exception 'invalid Report Cycle status'
      using errcode = '23514';
  end if;

  -- No sent/failed or other processing-state snapshots can be discarded.
  if exists (
    select 1
    from public.reports report
    where report.school_id = target_school_id
      and report.batch_id = p_batch_id
      and report.status not in ('DRAFT', 'READY')
  ) then
    raise exception 'reports entering delivery cannot be dismissed'
      using errcode = '55000';
  end if;

  -- Even a failed delivery attempt is retained for auditability.
  if exists (
    select 1
    from public.email_deliveries delivery
    join public.reports report
      on report.school_id = delivery.school_id
     and report.id = delivery.report_id
    where report.school_id = target_school_id
      and report.batch_id = p_batch_id
  ) then
    raise exception 'Report Cycles with delivery history cannot be dismissed'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.reports source_report
    join public.reports newer_report
      on newer_report.school_id = source_report.school_id
     and newer_report.supersedes_report_id = source_report.id
    where source_report.school_id = target_school_id
      and source_report.batch_id = p_batch_id
      and newer_report.batch_id is distinct from p_batch_id
  ) then
    raise exception 'Report Cycles referenced by later report revisions cannot be dismissed'
      using errcode = '55000';
  end if;

  -- Same-batch revisions refer to their predecessors with a RESTRICT FK.
  -- Remove leaves first, so every delete respects the revision chain.
  loop
    delete from public.reports report
    where report.school_id = target_school_id
      and report.batch_id = p_batch_id
      and not exists (
        select 1
        from public.reports successor
        where successor.school_id = report.school_id
          and successor.supersedes_report_id = report.id
      );
    get diagnostics removed_count = row_count;
    exit when removed_count = 0;
  end loop;

  if exists (
    select 1
    from public.reports report
    where report.school_id = target_school_id
      and report.batch_id = p_batch_id
  ) then
    raise exception 'report revisions could not be safely dismissed'
      using errcode = '55000';
  end if;

  delete from public.report_batches batch
  where batch.school_id = target_school_id
    and batch.id = p_batch_id;

  return true;
end;
$$;

revoke all on function public.cancel_class_report_cycle(uuid)
from public;
revoke execute on function public.cancel_class_report_cycle(uuid)
from anon;
grant execute on function public.cancel_class_report_cycle(uuid)
to authenticated;
