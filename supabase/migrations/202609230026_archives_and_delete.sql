-- Archive/restore and explicit permanent deletion for school-owned records.
-- Permanent deletion is deliberately explicit and school-scoped; history is removed
-- only after impact review and exact confirmation.

create or replace function public.protect_submitted_weekly_submission_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid;
  target_submission_id uuid;
  target_student_id uuid;
  target_status public.session_status;
begin
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;
  target_submission_id := case when tg_op = 'DELETE' then old.submission_id else new.submission_id end;
  target_student_id := case when tg_op = 'DELETE' then old.student_id else new.student_id end;

  if tg_op = 'DELETE'
    and current_setting('app.permanent_delete_student_id', true) = target_student_id::text
  then
    return old;
  end if;

  select ws.status into target_status
  from public.weekly_submissions ws
  where ws.school_id = target_school_id
    and ws.id = target_submission_id;

  if target_status = 'SUBMITTED' then
    raise exception 'submitted weekly submission students are immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.protect_submitted_weekly_submission_student() from public;
revoke execute on function public.protect_submitted_weekly_submission_student() from anon;
revoke execute on function public.protect_submitted_weekly_submission_student() from authenticated;

create function public.archive_entity(
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  affected integer;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if upper(trim(p_entity_type)) <> 'STUDENT' then
    raise exception 'unsupported archive entity type' using errcode = '22023';
  end if;

  update public.students
  set is_active = false
  where school_id = target_school_id
    and id = p_entity_id;
  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'archive target not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.restore_entity(
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  affected integer;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if upper(trim(p_entity_type)) <> 'STUDENT' then
    raise exception 'unsupported archive entity type' using errcode = '22023';
  end if;

  update public.students
  set is_active = true
  where school_id = target_school_id
    and id = p_entity_id;
  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'restore target not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.get_delete_impact(
  p_entity_type text,
  p_entity_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_student public.students%rowtype;
  memberships_count bigint;
  attendance_observations_count bigint;
  attendance_resolutions_count bigint;
  comments_count bigint;
  reports_count bigint;
  deliveries_count bigint;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if upper(trim(p_entity_type)) <> 'STUDENT' then
    raise exception 'unsupported delete-impact entity type' using errcode = '22023';
  end if;

  select * into target_student
  from public.students
  where school_id = target_school_id
    and id = p_entity_id;

  if not found then
    raise exception 'delete target not found' using errcode = 'P0002';
  end if;

  select
    (select count(*) from public.group_memberships where school_id = target_school_id and student_id = p_entity_id)
    + (select count(*) from public.class_enrollments where school_id = target_school_id and student_id = p_entity_id)
    + (select count(*) from public.subject_exclusions where school_id = target_school_id and student_id = p_entity_id)
    + (select count(*) from public.subject_group_memberships where school_id = target_school_id and student_id = p_entity_id)
  into memberships_count;

  select
    (select count(*) from public.attendance where school_id = target_school_id and student_id = p_entity_id)
    + (select count(*) from public.weekly_submission_students where school_id = target_school_id and student_id = p_entity_id)
  into attendance_observations_count;

  select count(*) into attendance_resolutions_count
  from public.attendance_resolutions
  where school_id = target_school_id and student_id = p_entity_id;

  select
    (select count(*) from public.student_progress
      where school_id = target_school_id and student_id = p_entity_id
        and (comment_en is not null or comment_ar is not null))
    + (select count(*) from public.weekly_submission_students
      where school_id = target_school_id and student_id = p_entity_id
        and (comment_en is not null or comment_ar is not null))
    + (select count(*) from public.report_student_overrides
      where school_id = target_school_id and student_id = p_entity_id
        and (comment_en is not null or comment_ar is not null))
  into comments_count;

  select count(*) into reports_count
  from public.reports
  where school_id = target_school_id and student_id = p_entity_id;

  select count(*) into deliveries_count
  from public.email_deliveries
  where school_id = target_school_id and student_id = p_entity_id;

  return jsonb_build_object(
    'entityType', 'STUDENT',
    'entityId', p_entity_id,
    'isArchived', not target_student.is_active,
    'counts', jsonb_build_object(
      'memberships', memberships_count,
      'attendanceObservations', attendance_observations_count,
      'attendanceResolutions', attendance_resolutions_count,
      'comments', comments_count,
      'reports', reports_count,
      'emailDeliveries', deliveries_count
    )
  );
end;
$$;

create function public.permanently_delete_archived_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_student public.students%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if upper(trim(p_entity_type)) <> 'STUDENT' then
    raise exception 'unsupported permanent-delete entity type' using errcode = '22023';
  end if;

  select * into target_student
  from public.students
  where school_id = target_school_id
    and id = p_entity_id
  for update;

  if not found then
    raise exception 'delete target not found' using errcode = 'P0002';
  end if;

  if target_student.is_active then
    raise exception 'target must be archived before permanent deletion' using errcode = '23514';
  end if;

  if p_confirmation is distinct from ('DELETE ' || p_entity_id::text) then
    raise exception 'permanent deletion confirmation does not match' using errcode = '22023';
  end if;

  perform set_config('app.permanent_delete_student_id', p_entity_id::text, true);

  delete from public.email_deliveries
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.reports
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.report_student_overrides
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.attendance_resolutions
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.weekly_submission_students
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.attendance
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.student_progress
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.subject_group_memberships
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.subject_exclusions
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.class_enrollments
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.group_memberships
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.student_guardians
  where school_id = target_school_id and student_id = p_entity_id;

  delete from public.students
  where school_id = target_school_id and id = p_entity_id;
end;
$$;

revoke all on function public.archive_entity(text, uuid) from public;
revoke all on function public.restore_entity(text, uuid) from public;
revoke all on function public.get_delete_impact(text, uuid) from public;
revoke all on function public.permanently_delete_archived_entity(text, uuid, text) from public;

revoke execute on function public.archive_entity(text, uuid) from anon;
revoke execute on function public.restore_entity(text, uuid) from anon;
revoke execute on function public.get_delete_impact(text, uuid) from anon;
revoke execute on function public.permanently_delete_archived_entity(text, uuid, text) from anon;

grant execute on function public.archive_entity(text, uuid) to authenticated;
grant execute on function public.restore_entity(text, uuid) to authenticated;
grant execute on function public.get_delete_impact(text, uuid) to authenticated;
grant execute on function public.permanently_delete_archived_entity(text, uuid, text) to authenticated;
