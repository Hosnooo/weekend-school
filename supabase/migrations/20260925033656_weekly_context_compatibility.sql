-- Preserve privileged server/test access while keeping authenticated weekly teaching checks school-scoped.
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
      and (
        auth.uid() is null
        or class_subject.school_id = public.current_school_id()
      )
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
