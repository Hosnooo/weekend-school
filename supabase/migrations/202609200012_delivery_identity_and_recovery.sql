alter table public.email_deliveries
  add column student_id uuid,
  add column period_start date,
  add column period_end date;

update public.email_deliveries deliveries
set student_id = reports.student_id,
    period_start = reports.period_start,
    period_end = reports.period_end
from public.reports reports
where reports.school_id = deliveries.school_id
  and reports.id = deliveries.report_id;

alter table public.email_deliveries
  alter column student_id set not null,
  alter column period_start set not null,
  alter column period_end set not null,
  add foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  drop constraint email_deliveries_report_id_guardian_id_key,
  add constraint email_deliveries_logical_recipient_key
    unique (school_id, student_id, period_start, period_end, guardian_id);

create or replace function public.reserve_report_delivery(
  p_report_id uuid,
  p_guardian_id uuid,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_report public.reports%rowtype;
  target_email text;
  new_delivery_id uuid;
  existing_delivery public.email_deliveries%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  select * into target_report
  from public.reports
  where id = p_report_id
    and school_id = target_school_id
    and status in ('READY', 'FAILED')
  for update;

  if not found then
    raise exception 'sendable report not found' using errcode = 'P0002';
  end if;

  select guardians.email into target_email
  from public.student_guardians
  join public.guardians
    on guardians.school_id = student_guardians.school_id
   and guardians.id = student_guardians.guardian_id
  where student_guardians.school_id = target_school_id
    and student_guardians.student_id = target_report.student_id
    and student_guardians.guardian_id = p_guardian_id
    and student_guardians.receives_reports
    and guardians.is_active
    and guardians.report_language = target_report.language;

  if target_email is null then
    raise exception 'active report recipient not found' using errcode = 'P0002';
  end if;

  insert into public.email_deliveries (
    school_id,
    report_id,
    student_id,
    period_start,
    period_end,
    guardian_id,
    recipient_email,
    provider,
    status
  ) values (
    target_school_id,
    p_report_id,
    target_report.student_id,
    target_report.period_start,
    target_report.period_end,
    p_guardian_id,
    target_email,
    trim(p_provider),
    'PENDING'
  )
  on conflict on constraint email_deliveries_logical_recipient_key do nothing
  returning id into new_delivery_id;

  if new_delivery_id is not null then
    return jsonb_build_object(
      'delivery_id', new_delivery_id,
      'should_send', true,
      'recipient_email', target_email,
      'requires_reconciliation', false
    );
  end if;

  select * into existing_delivery
  from public.email_deliveries
  where school_id = target_school_id
    and student_id = target_report.student_id
    and period_start = target_report.period_start
    and period_end = target_report.period_end
    and guardian_id = p_guardian_id
  for update;

  if existing_delivery.status in ('SENT', 'DELIVERED') then
    return jsonb_build_object(
      'delivery_id', existing_delivery.id,
      'should_send', false,
      'recipient_email', existing_delivery.recipient_email,
      'requires_reconciliation', false
    );
  end if;

  if existing_delivery.status = 'PENDING' then
    if existing_delivery.updated_at >= now() - interval '23 hours' then
      return jsonb_build_object(
        'delivery_id', existing_delivery.id,
        'should_send', true,
        'recipient_email', existing_delivery.recipient_email,
        'requires_reconciliation', false
      );
    end if;

    return jsonb_build_object(
      'delivery_id', existing_delivery.id,
      'should_send', false,
      'recipient_email', existing_delivery.recipient_email,
      'requires_reconciliation', true
    );
  end if;

  update public.email_deliveries
  set status = 'PENDING',
      provider = trim(p_provider),
      provider_message_id = null,
      error_message = null,
      sent_at = null
  where id = existing_delivery.id;

  return jsonb_build_object(
    'delivery_id', existing_delivery.id,
    'should_send', true,
    'recipient_email', existing_delivery.recipient_email,
    'requires_reconciliation', false
  );
end;
$$;

revoke all on function public.reserve_report_delivery(uuid, uuid, text) from public;
grant execute on function public.reserve_report_delivery(uuid, uuid, text) to authenticated;
