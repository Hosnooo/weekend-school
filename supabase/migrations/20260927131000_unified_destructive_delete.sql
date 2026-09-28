-- Unified archive lifecycle:
-- Archive preserves data.
-- Permanent delete removes the archived record and data structurally owned by it.
-- Independent parent/person records are preserved.

create or replace function public.protect_submitted_weekly_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'SUBMITTED' then
    -- Explicit permanent deletion may remove submitted history,
    -- but only inside the confirmed Administrator transaction.
    if tg_op = 'DELETE'
      and current_setting(
        'app.permanent_delete_managed_entity',
        true
      ) = 'on'
      and public.is_admin()
    then
      return old;
    end if;

    -- Preserve the approved Teacher correction workflow:
    -- submitted work may return to Draft only through
    -- reopen_weekly_submission().
    if tg_op = 'UPDATE'
      and new.status = 'DRAFT'
      and new.submitted_at is null
      and coalesce(
        current_setting(
          'app.reopening_weekly_submission',
          true
        ),
        ''
      ) = 'on'
    then
      return new;
    end if;

    raise exception
      'submitted weekly submissions are immutable';
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

revoke all
on function public.protect_submitted_weekly_submission()
from public;

revoke execute
on function public.protect_submitted_weekly_submission()
from anon, authenticated;

create or replace function
public.protect_submitted_weekly_submission_student()
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
  target_school_id :=
    case when tg_op = 'DELETE'
      then old.school_id else new.school_id
    end;

  target_submission_id :=
    case when tg_op = 'DELETE'
      then old.submission_id else new.submission_id
    end;

  target_student_id :=
    case when tg_op = 'DELETE'
      then old.student_id else new.student_id
    end;

  if tg_op = 'DELETE'
    and (
      current_setting(
        'app.permanent_delete_managed_entity',
        true
      ) = 'on'
      or current_setting(
        'app.permanent_delete_student_id',
        true
      ) = target_student_id::text
    )
    and public.is_admin()
  then
    return old;
  end if;

  select submission.status
  into target_status
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = target_submission_id;

  if target_status = 'SUBMITTED' then
    raise exception
      'submitted weekly submission students are immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all
on function public.protect_submitted_weekly_submission_student()
from public;

revoke execute
on function public.protect_submitted_weekly_submission_student()
from anon, authenticated;


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

  target_class_subject_ids uuid[] := '{}'::uuid[];
  target_group_ids uuid[] := '{}'::uuid[];
  target_batch_ids uuid[] := '{}'::uuid[];

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
        +
        (
          select count(*)
          from public.class_enrollments
          where school_id = target_school_id
            and student_id = p_entity_id
        )
        +
        (
          select count(*)
          from public.subject_exclusions
          where school_id = target_school_id
            and student_id = p_entity_id
        )
        +
        (
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
        +
        (
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
            and (
              comment_en is not null
              or comment_ar is not null
            )
        )
        +
        (
          select count(*)
          from public.weekly_submission_students
          where school_id = target_school_id
            and student_id = p_entity_id
            and (
              comment_en is not null
              or comment_ar is not null
            )
        )
        +
        (
          select count(*)
          from public.report_student_overrides
          where school_id = target_school_id
            and student_id = p_entity_id
            and (
              comment_en is not null
              or comment_ar is not null
            )
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
          'attendanceObservations',
            attendance_observations_count,
          'attendanceResolutions',
            attendance_resolutions_count,
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

      select coalesce(array_agg(class_subject.id), '{}'::uuid[])
      into target_class_subject_ids
      from public.class_subjects class_subject
      where class_subject.school_id = target_school_id
        and class_subject.class_id = p_entity_id;

      select coalesce(array_agg(subject_group.id), '{}'::uuid[])
      into target_group_ids
      from public.subject_groups subject_group
      where subject_group.school_id = target_school_id
        and subject_group.class_subject_id =
          any(target_class_subject_ids);

      select coalesce(array_agg(batch.id), '{}'::uuid[])
      into target_batch_ids
      from public.report_batches batch
      where batch.school_id = target_school_id
        and batch.class_id = p_entity_id;

      dependency_details := jsonb_build_object(
        'classSubjects',
          cardinality(target_class_subject_ids),
        'groups',
          cardinality(target_group_ids),
        'enrollments',
          (
            select count(*)
            from public.class_enrollments
            where school_id = target_school_id
              and class_id = p_entity_id
          ),
        'memberships',
          (
            select count(*)
            from public.subject_group_memberships
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'teachingAssignments',
          (
            select count(*)
            from public.teaching_assignments
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'weeklySubmissions',
          (
            select count(*)
            from public.weekly_submissions
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'attendanceResolutions',
          (
            select count(*)
            from public.attendance_resolutions
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'reportBatches',
          cardinality(target_batch_ids),
        'reports',
          (
            select count(*)
            from public.reports
            where school_id = target_school_id
              and batch_id = any(target_batch_ids)
          ),
        'emailDeliveries',
          (
            select count(*)
            from public.email_deliveries delivery
            where delivery.school_id = target_school_id
              and exists (
                select 1
                from public.reports report
                where report.school_id = delivery.school_id
                  and report.id = delivery.report_id
                  and report.batch_id =
                    any(target_batch_ids)
              )
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

      select coalesce(array_agg(class_subject.id), '{}'::uuid[])
      into target_class_subject_ids
      from public.class_subjects class_subject
      where class_subject.school_id = target_school_id
        and class_subject.subject_id = p_entity_id;

      select coalesce(array_agg(subject_group.id), '{}'::uuid[])
      into target_group_ids
      from public.subject_groups subject_group
      where subject_group.school_id = target_school_id
        and subject_group.class_subject_id =
          any(target_class_subject_ids);

      select coalesce(array_agg(batch.id), '{}'::uuid[])
      into target_batch_ids
      from public.report_batches batch
      where batch.school_id = target_school_id
        and batch.class_subject_id =
          any(target_class_subject_ids);

      dependency_details := jsonb_build_object(
        'classSubjects',
          cardinality(target_class_subject_ids),
        'groups',
          cardinality(target_group_ids),
        'memberships',
          (
            select count(*)
            from public.subject_group_memberships
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'teachingAssignments',
          (
            select count(*)
            from public.teaching_assignments
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'weeklySubmissions',
          (
            select count(*)
            from public.weekly_submissions
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'attendanceResolutions',
          (
            select count(*)
            from public.attendance_resolutions
            where school_id = target_school_id
              and class_subject_id =
                any(target_class_subject_ids)
          ),
        'reportBatches',
          cardinality(target_batch_ids),
        'reports',
          (
            select count(*)
            from public.reports
            where school_id = target_school_id
              and batch_id = any(target_batch_ids)
          ),
        'emailDeliveries',
          (
            select count(*)
            from public.email_deliveries delivery
            where delivery.school_id = target_school_id
              and exists (
                select 1
                from public.reports report
                where report.school_id = delivery.school_id
                  and report.id = delivery.report_id
                  and report.batch_id =
                    any(target_batch_ids)
              )
          )
      );

    when 'GROUP' then
      select
        not subject_group.is_active,
        array[subject_group.class_subject_id]::uuid[]
      into archived, target_class_subject_ids
      from public.subject_groups subject_group
      where subject_group.school_id = target_school_id
        and subject_group.id = p_entity_id;

      if not found then
        raise exception 'delete target not found'
          using errcode = 'P0002';
      end if;

      target_group_ids := array[p_entity_id]::uuid[];

      select coalesce(array_agg(batch.id), '{}'::uuid[])
      into target_batch_ids
      from public.report_batches batch
      where batch.school_id = target_school_id
        and batch.subject_group_id = p_entity_id;

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
        'attendanceResolutions',
          (
            select count(*)
            from public.attendance_resolutions
            where school_id = target_school_id
              and subject_group_id = p_entity_id
          ),
        'reportBatches',
          cardinality(target_batch_ids),
        'reports',
          (
            select count(*)
            from public.reports
            where school_id = target_school_id
              and batch_id = any(target_batch_ids)
          ),
        'emailDeliveries',
          (
            select count(*)
            from public.email_deliveries delivery
            where delivery.school_id = target_school_id
              and exists (
                select 1
                from public.reports report
                where report.school_id = delivery.school_id
                  and report.id = delivery.report_id
                  and report.batch_id =
                    any(target_batch_ids)
              )
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

  select coalesce(sum(value::text::bigint), 0)
  into dependency_count
  from jsonb_each(dependency_details);

  return jsonb_build_object(
    'entityType', entity_type,
    'entityId', p_entity_id,
    'isArchived', archived,
    'canPermanentlyDelete', archived,
    'dependencyCount', dependency_count,
    'dependencies', dependency_details
  );
end;
$$;


create or replace function public.permanently_delete_archived_entity(
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
  entity_type text := upper(trim(p_entity_type));

  archived boolean;
  expected_confirmation text;

  target_class_subject_ids uuid[] := '{}'::uuid[];
  target_group_ids uuid[] := '{}'::uuid[];
  target_batch_ids uuid[] := '{}'::uuid[];
  target_submission_ids uuid[] := '{}'::uuid[];

  delete_class_subjects boolean := false;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  -- Lock and resolve the real human-readable confirmation value.
  case entity_type
    when 'STUDENT' then
      select
        not student.is_active,
        trim(
          student.first_name_en || ' ' ||
          student.last_name_en
        )
      into archived, expected_confirmation
      from public.students student
      where student.school_id = target_school_id
        and student.id = p_entity_id
      for update;

    when 'TEACHER' then
      select
        not teacher.is_active,
        teacher.display_name
      into archived, expected_confirmation
      from public.teachers teacher
      where teacher.school_id = target_school_id
        and teacher.id = p_entity_id
      for update;

    when 'GUARDIAN' then
      select
        not guardian.is_active,
        guardian.name
      into archived, expected_confirmation
      from public.guardians guardian
      where guardian.school_id = target_school_id
        and guardian.id = p_entity_id
      for update;

    when 'CLASS' then
      select
        not class_row.is_active,
        class_row.name_en
      into archived, expected_confirmation
      from public.classes class_row
      where class_row.school_id = target_school_id
        and class_row.id = p_entity_id
      for update;

    when 'SUBJECT' then
      select
        not subject.is_active,
        subject.name_en
      into archived, expected_confirmation
      from public.subjects subject
      where subject.school_id = target_school_id
        and subject.id = p_entity_id
      for update;

    when 'GROUP' then
      select
        not subject_group.is_active,
        subject_group.name_en
      into archived, expected_confirmation
      from public.subject_groups subject_group
      where subject_group.school_id = target_school_id
        and subject_group.id = p_entity_id
      for update;

    else
      raise exception 'unsupported permanent-delete entity type'
        using errcode = '22023';
  end case;

  if not found then
    raise exception 'delete target not found'
      using errcode = 'P0002';
  end if;

  if not archived then
    raise exception
      'target must be archived before permanent deletion'
      using errcode = '23514';
  end if;

  if p_confirmation is distinct from expected_confirmation then
    raise exception
      'permanent deletion confirmation does not match'
      using errcode = '22023';
  end if;

  -- Trigger bypass is local to this transaction and only honored
  -- while the authenticated actor is an Administrator.
  perform set_config(
    'app.permanent_delete_managed_entity',
    'on',
    true
  );

  -- Student keeps its existing full-history deletion semantics.
  if entity_type = 'STUDENT' then
    perform set_config(
      'app.permanent_delete_student_id',
      p_entity_id::text,
      true
    );

    delete from public.email_deliveries
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.reports
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.report_student_overrides
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.attendance_resolutions
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.weekly_submission_students
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.attendance
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.student_progress
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.subject_group_memberships
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.subject_exclusions
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.class_enrollments
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.group_memberships
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.student_guardians
    where school_id = target_school_id
      and student_id = p_entity_id;

    delete from public.students
    where school_id = target_school_id
      and id = p_entity_id;

    return;
  end if;

  -- Guardian owns its relationships/deliveries, not Students or Reports.
  if entity_type = 'GUARDIAN' then
    delete from public.email_deliveries
    where school_id = target_school_id
      and guardian_id = p_entity_id;

    delete from public.student_guardians
    where school_id = target_school_id
      and guardian_id = p_entity_id;

    delete from public.guardians
    where school_id = target_school_id
      and id = p_entity_id;

    return;
  end if;

  -- Teacher deletion removes teacher-authored working history and
  -- source links, while finalized Student reports remain snapshots.
  if entity_type = 'TEACHER' then
    select coalesce(array_agg(submission.id), '{}'::uuid[])
    into target_submission_ids
    from public.weekly_submissions submission
    where submission.school_id = target_school_id
      and submission.teacher_id = p_entity_id;

    delete from public.report_section_sources
    where school_id = target_school_id
      and weekly_submission_id =
        any(target_submission_ids);

    delete from public.weekly_submission_students
    where school_id = target_school_id
      and submission_id =
        any(target_submission_ids);

    delete from public.weekly_submissions
    where school_id = target_school_id
      and id = any(target_submission_ids);

    delete from public.teaching_assignments
    where school_id = target_school_id
      and teacher_id = p_entity_id;

    delete from public.group_teachers
    where school_id = target_school_id
      and teacher_id = p_entity_id;

    delete from public.teacher_accounts
    where school_id = target_school_id
      and teacher_id = p_entity_id;

    delete from public.teachers
    where school_id = target_school_id
      and id = p_entity_id;

    return;
  end if;

  -- Resolve the context tree for Class / Subject / Group.
  if entity_type = 'CLASS' then
    delete_class_subjects := true;

    select coalesce(array_agg(class_subject.id), '{}'::uuid[])
    into target_class_subject_ids
    from public.class_subjects class_subject
    where class_subject.school_id = target_school_id
      and class_subject.class_id = p_entity_id;

    select coalesce(array_agg(subject_group.id), '{}'::uuid[])
    into target_group_ids
    from public.subject_groups subject_group
    where subject_group.school_id = target_school_id
      and subject_group.class_subject_id =
        any(target_class_subject_ids);

    select coalesce(array_agg(batch.id), '{}'::uuid[])
    into target_batch_ids
    from public.report_batches batch
    where batch.school_id = target_school_id
      and batch.class_id = p_entity_id;

  elsif entity_type = 'SUBJECT' then
    delete_class_subjects := true;

    select coalesce(array_agg(class_subject.id), '{}'::uuid[])
    into target_class_subject_ids
    from public.class_subjects class_subject
    where class_subject.school_id = target_school_id
      and class_subject.subject_id = p_entity_id;

    select coalesce(array_agg(subject_group.id), '{}'::uuid[])
    into target_group_ids
    from public.subject_groups subject_group
    where subject_group.school_id = target_school_id
      and subject_group.class_subject_id =
        any(target_class_subject_ids);

    select coalesce(array_agg(batch.id), '{}'::uuid[])
    into target_batch_ids
    from public.report_batches batch
    where batch.school_id = target_school_id
      and batch.class_subject_id =
        any(target_class_subject_ids);

  else
    select
      array[subject_group.class_subject_id]::uuid[],
      array[subject_group.id]::uuid[]
    into target_class_subject_ids, target_group_ids
    from public.subject_groups subject_group
    where subject_group.school_id = target_school_id
      and subject_group.id = p_entity_id;

    select coalesce(array_agg(batch.id), '{}'::uuid[])
    into target_batch_ids
    from public.report_batches batch
    where batch.school_id = target_school_id
      and batch.subject_group_id = p_entity_id;
  end if;

  if entity_type = 'GROUP' then
    select coalesce(array_agg(submission.id), '{}'::uuid[])
    into target_submission_ids
    from public.weekly_submissions submission
    where submission.school_id = target_school_id
      and submission.subject_group_id =
        any(target_group_ids);
  else
    select coalesce(array_agg(submission.id), '{}'::uuid[])
    into target_submission_ids
    from public.weekly_submissions submission
    where submission.school_id = target_school_id
      and submission.class_subject_id =
        any(target_class_subject_ids);
  end if;

  -- Delete finalized reports that belong to report batches owned by
  -- this context. Deliveries must go first.
  delete from public.email_deliveries delivery
  where delivery.school_id = target_school_id
    and exists (
      select 1
      from public.reports report
      where report.school_id = delivery.school_id
        and report.id = delivery.report_id
        and report.batch_id = any(target_batch_ids)
    );

  delete from public.reports
  where school_id = target_school_id
    and batch_id = any(target_batch_ids);

  -- Sources may also belong to a broader Class report batch, so remove
  -- links to weekly rows before deleting those weekly rows.
  delete from public.report_section_sources source
  where source.school_id = target_school_id
    and (
      source.weekly_submission_id =
        any(target_submission_ids)
      or exists (
        select 1
        from public.report_section_approvals approval
        where approval.school_id = source.school_id
          and approval.id = source.approval_id
          and (
            approval.batch_id = any(target_batch_ids)
            or (
              entity_type = 'GROUP'
              and approval.subject_group_id =
                any(target_group_ids)
            )
            or (
              entity_type <> 'GROUP'
              and approval.class_subject_id =
                any(target_class_subject_ids)
            )
          )
      )
    );

  delete from public.report_student_overrides override_row
  where override_row.school_id = target_school_id
    and exists (
      select 1
      from public.report_section_approvals approval
      where approval.school_id = override_row.school_id
        and approval.id = override_row.approval_id
        and (
          approval.batch_id = any(target_batch_ids)
          or (
            entity_type = 'GROUP'
            and approval.subject_group_id =
              any(target_group_ids)
          )
          or (
            entity_type <> 'GROUP'
            and approval.class_subject_id =
              any(target_class_subject_ids)
          )
        )
    );

  delete from public.report_section_approvals approval
  where approval.school_id = target_school_id
    and (
      approval.batch_id = any(target_batch_ids)
      or (
        entity_type = 'GROUP'
        and approval.subject_group_id =
          any(target_group_ids)
      )
      or (
        entity_type <> 'GROUP'
        and approval.class_subject_id =
          any(target_class_subject_ids)
      )
    );

  delete from public.report_batches
  where school_id = target_school_id
    and id = any(target_batch_ids);

  if entity_type = 'GROUP' then
    delete from public.attendance_resolutions
    where school_id = target_school_id
      and subject_group_id = any(target_group_ids);
  else
    delete from public.attendance_resolutions
    where school_id = target_school_id
      and class_subject_id =
        any(target_class_subject_ids);
  end if;

  delete from public.weekly_submission_students
  where school_id = target_school_id
    and submission_id = any(target_submission_ids);

  delete from public.weekly_submissions
  where school_id = target_school_id
    and id = any(target_submission_ids);

  if entity_type = 'GROUP' then
    delete from public.teaching_assignments
    where school_id = target_school_id
      and subject_group_id = any(target_group_ids);

    delete from public.subject_group_memberships
    where school_id = target_school_id
      and subject_group_id = any(target_group_ids);
  else
    delete from public.teaching_assignments
    where school_id = target_school_id
      and class_subject_id =
        any(target_class_subject_ids);

    delete from public.subject_group_memberships
    where school_id = target_school_id
      and class_subject_id =
        any(target_class_subject_ids);

    delete from public.subject_exclusions
    where school_id = target_school_id
      and class_subject_id =
        any(target_class_subject_ids);
  end if;

  -- A deleted Group leaves its Students in the parent Class/Subject,
  -- with no Group assignment.
  update public.class_subjects
  set default_group_id = null
  where school_id = target_school_id
    and default_group_id = any(target_group_ids);

  delete from public.subject_groups
  where school_id = target_school_id
    and id = any(target_group_ids);

  if delete_class_subjects then
    delete from public.class_subjects
    where school_id = target_school_id
      and id = any(target_class_subject_ids);
  end if;

  if entity_type = 'CLASS' then
    delete from public.class_enrollments
    where school_id = target_school_id
      and class_id = p_entity_id;

    delete from public.classes
    where school_id = target_school_id
      and id = p_entity_id;

  elsif entity_type = 'SUBJECT' then
    delete from public.subjects
    where school_id = target_school_id
      and id = p_entity_id;

  else
    -- The Group row was removed with target_group_ids above.
    null;
  end if;
end;
$$;

revoke all
on function public.get_delete_impact(text, uuid)
from public;

revoke execute
on function public.get_delete_impact(text, uuid)
from anon;

grant execute
on function public.get_delete_impact(text, uuid)
to authenticated;

revoke all
on function
  public.permanently_delete_archived_entity(text, uuid, text)
from public;

revoke execute
on function
  public.permanently_delete_archived_entity(text, uuid, text)
from anon;

grant execute
on function
  public.permanently_delete_archived_entity(text, uuid, text)
to authenticated;
