-- Administrator/Teacher UX completion: weekly teaching overlap semantics,
-- protected assignment date editing, and lifecycle support for non-Student records.
-- Forward-only migration; previously applied migrations remain immutable.

create or replace function public.teacher_can_teach_week_context(
  p_teacher_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_week_start date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_subjects class_subject
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    join public.teachers teacher
      on teacher.school_id = class_subject.school_id
     and teacher.id = p_teacher_id
    where class_subject.id = p_class_subject_id
      and class_subject.school_id = public.current_school_id()
      and class_subject.is_active
      and class_row.is_active
      and teacher.is_active
      and (
        auth.uid() is null
        or public.is_admin()
        or teacher.id in (select public.current_teacher_ids())
      )
      and (
        p_subject_group_id is null
        or exists (
          select 1
          from public.subject_groups subject_group
          where subject_group.school_id = class_subject.school_id
            and subject_group.class_subject_id = class_subject.id
            and subject_group.id = p_subject_group_id
            and subject_group.is_active
        )
      )
      and exists (
        select 1
        from public.teaching_assignments assignment
        where assignment.school_id = class_subject.school_id
          and assignment.teacher_id = teacher.id
          and assignment.class_subject_id = class_subject.id
          and assignment.starts_on <= (p_week_start + 6)
          and (assignment.ends_on is null or assignment.ends_on >= p_week_start)
          and (
            (p_subject_group_id is null and assignment.subject_group_id is null)
            or (
              p_subject_group_id is not null
              and (
                assignment.subject_group_id is null
                or assignment.subject_group_id = p_subject_group_id
              )
            )
          )
      )
  )
$$;

revoke all on function public.teacher_can_teach_week_context(uuid, uuid, uuid, date) from public;
revoke execute on function public.teacher_can_teach_week_context(uuid, uuid, uuid, date) from anon;
grant execute on function public.teacher_can_teach_week_context(uuid, uuid, uuid, date) to authenticated;

create or replace function public.update_teaching_assignment_dates(
  p_teacher_id uuid,
  p_assignment_id uuid,
  p_starts_on date,
  p_ends_on date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_assignment public.teaching_assignments%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'assignment end date cannot be before start date' using errcode = '23514';
  end if;

  select * into target_assignment
  from public.teaching_assignments assignment
  where assignment.school_id = target_school_id
    and assignment.teacher_id = p_teacher_id
    and assignment.id = p_assignment_id
  for update;

  if not found then
    raise exception 'teaching assignment not found' using errcode = 'P0002';
  end if;

  update public.teaching_assignments assignment
  set starts_on = p_starts_on,
      ends_on = p_ends_on
  where assignment.school_id = target_school_id
    and assignment.id = p_assignment_id;

  if exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id = target_school_id
      and submission.teacher_id = target_assignment.teacher_id
      and submission.class_subject_id = target_assignment.class_subject_id
      and submission.status = 'SUBMITTED'
      and (
        target_assignment.subject_group_id is null
        or submission.subject_group_id = target_assignment.subject_group_id
      )
      and not public.teacher_can_teach_week_context(
        target_assignment.teacher_id,
        submission.class_subject_id,
        submission.subject_group_id,
        submission.week_start
      )
  ) then
    raise exception 'assignment date change would invalidate submitted teaching history'
      using errcode = '23514';
  end if;

  return true;
end;
$$;

revoke all on function public.update_teaching_assignment_dates(uuid, uuid, date, date) from public;
revoke execute on function public.update_teaching_assignment_dates(uuid, uuid, date, date) from anon;
grant execute on function public.update_teaching_assignment_dates(uuid, uuid, date, date) to authenticated;

create or replace function public.validate_weekly_submission_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.subject_group_id is not null and not exists (
    select 1
    from public.subject_groups subject_group
    where subject_group.school_id = new.school_id
      and subject_group.class_subject_id = new.class_subject_id
      and subject_group.id = new.subject_group_id
  ) then
    return new;
  end if;

  if not public.teacher_can_teach_week_context(
    new.teacher_id,
    new.class_subject_id,
    new.subject_group_id,
    new.week_start
  ) then
    raise exception 'teacher is not assigned to this teaching context'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Direct table writes and the security-definer save path use the same week-overlap rule.
drop policy if exists weekly_submissions_teacher_insert on public.weekly_submissions;
create policy weekly_submissions_teacher_insert on public.weekly_submissions
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
  and public.teacher_can_teach_week_context(teacher_id, class_subject_id, subject_group_id, week_start)
);

drop policy if exists weekly_submissions_teacher_update on public.weekly_submissions;
create policy weekly_submissions_teacher_update on public.weekly_submissions
for update to authenticated
using (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
  and status = 'DRAFT'
)
with check (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
  and public.teacher_can_teach_week_context(teacher_id, class_subject_id, subject_group_id, week_start)
);

drop policy if exists weekly_submission_students_teacher_insert on public.weekly_submission_students;
create policy weekly_submission_students_teacher_insert on public.weekly_submission_students
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id = weekly_submission_students.school_id
      and submission.id = weekly_submission_students.submission_id
      and submission.teacher_id in (select public.current_teacher_ids())
      and submission.status = 'DRAFT'
      and public.teacher_can_teach_week_context(
        submission.teacher_id,
        submission.class_subject_id,
        submission.subject_group_id,
        submission.week_start
      )
      and public.student_participates_in_class_subject(
        weekly_submission_students.student_id,
        submission.class_subject_id,
        submission.week_start
      )
      and (
        submission.subject_group_id is null
        or exists (
          select 1
          from public.subject_group_memberships membership
          where membership.school_id = submission.school_id
            and membership.class_subject_id = submission.class_subject_id
            and membership.subject_group_id = submission.subject_group_id
            and membership.student_id = weekly_submission_students.student_id
            and membership.starts_on <= submission.week_start
            and (membership.ends_on is null or membership.ends_on >= submission.week_start)
        )
      )
  )
);

create or replace function public.get_weekly_submission_roster(
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_on_date date
)
returns table (
  student_id uuid,
  first_name_en text,
  last_name_en text,
  first_name_ar text,
  last_name_ar text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
begin
  if target_school_id is null
    or not exists (
      select 1
      from public.current_teacher_ids() teacher_id
      where public.teacher_can_teach_week_context(
        teacher_id,
        p_class_subject_id,
        p_subject_group_id,
        p_on_date
      )
    )
  then
    raise exception 'assigned teaching context required' using errcode = '42501';
  end if;

  return query
  select
    student.id,
    student.first_name_en,
    student.last_name_en,
    student.first_name_ar,
    student.last_name_ar
  from public.students student
  where student.school_id = target_school_id
    and student.is_active
    and public.student_participates_in_class_subject(
      student.id,
      p_class_subject_id,
      p_on_date
    )
    and (
      p_subject_group_id is null
      or exists (
        select 1
        from public.subject_group_memberships membership
        join public.subject_groups subject_group
          on subject_group.school_id = membership.school_id
         and subject_group.class_subject_id = membership.class_subject_id
         and subject_group.id = membership.subject_group_id
        where membership.school_id = target_school_id
          and membership.class_subject_id = p_class_subject_id
          and membership.subject_group_id = p_subject_group_id
          and membership.student_id = student.id
          and membership.starts_on <= p_on_date
          and (membership.ends_on is null or membership.ends_on >= p_on_date)
          and subject_group.is_active
      )
    )
  order by student.last_name_en, student.first_name_en, student.id;
end;
$$;

create or replace function public.save_weekly_submission(
  p_teacher_id uuid,
  p_submission_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_week_start date,
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
  target_submission_id uuid := p_submission_id;
  target_status public.session_status;
  roster_count integer;
  attendance_count integer;
begin
  if target_school_id is null
    or p_teacher_id not in (select public.current_teacher_ids())
    or not public.teacher_can_teach_week_context(
      p_teacher_id, p_class_subject_id, p_subject_group_id, p_week_start
    )
  then
    raise exception 'assigned teaching context required' using errcode = '42501';
  end if;

  if target_submission_id is null then
    insert into public.weekly_submissions (
      school_id, class_subject_id, subject_group_id, teacher_id, week_start
    ) values (
      target_school_id, p_class_subject_id, p_subject_group_id, p_teacher_id, p_week_start
    )
    on conflict on constraint weekly_submissions_one_teacher_context_week do nothing
    returning id into target_submission_id;

    if target_submission_id is null then
      select submission.id into target_submission_id
      from public.weekly_submissions submission
      where submission.school_id = target_school_id
        and submission.class_subject_id = p_class_subject_id
        and submission.subject_group_id is not distinct from p_subject_group_id
        and submission.teacher_id = p_teacher_id
        and submission.week_start = p_week_start;
    end if;
  end if;

  select submission.status into target_status
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = target_submission_id
    and submission.class_subject_id = p_class_subject_id
    and submission.subject_group_id is not distinct from p_subject_group_id
    and submission.teacher_id = p_teacher_id
    and submission.week_start = p_week_start
  for update;

  if target_status is null then
    raise exception 'weekly submission access required' using errcode = '42501';
  end if;
  if target_status = 'SUBMITTED' then
    raise exception 'submitted weekly submissions are immutable' using errcode = '55000';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
      as item(student_id uuid, status public.attendance_status)
    where not exists (
      select 1 from public.get_weekly_submission_roster(
        p_class_subject_id, p_subject_group_id, p_week_start
      ) roster
      where roster.student_id = item.student_id
    )
  ) then
    raise exception 'attendance student is outside the weekly roster' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb))
      as item(
        student_id uuid,
        performance_override public.performance_level,
        comment_en text,
        comment_ar text
      )
    where not exists (
      select 1 from public.get_weekly_submission_roster(
        p_class_subject_id, p_subject_group_id, p_week_start
      ) roster
      where roster.student_id = item.student_id
    )
  ) then
    raise exception 'exception student is outside the weekly roster' using errcode = '42501';
  end if;

  update public.weekly_submissions
  set progress_en = nullif(trim(p_progress_en), ''),
      progress_ar = nullif(trim(p_progress_ar), ''),
      default_performance = p_default_performance
  where school_id = target_school_id
    and id = target_submission_id;

  delete from public.weekly_submission_students
  where school_id = target_school_id
    and submission_id = target_submission_id;

  insert into public.weekly_submission_students (
    school_id, submission_id, student_id, attendance_status
  )
  select target_school_id, target_submission_id, item.student_id, item.status
  from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
    as item(student_id uuid, status public.attendance_status);

  update public.weekly_submission_students student_row
  set performance_override = item.performance_override,
      comment_en = nullif(trim(item.comment_en), ''),
      comment_ar = nullif(trim(item.comment_ar), '')
  from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb))
    as item(
      student_id uuid,
      performance_override public.performance_level,
      comment_en text,
      comment_ar text
    )
  where student_row.school_id = target_school_id
    and student_row.submission_id = target_submission_id
    and student_row.student_id = item.student_id
    and (
      item.performance_override is not null
      or nullif(trim(item.comment_en), '') is not null
      or nullif(trim(item.comment_ar), '') is not null
    );

  if p_submit then
    if nullif(trim(p_progress_en), '') is null
      and nullif(trim(p_progress_ar), '') is null
    then
      raise exception 'progress is required for submission' using errcode = '23514';
    end if;

    select count(*) into roster_count
    from public.get_weekly_submission_roster(
      p_class_subject_id, p_subject_group_id, p_week_start
    );

    select count(distinct student_row.student_id) into attendance_count
    from public.weekly_submission_students student_row
    where student_row.school_id = target_school_id
      and student_row.submission_id = target_submission_id;

    if attendance_count <> roster_count then
      raise exception 'complete attendance is required for submission' using errcode = '23514';
    end if;

    update public.weekly_submissions
    set status = 'SUBMITTED', submitted_at = now()
    where school_id = target_school_id
      and id = target_submission_id;
  end if;

  return target_submission_id;
end;
$$;

create or replace function public.save_weekly_submission(
  p_submission_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_week_start date,
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
  resolved_teacher_id uuid;
  matching_teacher_count integer := 0;
begin
  select candidate.teacher_id, candidate.match_count
  into resolved_teacher_id, matching_teacher_count
  from (
    select current_id as teacher_id, count(*) over ()::integer as match_count
    from public.current_teacher_ids() current_id
    where public.teacher_can_teach_week_context(
      current_id, p_class_subject_id, p_subject_group_id, p_week_start
    )
  ) candidate
  limit 1;

  if coalesce(matching_teacher_count, 0) <> 1 then
    raise exception 'exactly one Teacher identity is required for this teaching context'
      using errcode = '42501';
  end if;

  return public.save_weekly_submission(
    resolved_teacher_id,
    p_submission_id,
    p_class_subject_id,
    p_subject_group_id,
    p_week_start,
    p_progress_en,
    p_progress_ar,
    p_default_performance,
    p_attendance,
    p_exceptions,
    p_submit
  );
end;
$$;

-- Extend archive/restore to the remaining school-owned records used by this UI.
create or replace function public.archive_entity(
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
  entity_type text := upper(trim(p_entity_type));
  affected integer := 0;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  case entity_type
    when 'STUDENT' then
      update public.students set is_active = false where school_id = target_school_id and id = p_entity_id;
    when 'TEACHER' then
      update public.teachers set is_active = false where school_id = target_school_id and id = p_entity_id;
    when 'GUARDIAN' then
      update public.guardians set is_active = false where school_id = target_school_id and id = p_entity_id;
    when 'CLASS' then
      update public.classes set is_active = false where school_id = target_school_id and id = p_entity_id;
    when 'SUBJECT' then
      update public.subjects set is_active = false where school_id = target_school_id and id = p_entity_id;
    when 'GROUP' then
      update public.subject_groups set is_active = false where school_id = target_school_id and id = p_entity_id;
    else
      raise exception 'unsupported archive entity type' using errcode = '22023';
  end case;

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'archive target not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.restore_entity(
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
  entity_type text := upper(trim(p_entity_type));
  affected integer := 0;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  case entity_type
    when 'STUDENT' then
      update public.students set is_active = true where school_id = target_school_id and id = p_entity_id;
    when 'TEACHER' then
      update public.teachers set is_active = true where school_id = target_school_id and id = p_entity_id;
    when 'GUARDIAN' then
      update public.guardians set is_active = true where school_id = target_school_id and id = p_entity_id;
    when 'CLASS' then
      update public.classes set is_active = true where school_id = target_school_id and id = p_entity_id;
    when 'SUBJECT' then
      update public.subjects set is_active = true where school_id = target_school_id and id = p_entity_id;
    when 'GROUP' then
      update public.subject_groups set is_active = true where school_id = target_school_id and id = p_entity_id;
    else
      raise exception 'unsupported archive entity type' using errcode = '22023';
  end case;

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'restore target not found' using errcode = 'P0002';
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
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  case entity_type
    when 'STUDENT' then
      select not student.is_active into archived
      from public.students student
      where student.school_id = target_school_id and student.id = p_entity_id;
      if not found then raise exception 'delete target not found' using errcode = 'P0002'; end if;

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
      select count(*) into attendance_resolutions_count from public.attendance_resolutions where school_id = target_school_id and student_id = p_entity_id;
      select
        (select count(*) from public.student_progress where school_id = target_school_id and student_id = p_entity_id and (comment_en is not null or comment_ar is not null))
        + (select count(*) from public.weekly_submission_students where school_id = target_school_id and student_id = p_entity_id and (comment_en is not null or comment_ar is not null))
        + (select count(*) from public.report_student_overrides where school_id = target_school_id and student_id = p_entity_id and (comment_en is not null or comment_ar is not null))
      into comments_count;
      select count(*) into reports_count from public.reports where school_id = target_school_id and student_id = p_entity_id;
      select count(*) into deliveries_count from public.email_deliveries where school_id = target_school_id and student_id = p_entity_id;
      dependency_count := memberships_count + attendance_observations_count + attendance_resolutions_count + comments_count + reports_count + deliveries_count;
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
      select not teacher.is_active into archived from public.teachers teacher where teacher.school_id = target_school_id and teacher.id = p_entity_id;
      if not found then raise exception 'delete target not found' using errcode = 'P0002'; end if;
      dependency_details := jsonb_build_object(
        'accountLinks', (select count(*) from public.teacher_accounts where school_id = target_school_id and teacher_id = p_entity_id),
        'teachingAssignments', (select count(*) from public.teaching_assignments where school_id = target_school_id and teacher_id = p_entity_id),
        'groupAssignments', (select count(*) from public.group_teachers where school_id = target_school_id and teacher_id = p_entity_id),
        'weeklySubmissions', (select count(*) from public.weekly_submissions where school_id = target_school_id and teacher_id = p_entity_id)
      );
    when 'GUARDIAN' then
      select not guardian.is_active into archived from public.guardians guardian where guardian.school_id = target_school_id and guardian.id = p_entity_id;
      if not found then raise exception 'delete target not found' using errcode = 'P0002'; end if;
      dependency_details := jsonb_build_object(
        'studentLinks', (select count(*) from public.student_guardians where school_id = target_school_id and guardian_id = p_entity_id)
      );
    when 'CLASS' then
      select not class_row.is_active into archived from public.classes class_row where class_row.school_id = target_school_id and class_row.id = p_entity_id;
      if not found then raise exception 'delete target not found' using errcode = 'P0002'; end if;
      dependency_details := jsonb_build_object(
        'classSubjects', (select count(*) from public.class_subjects where school_id = target_school_id and class_id = p_entity_id),
        'enrollments', (select count(*) from public.class_enrollments where school_id = target_school_id and class_id = p_entity_id)
      );
    when 'SUBJECT' then
      select not subject.is_active into archived from public.subjects subject where subject.school_id = target_school_id and subject.id = p_entity_id;
      if not found then raise exception 'delete target not found' using errcode = 'P0002'; end if;
      dependency_details := jsonb_build_object(
        'classSubjects', (select count(*) from public.class_subjects where school_id = target_school_id and subject_id = p_entity_id)
      );
    when 'GROUP' then
      select not subject_group.is_active into archived from public.subject_groups subject_group where subject_group.school_id = target_school_id and subject_group.id = p_entity_id;
      if not found then raise exception 'delete target not found' using errcode = 'P0002'; end if;
      dependency_details := jsonb_build_object(
        'memberships', (select count(*) from public.subject_group_memberships where school_id = target_school_id and subject_group_id = p_entity_id),
        'teachingAssignments', (select count(*) from public.teaching_assignments where school_id = target_school_id and subject_group_id = p_entity_id),
        'weeklySubmissions', (select count(*) from public.weekly_submissions where school_id = target_school_id and subject_group_id = p_entity_id),
        'defaultUse', (select count(*) from public.class_subjects where school_id = target_school_id and default_group_id = p_entity_id)
      );
    else
      raise exception 'unsupported delete-impact entity type' using errcode = '22023';
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
  impact jsonb;
  target_student public.students%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_confirmation is distinct from ('DELETE ' || p_entity_id::text) then
    raise exception 'permanent deletion confirmation does not match' using errcode = '22023';
  end if;

  if entity_type = 'STUDENT' then
    select * into target_student
    from public.students student
    where student.school_id = target_school_id and student.id = p_entity_id
    for update;
    if not found then raise exception 'delete target not found' using errcode = 'P0002'; end if;
    if target_student.is_active then raise exception 'target must be archived before permanent deletion' using errcode = '23514'; end if;

    perform set_config('app.permanent_delete_student_id', p_entity_id::text, true);
    delete from public.email_deliveries where school_id = target_school_id and student_id = p_entity_id;
    delete from public.reports where school_id = target_school_id and student_id = p_entity_id;
    delete from public.report_student_overrides where school_id = target_school_id and student_id = p_entity_id;
    delete from public.attendance_resolutions where school_id = target_school_id and student_id = p_entity_id;
    delete from public.weekly_submission_students where school_id = target_school_id and student_id = p_entity_id;
    delete from public.attendance where school_id = target_school_id and student_id = p_entity_id;
    delete from public.student_progress where school_id = target_school_id and student_id = p_entity_id;
    delete from public.subject_group_memberships where school_id = target_school_id and student_id = p_entity_id;
    delete from public.subject_exclusions where school_id = target_school_id and student_id = p_entity_id;
    delete from public.class_enrollments where school_id = target_school_id and student_id = p_entity_id;
    delete from public.group_memberships where school_id = target_school_id and student_id = p_entity_id;
    delete from public.student_guardians where school_id = target_school_id and student_id = p_entity_id;
    delete from public.students where school_id = target_school_id and id = p_entity_id;
    return;
  end if;

  impact := public.get_delete_impact(entity_type, p_entity_id);
  if not coalesce((impact->>'isArchived')::boolean, false) then
    raise exception 'target must be archived before permanent deletion' using errcode = '23514';
  end if;
  if not coalesce((impact->>'canPermanentlyDelete')::boolean, false) then
    raise exception 'protected dependencies block permanent deletion' using errcode = '23503';
  end if;

  case entity_type
    when 'TEACHER' then delete from public.teachers where school_id = target_school_id and id = p_entity_id;
    when 'GUARDIAN' then delete from public.guardians where school_id = target_school_id and id = p_entity_id;
    when 'CLASS' then delete from public.classes where school_id = target_school_id and id = p_entity_id;
    when 'SUBJECT' then delete from public.subjects where school_id = target_school_id and id = p_entity_id;
    when 'GROUP' then delete from public.subject_groups where school_id = target_school_id and id = p_entity_id;
    else raise exception 'unsupported permanent-delete entity type' using errcode = '22023';
  end case;
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
