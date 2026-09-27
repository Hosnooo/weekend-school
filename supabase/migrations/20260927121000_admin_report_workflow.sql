-- Allow an administrator to continue editing a finalized report batch
-- until delivery has successfully started/completed.
--
-- Finalized snapshot JSON remains immutable. Existing report rows are kept
-- as historical revisions; reopening only makes them non-sendable and
-- returns the working batch to DRAFT. A later finalization creates the
-- next immutable report revision through finalize_report_batch().

create or replace function public.reopen_unsent_report_batch(
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
    raise exception 'report batch not found'
      using errcode = 'P0002';
  end if;

  if target_batch.status <> 'FINALIZED' then
    return true;
  end if;

  -- Once sending is pending or has succeeded, the finalized snapshot
  -- remains closed. Corrections after delivery use a later revision.
  if exists (
    select 1
    from public.reports report
    left join public.email_deliveries delivery
      on delivery.school_id = report.school_id
     and delivery.report_id = report.id
    where report.school_id = target_school_id
      and report.batch_id = p_batch_id
      and (
        report.status = 'SENT'
        or delivery.status in ('PENDING', 'SENT', 'DELIVERED')
      )
  ) then
    raise exception
      'delivered or pending reports cannot be reopened'
      using errcode = '55000';
  end if;

  -- Preserve immutable snapshots but remove them from the send queue.
  update public.reports report
  set
    status = 'DRAFT',
    sent_at = null
  where report.school_id = target_school_id
    and report.batch_id = p_batch_id
    and report.status in ('READY', 'FAILED');

  update public.report_batches batch
  set
    status = 'DRAFT',
    finalized_at = null
  where batch.school_id = target_school_id
    and batch.id = p_batch_id;

  return true;
end;
$$;

revoke all
on function public.reopen_unsent_report_batch(uuid)
from public;

revoke execute
on function public.reopen_unsent_report_batch(uuid)
from anon;

grant execute
on function public.reopen_unsent_report_batch(uuid)
to authenticated;
