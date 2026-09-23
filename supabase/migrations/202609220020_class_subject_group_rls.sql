-- Secure the explicit Class -> Subject -> optional Group model introduced in migration 19.
-- Keep migrations 1-19 immutable; legacy permissions remain in place until their screens are retired.

create function public.current_teacher_can_access_class_subject(
  p_class_subject_id uuid,
  p_on_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_subjects cs
    join public.classes c
      on c.school_id = cs.school_id
     and c.id = cs.class_id
    join public.profiles p
      on p.school_id = cs.school_id
     and p.id = public.current_profile_id()
     and p.is_active
    where cs.id = p_class_subject_id
      and cs.school_id = public.current_school_id()
      and cs.is_active
      and c.is_active
      and exists (
        select 1
        from public.teaching_assignments ta
        where ta.school_id = cs.school_id
          and ta.teacher_profile_id = p.id
          and ta.class_subject_id = cs.id
          and ta.starts_on <= p_on_date
          and (ta.ends_on is null or ta.ends_on >= p_on_date)
      )
  )
$$;

create function public.current_teacher_can_access_student(
  p_student_id uuid,
  p_on_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teaching_assignments ta
    join public.class_subjects cs
      on cs.school_id = ta.school_id
     and cs.id = ta.class_subject_id
    join public.classes c
      on c.school_id = cs.school_id
     and c.id = cs.class_id
    join public.profiles p
      on p.school_id = ta.school_id
     and p.id = ta.teacher_profile_id
     and p.is_active
    where ta.school_id = public.current_school_id()
      and ta.teacher_profile_id = public.current_profile_id()
      and ta.starts_on <= p_on_date
      and (ta.ends_on is null or ta.ends_on >= p_on_date)
      and cs.is_active
      and c.is_active
      and public.student_participates_in_class_subject(
        p_student_id,
        ta.class_subject_id,
        p_on_date
      )
      and (
        ta.subject_group_id is null
        or exists (
          select 1
          from public.subject_group_memberships sgm
          join public.subject_groups sg
            on sg.school_id = sgm.school_id
           and sg.class_subject_id = sgm.class_subject_id
           and sg.id = sgm.subject_group_id
          where sgm.school_id = ta.school_id
            and sgm.class_subject_id = ta.class_subject_id
            and sgm.subject_group_id = ta.subject_group_id
            and sgm.student_id = p_student_id
            and sgm.starts_on <= p_on_date
            and (sgm.ends_on is null or sgm.ends_on >= p_on_date)
            and sg.is_active
        )
      )
  )
$$;

revoke all on function public.current_teacher_can_access_class_subject(uuid, date) from public;
revoke execute on function public.current_teacher_can_access_class_subject(uuid, date) from anon;
grant execute on function public.current_teacher_can_access_class_subject(uuid, date) to authenticated;

revoke all on function public.current_teacher_can_access_student(uuid, date) from public;
revoke execute on function public.current_teacher_can_access_student(uuid, date) from anon;
grant execute on function public.current_teacher_can_access_student(uuid, date) to authenticated;

alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.subject_groups enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.subject_exclusions enable row level security;
alter table public.subject_group_memberships enable row level security;
alter table public.teaching_assignments enable row level security;

alter table public.classes force row level security;
alter table public.subjects force row level security;
alter table public.class_subjects force row level security;
alter table public.subject_groups force row level security;
alter table public.class_enrollments force row level security;
alter table public.subject_exclusions force row level security;
alter table public.subject_group_memberships force row level security;
alter table public.teaching_assignments force row level security;

-- Administrators can manage only rows owned by their current school.
create policy classes_admin_all on public.classes
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy subjects_admin_all on public.subjects
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy class_subjects_admin_all on public.class_subjects
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy subject_groups_admin_all on public.subject_groups
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy class_enrollments_admin_all on public.class_enrollments
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy subject_exclusions_admin_all on public.subject_exclusions
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy subject_group_memberships_admin_all on public.subject_group_memberships
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy teaching_assignments_admin_all on public.teaching_assignments
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

-- Teachers receive read-only structure access derived from effective dated assignments.
create policy classes_teacher_select on public.classes
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.class_subjects cs
    where cs.school_id = classes.school_id
      and cs.class_id = classes.id
      and public.current_teacher_can_access_class_subject(cs.id, current_date)
  )
);

create policy subjects_teacher_select on public.subjects
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.class_subjects cs
    where cs.school_id = subjects.school_id
      and cs.subject_id = subjects.id
      and public.current_teacher_can_access_class_subject(cs.id, current_date)
  )
);

create policy class_subjects_teacher_select on public.class_subjects
for select to authenticated
using (
  school_id = public.current_school_id()
  and public.current_teacher_can_access_class_subject(id, current_date)
);

create policy subject_groups_teacher_select on public.subject_groups
for select to authenticated
using (
  school_id = public.current_school_id()
  and public.teacher_can_teach_context(
    public.current_profile_id(),
    class_subject_id,
    id,
    current_date
  )
);

create policy subject_group_memberships_teacher_select on public.subject_group_memberships
for select to authenticated
using (
  school_id = public.current_school_id()
  and public.teacher_can_teach_context(
    public.current_profile_id(),
    class_subject_id,
    subject_group_id,
    current_date
  )
  and public.student_participates_in_class_subject(
    student_id,
    class_subject_id,
    current_date
  )
);

create policy teaching_assignments_teacher_select on public.teaching_assignments
for select to authenticated
using (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
);

-- Add academic roster visibility without broadening legacy rows. The helper enforces
-- active assignment, class participation, Subject exclusion, and exact-Group membership.
create policy students_academic_select on public.students
for select to authenticated
using (
  school_id = public.current_school_id()
  and public.current_teacher_can_access_student(id, current_date)
);
