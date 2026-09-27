-- Weekly rosters include students whose eligible enrollment/group
-- participation overlaps any day of the reporting week.

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
    raise exception 'assigned teaching context required'
      using errcode = '42501';
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
    and exists (
      select 1
      from pg_catalog.generate_series(0, 6) as week_day(day_offset)
      where public.student_participates_in_class_subject(
        student.id,
        p_class_subject_id,
        p_on_date + week_day.day_offset
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
            and membership.starts_on <= p_on_date + week_day.day_offset
            and (
              membership.ends_on is null
              or membership.ends_on >= p_on_date + week_day.day_offset
            )
            and subject_group.is_active
        )
      )
    )
  order by student.last_name_en, student.first_name_en, student.id;
end;
$$;

revoke all
on function public.get_weekly_submission_roster(uuid, uuid, date)
from public;

revoke execute
on function public.get_weekly_submission_roster(uuid, uuid, date)
from anon;

grant execute
on function public.get_weekly_submission_roster(uuid, uuid, date)
to authenticated;

-- Keep direct Teacher row inserts aligned with the same weekly-roster rule.
drop policy if exists weekly_submission_students_teacher_insert
on public.weekly_submission_students;

create policy weekly_submission_students_teacher_insert
on public.weekly_submission_students
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
      and exists (
        select 1
        from public.get_weekly_submission_roster(
          submission.class_subject_id,
          submission.subject_group_id,
          submission.week_start
        ) roster
        where roster.student_id = weekly_submission_students.student_id
      )
  )
);
