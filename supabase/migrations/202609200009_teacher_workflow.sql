create function public.save_weekly_update(
  p_session_id uuid,
  p_group_id uuid,
  p_session_date date,
  p_progress_en text,
  p_progress_ar text,
  p_default_performance public.performance_level,
  p_attendance jsonb,
  p_exceptions jsonb,
  p_submit boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();
  target_session_id uuid := p_session_id;
  roster_count integer;
  attendance_count integer;
begin
  if target_school_id is null or target_profile_id is null or not public.teaches_group(p_group_id) then
    raise exception 'assigned teacher access required' using errcode = '42501';
  end if;

  if target_session_id is null then
    insert into public.sessions (school_id, group_id, session_date, created_by)
    values (target_school_id, p_group_id, p_session_date, target_profile_id)
    on conflict (school_id, group_id, session_date) do nothing
    returning id into target_session_id;

    if target_session_id is null then
      select sessions.id into target_session_id
      from public.sessions
      where sessions.school_id = target_school_id
        and sessions.group_id = p_group_id
        and sessions.session_date = p_session_date;
    end if;
  end if;

  if not exists (
    select 1 from public.sessions
    where sessions.id = target_session_id
      and sessions.school_id = target_school_id
      and sessions.group_id = p_group_id
      and sessions.session_date = p_session_date
      and sessions.created_by = target_profile_id
      and sessions.status = 'DRAFT'
  ) then
    raise exception 'submitted sessions are immutable' using errcode = '55000';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb)) as item(student_id uuid, status public.attendance_status)
    where not exists (
      select 1 from public.group_memberships memberships
      where memberships.school_id = target_school_id
        and memberships.group_id = p_group_id
        and memberships.student_id = item.student_id
        and memberships.starts_on <= p_session_date
        and (memberships.ends_on is null or memberships.ends_on >= p_session_date)
    )
  ) then raise exception 'attendance student is outside the session roster' using errcode = '42501'; end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb)) as item(student_id uuid, performance_override public.performance_level, comment_en text, comment_ar text)
    where not exists (
      select 1 from public.group_memberships memberships
      where memberships.school_id = target_school_id
        and memberships.group_id = p_group_id
        and memberships.student_id = item.student_id
        and memberships.starts_on <= p_session_date
        and (memberships.ends_on is null or memberships.ends_on >= p_session_date)
    )
  ) then raise exception 'exception student is outside the session roster' using errcode = '42501'; end if;

  if nullif(trim(p_progress_en), '') is null and nullif(trim(p_progress_ar), '') is null and p_default_performance is null then
    delete from public.group_progress where school_id = target_school_id and session_id = target_session_id;
  else
    insert into public.group_progress (school_id, session_id, progress_en, progress_ar, default_performance)
    values (target_school_id, target_session_id, nullif(trim(p_progress_en), ''), nullif(trim(p_progress_ar), ''), p_default_performance)
    on conflict (school_id, session_id) do update set progress_en=excluded.progress_en, progress_ar=excluded.progress_ar, default_performance=excluded.default_performance;
  end if;

  delete from public.attendance where school_id = target_school_id and session_id = target_session_id;
  insert into public.attendance (school_id, session_id, student_id, status)
  select target_school_id, target_session_id, item.student_id, item.status
  from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb)) as item(student_id uuid, status public.attendance_status);

  delete from public.student_progress where school_id = target_school_id and session_id = target_session_id;
  insert into public.student_progress (school_id, session_id, student_id, performance_override, comment_en, comment_ar)
  select target_school_id, target_session_id, item.student_id, item.performance_override, nullif(trim(item.comment_en), ''), nullif(trim(item.comment_ar), '')
  from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb)) as item(student_id uuid, performance_override public.performance_level, comment_en text, comment_ar text)
  where item.performance_override is not null or nullif(trim(item.comment_en), '') is not null or nullif(trim(item.comment_ar), '') is not null;

  if p_submit then
    if nullif(trim(p_progress_en), '') is null and nullif(trim(p_progress_ar), '') is null then
      raise exception 'progress is required for submission' using errcode = '23514';
    end if;
    select count(distinct memberships.student_id) into roster_count from public.group_memberships memberships where memberships.school_id=target_school_id and memberships.group_id=p_group_id and memberships.starts_on<=p_session_date and (memberships.ends_on is null or memberships.ends_on>=p_session_date);
    select count(distinct attendance.student_id) into attendance_count from public.attendance attendance where attendance.school_id=target_school_id and attendance.session_id=target_session_id;
    if attendance_count <> roster_count then raise exception 'complete attendance is required for submission' using errcode = '23514'; end if;
    update public.sessions set status='SUBMITTED', submitted_at=now() where id=target_session_id and school_id=target_school_id;
  end if;
  return target_session_id;
end;
$$;

revoke all on function public.save_weekly_update(uuid,uuid,date,text,text,public.performance_level,jsonb,jsonb,boolean) from public;
grant execute on function public.save_weekly_update(uuid,uuid,date,text,text,public.performance_level,jsonb,jsonb,boolean) to authenticated;
