-- Allow all assigned Teachers to collaborate on an unclaimed Admin-requested
-- Teaching Update draft. The first successful submit still claims the report.
-- Keep the trigger's existing INSERT/admin and teacher-owned rules intact.
create or replace function public.validate_weekly_submission_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Keep historical direct weekly inserts compatible.
  if new.coverage_kind is null then
    new.coverage_kind := 'RANGE';
  end if;

  new.coverage_kind := upper(trim(new.coverage_kind));

  if new.period_start is null then
    new.period_start := new.week_start;
  end if;

  if new.period_end is null then
    new.period_end := new.week_start + 6;
  end if;

  if new.week_start is null then
    new.week_start := new.period_start;
  end if;

  if new.coverage_kind not in ('RANGE', 'DATES') then
    raise exception 'invalid Teaching Update coverage kind'
      using errcode = '23514';
  end if;

  if new.period_start is null
    or new.period_end is null
    or new.period_end < new.period_start
  then
    raise exception 'invalid Teaching Update coverage period'
      using errcode = '23514';
  end if;

  if new.version is null or new.version < 1 then
    new.version := 1;
  end if;

  if new.created_by_profile_id is null
    and auth.uid() is not null
  then
    new.created_by_profile_id := public.current_profile_id();
  end if;

  -- Leave composite FK errors authoritative for structurally invalid Groups.
  if new.subject_group_id is not null
    and not exists (
      select 1
      from public.subject_groups subject_group
      where subject_group.school_id = new.school_id
        and subject_group.class_subject_id = new.class_subject_id
        and subject_group.id = new.subject_group_id
    )
  then
    return new;
  end if;

  if new.teacher_id is null then
    if new.request_set_id is null then
      raise exception 'Teacher identity or Admin request is required'
        using errcode = '23514';
    end if;

    if auth.uid() is not null and not public.is_admin() then
      -- Teachers may save an existing, open, unclaimed Admin request but
      -- may neither create one nor change its identity or request ownership.
      if tg_op <> 'UPDATE' then
        raise exception 'administrator access required for unclaimed request'
          using errcode = '42501';
      end if;

      if old.status <> 'DRAFT'
        or new.status <> 'DRAFT'
        or old.teacher_id is not null
        or new.school_id is distinct from old.school_id
        or new.class_subject_id is distinct from old.class_subject_id
        or new.subject_group_id is distinct from old.subject_group_id
        or new.request_set_id is distinct from old.request_set_id
        or new.created_by_profile_id is distinct from old.created_by_profile_id
        or new.requested_by_profile_id is distinct from old.requested_by_profile_id
        or not exists (
          select 1
          from public.current_teacher_ids() as authorized_teacher(teacher_id)
          where public.teacher_can_teach_period_context(
            authorized_teacher.teacher_id,
            old.class_subject_id,
            old.subject_group_id,
            old.period_start,
            old.period_end
          )
          and public.teacher_can_teach_period_context(
            authorized_teacher.teacher_id,
            new.class_subject_id,
            new.subject_group_id,
            new.period_start,
            new.period_end
          )
        )
      then
        raise exception 'administrator access required for unclaimed request'
          using errcode = '42501';
      end if;
    end if;

    return new;
  end if;

  if not public.teacher_can_teach_period_context(
    new.teacher_id,
    new.class_subject_id,
    new.subject_group_id,
    new.period_start,
    new.period_end
  ) then
    raise exception 'teacher is not assigned to this teaching context'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Preserve the existing trigger, RLS policies and EXECUTE privileges.
-- In particular, shared requests remain unclaimed until submit_teaching_update.
