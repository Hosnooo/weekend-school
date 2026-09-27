-- Allow an existing, currently unassigned Student to enroll in a Class.
-- Existing Class-change history behavior remains unchanged.

create function public.enroll_student_in_class(
  p_student_id uuid,
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
  class_subject_row record;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  if p_starts_on is null then
    raise exception 'enrollment start date is required'
      using errcode = '22023';
  end if;

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

  perform 1
  from public.classes class_row
  where class_row.school_id = target_school_id
    and class_row.id = p_target_class_id
    and class_row.is_active
  for update;

  if not found then
    raise exception 'active class not found'
      using errcode = '23503';
  end if;

  insert into public.class_enrollments (
    school_id,
    class_id,
    student_id,
    starts_on
  ) values (
    target_school_id,
    p_target_class_id,
    p_student_id,
    p_starts_on
  );

  -- New enrollment inherits each active Subject's default Group, if any.
  for class_subject_row in
    select
      class_subject.id,
      class_subject.default_group_id
    from public.class_subjects class_subject
    where class_subject.school_id = target_school_id
      and class_subject.class_id = p_target_class_id
      and class_subject.is_active
    order by class_subject.id
  loop
    if class_subject_row.default_group_id is not null
       and exists (
         select 1
         from public.subject_groups subject_group
         where subject_group.school_id = target_school_id
           and subject_group.class_subject_id = class_subject_row.id
           and subject_group.id = class_subject_row.default_group_id
           and subject_group.is_active
       )
    then
      insert into public.subject_group_memberships (
        school_id,
        class_subject_id,
        subject_group_id,
        student_id,
        starts_on
      ) values (
        target_school_id,
        class_subject_row.id,
        class_subject_row.default_group_id,
        p_student_id,
        p_starts_on
      );
    end if;
  end loop;
end;
$$;

revoke all
on function public.enroll_student_in_class(uuid, uuid, date)
from public;

revoke execute
on function public.enroll_student_in_class(uuid, uuid, date)
from anon;

grant execute
on function public.enroll_student_in_class(uuid, uuid, date)
to authenticated;
