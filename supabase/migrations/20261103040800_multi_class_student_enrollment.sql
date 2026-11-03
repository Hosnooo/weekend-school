-- Permit concurrent enrollments in different Classes, but never overlapping
-- enrollment periods for the same student in the same Class.
alter table public.class_enrollments
  drop constraint class_enrollments_one_active_class_per_student;

alter table public.class_enrollments
  add constraint class_enrollments_no_overlap_in_same_class
  exclude using gist (
    school_id with =,
    student_id with =,
    class_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  );

-- Bulk Class-page enrollment is all-or-nothing. Reuse the existing, audited
-- enrollment RPC so its default Subject Group behavior remains consistent.
create function public.enroll_students_in_class(
  p_student_ids uuid[],
  p_target_class_id uuid,
  p_starts_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  student_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_student_ids is null or cardinality(p_student_ids) < 1 or cardinality(p_student_ids) > 100
     or exists (select 1 from unnest(p_student_ids) as requested(id) where requested.id is null)
     or (select count(*) from (select distinct id from unnest(p_student_ids) as requested(id)) distinct_ids)
        <> cardinality(p_student_ids) then
    raise exception 'select between 1 and 100 unique students' using errcode = '22023';
  end if;

  -- Stable lock order avoids batch deadlocks; any invalid student or overlapping
  -- enrollment aborts the entire transaction.
  for student_id in select id from unnest(p_student_ids) as requested(id) order by id
  loop
    perform public.enroll_student_in_class(student_id, p_target_class_id, p_starts_on);
  end loop;
end;
$$;

revoke all on function public.enroll_students_in_class(uuid[], uuid, date) from public;
revoke execute on function public.enroll_students_in_class(uuid[], uuid, date) from anon;
grant execute on function public.enroll_students_in_class(uuid[], uuid, date) to authenticated;

-- Removing one Class membership must never close the student's other Classes.
create function public.end_student_class_enrollment(
  p_student_id uuid,
  p_class_id uuid,
  p_ends_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  existing public.class_enrollments%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_ends_on is null then
    raise exception 'enrollment end date required' using errcode = '22023';
  end if;

  perform 1 from public.students s
  where s.school_id=target_school_id and s.id=p_student_id and s.is_active
  for update;
  if not found then
    raise exception 'student not found' using errcode = 'P0002';
  end if;

  select * into existing from public.class_enrollments ce
  where ce.school_id=target_school_id
    and ce.student_id=p_student_id
    and ce.class_id=p_class_id
    and ce.starts_on<=p_ends_on
    and (ce.ends_on is null or ce.ends_on>=p_ends_on)
  order by ce.starts_on desc
  limit 1
  for update;
  if existing.id is null then
    raise exception 'enrollment not found for this date' using errcode='P0002';
  end if;

  -- Protect already submitted teaching source history from retroactive
  -- removal. An admin must use the existing correction/revision workflow.
  if exists (
    select 1 from public.weekly_submissions ws
    join public.class_subjects cs on cs.school_id=ws.school_id
      and cs.id=ws.class_subject_id
    join public.weekly_submission_students wss on wss.school_id=ws.school_id
      and wss.submission_id=ws.id and wss.student_id=p_student_id
    where ws.school_id=target_school_id and cs.class_id=p_class_id
      and ws.status='SUBMITTED' and ws.period_end > p_ends_on
  ) then
    raise exception 'submitted teaching history requires this enrollment'
      using errcode='55000';
  end if;

  update public.class_enrollments ce
    set ends_on=p_ends_on
    where ce.id=existing.id and ce.school_id=target_school_id;

  update public.subject_group_memberships sgm
    set ends_on=p_ends_on
    where sgm.school_id=target_school_id and sgm.student_id=p_student_id
      and sgm.ends_on is null and sgm.starts_on<=p_ends_on
      and exists (select 1 from public.class_subjects cs
        where cs.school_id=target_school_id and cs.id=sgm.class_subject_id
          and cs.class_id=p_class_id);
  delete from public.subject_group_memberships sgm
    where sgm.school_id=target_school_id and sgm.student_id=p_student_id
      and sgm.ends_on is null and sgm.starts_on>p_ends_on
      and exists (select 1 from public.class_subjects cs
        where cs.school_id=target_school_id and cs.id=sgm.class_subject_id
          and cs.class_id=p_class_id);

  update public.subject_exclusions se
    set ends_on=p_ends_on
    where se.school_id=target_school_id and se.student_id=p_student_id
      and se.ends_on is null and se.starts_on<=p_ends_on
      and exists (select 1 from public.class_subjects cs
        where cs.school_id=target_school_id and cs.id=se.class_subject_id
          and cs.class_id=p_class_id);
  delete from public.subject_exclusions se
    where se.school_id=target_school_id and se.student_id=p_student_id
      and se.ends_on is null and se.starts_on>p_ends_on
      and exists (select 1 from public.class_subjects cs
        where cs.school_id=target_school_id and cs.id=se.class_subject_id
          and cs.class_id=p_class_id);
end;
$$;
revoke all on function public.end_student_class_enrollment(uuid,uuid,date) from public;
revoke execute on function public.end_student_class_enrollment(uuid,uuid,date) from anon;
grant execute on function public.end_student_class_enrollment(uuid,uuid,date) to authenticated;

-- Old RPCs lack a Class identifier. Keep them for one-Class histories, but
-- reject ambiguous multi-Class calls rather than silently modifying whichever
-- Class happens to sort first.
alter function public.change_student_class(uuid,uuid,date)
  rename to change_student_class_single_class_legacy;

create function public.change_student_class(
  p_student_id uuid, p_target_class_id uuid, p_starts_on date
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_school_id() is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode='42501';
  end if;
  if (select count(*) from public.class_enrollments
      where school_id=public.current_school_id()
        and student_id=p_student_id and ends_on is null) > 1 then
    raise exception 'use Class-specific enrollment operations for multi-Class students'
      using errcode='22023';
  end if;
  perform public.change_student_class_single_class_legacy(p_student_id,p_target_class_id,p_starts_on);
end;
$$;
revoke all on function public.change_student_class(uuid,uuid,date) from public;
revoke execute on function public.change_student_class(uuid,uuid,date) from anon;
grant execute on function public.change_student_class(uuid,uuid,date) to authenticated;

revoke all on function public.change_student_class_single_class_legacy(uuid,uuid,date) from public;
revoke execute on function public.change_student_class_single_class_legacy(uuid,uuid,date) from anon;
revoke execute on function public.change_student_class_single_class_legacy(uuid,uuid,date) from authenticated;

alter function public.update_student_enrollment_start(uuid,date)
  rename to update_student_enrollment_start_single_class_legacy;

create function public.update_student_enrollment_start(
  p_student_id uuid, p_starts_on date
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_school_id() is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode='42501';
  end if;
  if (select count(*) from public.class_enrollments
      where school_id=public.current_school_id()
        and student_id=p_student_id and ends_on is null) > 1 then
    raise exception 'select a specific Class to edit a multi-Class enrollment'
      using errcode='22023';
  end if;
  perform public.update_student_enrollment_start_single_class_legacy(p_student_id,p_starts_on);
end;
$$;
revoke all on function public.update_student_enrollment_start(uuid,date) from public;
revoke execute on function public.update_student_enrollment_start(uuid,date) from anon;
grant execute on function public.update_student_enrollment_start(uuid,date) to authenticated;

revoke all on function public.update_student_enrollment_start_single_class_legacy(uuid,date) from public;
revoke execute on function public.update_student_enrollment_start_single_class_legacy(uuid,date) from anon;
revoke execute on function public.update_student_enrollment_start_single_class_legacy(uuid,date) from authenticated;
