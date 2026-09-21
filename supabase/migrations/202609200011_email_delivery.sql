create function public.reserve_report_delivery(p_report_id uuid,p_guardian_id uuid,p_provider text)
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
  if target_school_id is null or not public.is_admin() then raise exception 'administrator access required' using errcode='42501'; end if;
  select * into target_report from public.reports where id=p_report_id and school_id=target_school_id and status in ('READY','FAILED') for update;
  if not found then raise exception 'sendable report not found' using errcode='P0002'; end if;
  select guardians.email into target_email from public.student_guardians join public.guardians on guardians.school_id=student_guardians.school_id and guardians.id=student_guardians.guardian_id where student_guardians.school_id=target_school_id and student_guardians.student_id=target_report.student_id and student_guardians.guardian_id=p_guardian_id and student_guardians.receives_reports and guardians.is_active and guardians.report_language=target_report.language;
  if target_email is null then raise exception 'active report recipient not found' using errcode='P0002'; end if;
  insert into public.email_deliveries(school_id,report_id,guardian_id,recipient_email,provider,status)
  values(target_school_id,p_report_id,p_guardian_id,target_email,trim(p_provider),'PENDING')
  on conflict(report_id,guardian_id) do nothing returning id into new_delivery_id;
  if new_delivery_id is not null then return jsonb_build_object('delivery_id',new_delivery_id,'should_send',true,'recipient_email',target_email); end if;
  select * into existing_delivery from public.email_deliveries where report_id=p_report_id and guardian_id=p_guardian_id for update;
  if existing_delivery.status in ('SENT','DELIVERED','PENDING') then return jsonb_build_object('delivery_id',existing_delivery.id,'should_send',false,'recipient_email',existing_delivery.recipient_email); end if;
  update public.email_deliveries set status='PENDING',provider=trim(p_provider),provider_message_id=null,error_message=null,sent_at=null where id=existing_delivery.id;
  return jsonb_build_object('delivery_id',existing_delivery.id,'should_send',true,'recipient_email',target_email);
end;
$$;

create function public.complete_report_delivery(p_delivery_id uuid,p_success boolean,p_provider_message_id text,p_error_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_report_id uuid;
  intended_count integer;
  sent_count integer;
begin
  if target_school_id is null or not public.is_admin() then raise exception 'administrator access required' using errcode='42501'; end if;
  select report_id into target_report_id from public.email_deliveries where id=p_delivery_id and school_id=target_school_id for update;
  if target_report_id is null then raise exception 'delivery not found' using errcode='P0002'; end if;
  update public.email_deliveries set status=case when p_success then 'SENT'::public.delivery_status else 'FAILED'::public.delivery_status end,provider_message_id=case when p_success then nullif(trim(p_provider_message_id),'') else null end,error_message=case when p_success then null else left(coalesce(p_error_message,'Email delivery failed'),500) end,sent_at=case when p_success then now() else null end where id=p_delivery_id;
  select count(*) into intended_count from public.reports join public.student_guardians on student_guardians.school_id=reports.school_id and student_guardians.student_id=reports.student_id join public.guardians on guardians.school_id=student_guardians.school_id and guardians.id=student_guardians.guardian_id where reports.id=target_report_id and reports.school_id=target_school_id and student_guardians.receives_reports and guardians.is_active and guardians.report_language=reports.language;
  select count(*) into sent_count from public.email_deliveries where report_id=target_report_id and status in ('SENT','DELIVERED');
  if exists(select 1 from public.email_deliveries where report_id=target_report_id and status='FAILED') then update public.reports set status='FAILED',sent_at=null where id=target_report_id;
  elsif sent_count>=intended_count and intended_count>0 then update public.reports set status='SENT',sent_at=now() where id=target_report_id;
  else update public.reports set status='READY',sent_at=null where id=target_report_id; end if;
end;
$$;

revoke all on function public.reserve_report_delivery(uuid,uuid,text) from public;
revoke all on function public.complete_report_delivery(uuid,boolean,text,text) from public;
grant execute on function public.reserve_report_delivery(uuid,uuid,text) to authenticated;
grant execute on function public.complete_report_delivery(uuid,boolean,text,text) to authenticated;
