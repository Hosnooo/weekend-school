create function public.generate_report_snapshots(p_reports jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  inserted_count integer;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_reports,'[]'::jsonb)) <> 'array' then
    raise exception 'reports must be an array' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_reports,'[]'::jsonb)) as item(student_id uuid,period_start date,period_end date,language public.report_language,snapshot_json jsonb)
    where not exists (select 1 from public.students where students.school_id=target_school_id and students.id=item.student_id)
      or item.period_end < item.period_start
      or jsonb_typeof(item.snapshot_json) <> 'object'
  ) then raise exception 'invalid report snapshot input' using errcode = '23514'; end if;

  insert into public.reports (school_id,student_id,period_start,period_end,language,status,snapshot_json)
  select target_school_id,item.student_id,item.period_start,item.period_end,item.language,'READY',item.snapshot_json
  from jsonb_to_recordset(coalesce(p_reports,'[]'::jsonb)) as item(student_id uuid,period_start date,period_end date,language public.report_language,snapshot_json jsonb)
  on conflict (school_id, student_id, period_start, period_end, language) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.generate_report_snapshots(jsonb) from public;
grant execute on function public.generate_report_snapshots(jsonb) to authenticated;
