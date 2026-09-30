-- Correct an active enrollment start date together with its immediately
-- preceding Class boundary. This supports fixing a transfer date without
-- creating overlapping enrollment history.

create or replace function public.update_student_enrollment_start(
  p_student_id uuid,
  p_starts_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  current_enrollment public.class_enrollments%rowtype;
  previous_enrollment public.class_enrollments%rowtype;
  old_starts_on date;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_starts_on is null then
    raise exception 'enrollment start date is required' using errcode = '22023';
  end if;

  perform 1
  from public.students s
  where s.school_id = target_school_id
    and s.id = p_student_id
    and s.is_active
  for update;

  if not found then
    raise exception 'active student not found' using errcode = '23503';
  end if;

  select ce.*
    into current_enrollment
  from public.class_enrollments ce
  where ce.school_id = target_school_id
    and ce.student_id = p_student_id
    and ce.ends_on is null
  order by ce.starts_on desc
  limit 1
  for update;

  if current_enrollment.id is null then
    raise exception 'active class enrollment not found' using errcode = 'P0002';
  end if;

  old_starts_on := current_enrollment.starts_on;

  if p_starts_on = old_starts_on then
    return;
  end if;

  if p_starts_on < old_starts_on then
    select ce.*
      into previous_enrollment
    from public.class_enrollments ce
    where ce.school_id = target_school_id
      and ce.student_id = p_student_id
      and ce.id <> current_enrollment.id
      and ce.ends_on is not null
      and ce.ends_on >= p_starts_on
      and ce.starts_on < old_starts_on
    order by ce.ends_on desc, ce.starts_on desc
    limit 1
    for update;

    if previous_enrollment.id is not null then
      if p_starts_on < previous_enrollment.starts_on then
        raise exception 'enrollment start date precedes prior class history'
          using errcode = '22023';
      end if;

      if exists (
        select 1
        from public.class_enrollments ce
        where ce.school_id = target_school_id
          and ce.student_id = p_student_id
          and ce.id not in (current_enrollment.id, previous_enrollment.id)
          and ce.ends_on is not null
          and ce.ends_on >= p_starts_on
      ) then
        raise exception 'enrollment start date overlaps older class history'
          using errcode = '22023';
      end if;

      update public.subject_group_memberships sgm
      set ends_on = p_starts_on - 1
      where sgm.school_id = target_school_id
        and sgm.student_id = p_student_id
        and sgm.starts_on < p_starts_on
        and (sgm.ends_on is null or sgm.ends_on >= p_starts_on)
        and exists (
          select 1
          from public.class_subjects cs
          where cs.school_id = target_school_id
            and cs.id = sgm.class_subject_id
            and cs.class_id = previous_enrollment.class_id
        );

      delete from public.subject_group_memberships sgm
      where sgm.school_id = target_school_id
        and sgm.student_id = p_student_id
        and sgm.starts_on >= p_starts_on
        and sgm.starts_on <= previous_enrollment.ends_on
        and exists (
          select 1
          from public.class_subjects cs
          where cs.school_id = target_school_id
            and cs.id = sgm.class_subject_id
            and cs.class_id = previous_enrollment.class_id
        );

      update public.subject_exclusions se
      set ends_on = p_starts_on - 1
      where se.school_id = target_school_id
        and se.student_id = p_student_id
        and se.starts_on < p_starts_on
        and (se.ends_on is null or se.ends_on >= p_starts_on)
        and exists (
          select 1
          from public.class_subjects cs
          where cs.school_id = target_school_id
            and cs.id = se.class_subject_id
            and cs.class_id = previous_enrollment.class_id
        );

      delete from public.subject_exclusions se
      where se.school_id = target_school_id
        and se.student_id = p_student_id
        and se.starts_on >= p_starts_on
        and se.starts_on <= previous_enrollment.ends_on
        and exists (
          select 1
          from public.class_subjects cs
          where cs.school_id = target_school_id
            and cs.id = se.class_subject_id
            and cs.class_id = previous_enrollment.class_id
        );

      if p_starts_on = previous_enrollment.starts_on then
        delete from public.class_enrollments ce
        where ce.school_id = target_school_id
          and ce.id = previous_enrollment.id;
      else
        update public.class_enrollments ce
        set ends_on = p_starts_on - 1
        where ce.school_id = target_school_id
          and ce.id = previous_enrollment.id;
      end if;
    end if;
  else
    if exists (
      select 1
      from public.subject_group_memberships sgm
      join public.class_subjects cs
        on cs.school_id = sgm.school_id
       and cs.id = sgm.class_subject_id
      where sgm.school_id = target_school_id
        and sgm.student_id = p_student_id
        and cs.class_id = current_enrollment.class_id
        and (
          (sgm.starts_on > old_starts_on and sgm.starts_on < p_starts_on)
          or (
            sgm.starts_on = old_starts_on
            and sgm.ends_on is not null
            and sgm.ends_on < p_starts_on
          )
        )
    ) then
      raise exception 'enrollment start date would follow existing group history'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.subject_exclusions se
      join public.class_subjects cs
        on cs.school_id = se.school_id
       and cs.id = se.class_subject_id
      where se.school_id = target_school_id
        and se.student_id = p_student_id
        and cs.class_id = current_enrollment.class_id
        and (
          (se.starts_on > old_starts_on and se.starts_on < p_starts_on)
          or (
            se.starts_on = old_starts_on
            and se.ends_on is not null
            and se.ends_on < p_starts_on
          )
        )
    ) then
      raise exception 'enrollment start date would follow existing subject history'
        using errcode = '22023';
    end if;
  end if;

  update public.class_enrollments ce
  set starts_on = p_starts_on
  where ce.school_id = target_school_id
    and ce.id = current_enrollment.id;

  update public.subject_group_memberships sgm
  set starts_on = p_starts_on
  where sgm.school_id = target_school_id
    and sgm.student_id = p_student_id
    and sgm.starts_on = old_starts_on
    and exists (
      select 1
      from public.class_subjects cs
      where cs.school_id = target_school_id
        and cs.id = sgm.class_subject_id
        and cs.class_id = current_enrollment.class_id
    );

  update public.subject_exclusions se
  set starts_on = p_starts_on
  where se.school_id = target_school_id
    and se.student_id = p_student_id
    and se.starts_on = old_starts_on
    and exists (
      select 1
      from public.class_subjects cs
      where cs.school_id = target_school_id
        and cs.id = se.class_subject_id
        and cs.class_id = current_enrollment.class_id
    );
end;
$$;

revoke all on function public.update_student_enrollment_start(uuid, date) from public;
revoke execute on function public.update_student_enrollment_start(uuid, date) from anon;
grant execute on function public.update_student_enrollment_start(uuid, date) to authenticated;
