-- Guardian identity and relationship lifecycle integrity.
-- Forward-only migration; previously applied migrations remain immutable.

create function public.link_existing_student_guardian(
  p_student_id uuid,
  p_guardian_id uuid,
  p_is_primary boolean,
  p_receives_reports boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  first_link boolean;
  requested_primary boolean := coalesce(p_is_primary, false);
  requested_reports boolean := coalesce(p_receives_reports, true);
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  -- Lock the Student so first-Guardian / Primary decisions for this
  -- Student are serialized.
  perform 1
  from public.students student
  where student.school_id = target_school_id
    and student.id = p_student_id
    and student.is_active
  for update;

  if not found then
    raise exception 'active student not found'
      using errcode = '23503';
  end if;

  -- Guardian identity is explicit by ID. The Guardian must belong to
  -- the Administrator's school, but may currently be archived.
  perform 1
  from public.guardians guardian
  where guardian.school_id = target_school_id
    and guardian.id = p_guardian_id
  for update;

  if not found then
    raise exception 'guardian not found'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.student_guardians student_guardian
    where student_guardian.school_id = target_school_id
      and student_guardian.student_id = p_student_id
      and student_guardian.guardian_id = p_guardian_id
  ) then
    raise exception 'guardian already linked to student'
      using errcode = '23505';
  end if;

  -- Explicitly linking an archived Guardian restores that identity
  -- rather than creating a replacement record.
  update public.guardians guardian
  set is_active = true
  where guardian.school_id = target_school_id
    and guardian.id = p_guardian_id
    and not guardian.is_active;

  select not exists (
    select 1
    from public.student_guardians student_guardian
    where student_guardian.school_id = target_school_id
      and student_guardian.student_id = p_student_id
  )
  into first_link;

  if first_link then
    requested_primary := true;
    requested_reports := true;
  end if;

  if requested_primary then
    update public.student_guardians student_guardian
    set is_primary = false
    where student_guardian.school_id = target_school_id
      and student_guardian.student_id = p_student_id
      and student_guardian.is_primary;
  end if;

  insert into public.student_guardians (
    school_id,
    student_id,
    guardian_id,
    receives_reports,
    is_primary
  ) values (
    target_school_id,
    p_student_id,
    p_guardian_id,
    requested_reports,
    requested_primary
  );

  return p_guardian_id;
end;
$$;


create or replace function public.unlink_student_guardian(
  p_student_id uuid,
  p_guardian_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  -- Serialize lifecycle changes for this Guardian with explicit links.
  perform 1
  from public.guardians guardian
  where guardian.school_id = target_school_id
    and guardian.id = p_guardian_id
  for update;

  if not found then
    raise exception 'guardian link not found'
      using errcode = 'P0002';
  end if;

  delete from public.student_guardians student_guardian
  where student_guardian.school_id = target_school_id
    and student_guardian.student_id = p_student_id
    and student_guardian.guardian_id = p_guardian_id;

  if not found then
    raise exception 'guardian link not found'
      using errcode = 'P0002';
  end if;

  -- Relationship removal is Student-specific. The Guardian remains
  -- active while any Student relationship still exists.
  if not exists (
    select 1
    from public.student_guardians student_guardian
    where student_guardian.school_id = target_school_id
      and student_guardian.guardian_id = p_guardian_id
  ) then
    update public.guardians guardian
    set is_active = false
    where guardian.school_id = target_school_id
      and guardian.id = p_guardian_id;
  end if;
end;
$$;


create or replace function public.get_delete_impact(
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
  entity_type text := upper(trim(p_entity_type));
  archived boolean;
  dependency_count bigint := 0;
  dependency_details jsonb := '{}'::jsonb;
  memberships_count bigint := 0;
  attendance_observations_count bigint := 0;
  attendance_resolutions_count bigint := 0;
  comments_count bigint := 0;
  reports_count bigint := 0;
  deliveries_count bigint := 0;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  case entity_type
    when 'STUDENT' then
      select not student.is_active
      into archived
      from public.students student
      where student.school_id = target_school_id
        and student.id = p_entity_id;

      if not found then
        raise exception 'delete target not found'
          using errcode = 'P0002';
      end if;

      select
        (
          select count(*)
          from public.group_memberships
          where school_id = target_school_id
            and student_id = p_entity_id
        )
        + (
          select count(*)
          from public.class_enrollments
          where school_id = target_school_id
            and student_id = p_entity_id
        )
        + (
          select count(*)
          from public.subject_exclusions
          where school_id = target_school_id
            and student_id = p_entity_id
        )
        + (
          select count(*)
          from public.subject_group_memberships
          where school_id = target_school_id
            and student_id = p_entity_id
        )
      into memberships_count;

      select
        (
          select count(*)
          from public.attendance
          where school_id = target_school_id
            and student_id = p_entity_id
        )
        + (
          select count(*)
          from public.weekly_submission_students
          where school_id = target_school_id
            and student_id = p_entity_id
        )
      into attendance_observations_count;

      select count(*)
      into attendance_resolutions_count
      from public.attendance_resolutions
      where school_id = target_school_id
        and student_id = p_entity_id;

      select
        (
          select count(*)
          from public.student_progress
          where school_id = target_school_id
            and student_id = p_entity_id
            and (comment_en is not null or comment_ar is not null)
        )
        + (
          select count(*)
          from public.weekly_submission_students
          where school_id = target_school_id
            and student_id = p_entity_id
            and (comment_en is not null or comment_ar is not null)
        )
        + (
          select count(*)
          from public.report_student_overrides
          where school_id = target_school_id
            and student_id = p_entity_id
            and (comment_en is not null or comment_ar is not null)
        )
      into comments_count;

      select count(*)
      into reports_count
      from public.reports
      where school_id = target_school_id
        and student_id = p_entity_id;

      select count(*)
      into deliveries_count
      from public.email_deliveries
      where school_id = target_school_id
        and student_id = p_entity_id;

      dependency_count :=
        memberships_count
        + attendance_observations_count
        + attendance_resolutions_count
        + comments_count
        + reports_count
        + deliveries_count;

      return jsonb_build_object(
        'entityType', entity_type,
        'entityId', p_entity_id,
        'isArchived', archived,
        'canPermanentlyDelete', archived,
        'dependencyCount', dependency_count,
        'counts', jsonb_build_object(
          'memberships', memberships_count,
          'attendanceObservations', attendance_observations_count,
          'attendanceResolutions', attendance_resolutions_count,
          'comments', comments_count,
          'reports', reports_count,
          'emailDeliveries', deliveries_count
        )
      );

    when 'TEACHER' then
      select not teacher.is_active
      into archived
      from public.teachers teacher
      where teacher.school_id = target_school_id
        and teacher.id = p_entity_id;

      if not found then
        raise exception 'delete target not found'
          using errcode = 'P0002';
      end if;

      dependency_details := jsonb_build_object(
        'accountLinks',
          (
            select count(*)
            from public.teacher_accounts
            where school_id = target_school_id
              and teacher_id = p_entity_id
          ),
        'teachingAssignments',
          (
            select count(*)
            from public.teaching_assignments
            where school_id = target_school_id
              and teacher_id = p_entity_id
          ),
        'groupAssignments',
          (
            select count(*)
            from public.group_teachers
            where school_id = target_school_id
              and teacher_id = p_entity_id
          ),
        'weeklySubmissions',
          (
            select count(*)
            from public.weekly_submissions
            where school_id = target_school_id
              and teacher_id = p_entity_id
          )
      );

    when 'GUARDIAN' then
      select not guardian.is_active
      into archived
      from public.guardians guardian
      where guardian.school_id = target_school_id
        and guardian.id = p_entity_id;

      if not found then
        raise exception 'delete target not found'
          using errcode = 'P0002';
      end if;

      dependency_details := jsonb_build_object(
        'studentLinks',
          (
            select count(*)
            from public.student_guardians
            where school_id = target_school_id
              and guardian_id = p_entity_id
          ),
        'emailDeliveries',
          (
            select count(*)
            from public.email_deliveries
            where school_id = target_school_id
              and guardian_id = p_entity_id
          )
      );

    when 'CLASS' then
      select not class_row.is_active
      into archived
      from public.classes class_row
      where class_row.school_id = target_school_id
        and class_row.id = p_entity_id;

      if not found then
        raise exception 'delete target not found'
          using errcode = 'P0002';
      end if;

      dependency_details := jsonb_build_object(
        'classSubjects',
          (
            select count(*)
            from public.class_subjects
            where school_id = target_school_id
              and class_id = p_entity_id
          ),
        'enrollments',
          (
            select count(*)
            from public.class_enrollments
            where school_id = target_school_id
              and class_id = p_entity_id
          )
      );

    when 'SUBJECT' then
      select not subject.is_active
      into archived
      from public.subjects subject
      where subject.school_id = target_school_id
        and subject.id = p_entity_id;

      if not found then
        raise exception 'delete target not found'
          using errcode = 'P0002';
      end if;

      dependency_details := jsonb_build_object(
        'classSubjects',
          (
            select count(*)
            from public.class_subjects
            where school_id = target_school_id
              and subject_id = p_entity_id
          )
      );

    when 'GROUP' then
      select not subject_group.is_active
      into archived
      from public.subject_groups subject_group
      where subject_group.school_id = target_school_id
        and subject_group.id = p_entity_id;

      if not found then
        raise exception 'delete target not found'
          using errcode = 'P0002';
      end if;

      dependency_details := jsonb_build_object(
        'memberships',
          (
            select count(*)
            from public.subject_group_memberships
            where school_id = target_school_id
              and subject_group_id = p_entity_id
          ),
        'teachingAssignments',
          (
            select count(*)
            from public.teaching_assignments
            where school_id = target_school_id
              and subject_group_id = p_entity_id
          ),
        'weeklySubmissions',
          (
            select count(*)
            from public.weekly_submissions
            where school_id = target_school_id
              and subject_group_id = p_entity_id
          ),
        'defaultUse',
          (
            select count(*)
            from public.class_subjects
            where school_id = target_school_id
              and default_group_id = p_entity_id
          )
      );

    else
      raise exception 'unsupported delete-impact entity type'
        using errcode = '22023';
  end case;

  select coalesce(sum((value)::text::bigint), 0)
  into dependency_count
  from jsonb_each(dependency_details);

  return jsonb_build_object(
    'entityType', entity_type,
    'entityId', p_entity_id,
    'isArchived', archived,
    'canPermanentlyDelete', archived and dependency_count = 0,
    'dependencyCount', dependency_count,
    'dependencies', dependency_details
  );
end;
$$;


revoke all on function public.link_existing_student_guardian(
  uuid, uuid, boolean, boolean
) from public;
revoke execute on function public.link_existing_student_guardian(
  uuid, uuid, boolean, boolean
) from anon;
grant execute on function public.link_existing_student_guardian(
  uuid, uuid, boolean, boolean
) to authenticated;

revoke all on function public.unlink_student_guardian(uuid, uuid) from public;
revoke execute on function public.unlink_student_guardian(uuid, uuid) from anon;
grant execute on function public.unlink_student_guardian(uuid, uuid)
  to authenticated;

revoke all on function public.get_delete_impact(text, uuid) from public;
revoke execute on function public.get_delete_impact(text, uuid) from anon;
grant execute on function public.get_delete_impact(text, uuid)
  to authenticated;
