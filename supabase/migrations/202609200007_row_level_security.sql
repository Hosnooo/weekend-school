create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.is_active
$$;

create function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.school_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.is_active
$$;

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.is_active
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'ADMIN', false)
$$;

create function public.teaches_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_teachers
    where group_teachers.school_id = public.current_school_id()
      and group_teachers.group_id = target_group_id
      and group_teachers.teacher_profile_id = public.current_profile_id()
  )
$$;

create function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_memberships
    join public.group_teachers
      on group_teachers.school_id = group_memberships.school_id
      and group_teachers.group_id = group_memberships.group_id
    where group_memberships.school_id = public.current_school_id()
      and group_memberships.student_id = target_student_id
      and group_teachers.teacher_profile_id = public.current_profile_id()
  )
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_school_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.teaches_group(uuid) from public;
revoke all on function public.can_access_student(uuid) from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_school_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.teaches_group(uuid) to authenticated;
grant execute on function public.can_access_student(uuid) to authenticated;

create function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and not public.is_admin()
    and row(
      new.id,
      new.school_id,
      new.auth_user_id,
      new.display_name,
      new.role,
      new.is_active,
      new.created_at
    ) is distinct from row(
      old.id,
      old.school_id,
      old.auth_user_id,
      old.display_name,
      old.role,
      old.is_active,
      old.created_at
    )
  then
    raise exception 'profile fields cannot be changed' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_sensitive_fields
before update on public.profiles
for each row execute function public.protect_profile_sensitive_fields();

revoke all on function public.protect_profile_sensitive_fields() from public;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.groups enable row level security;
alter table public.group_teachers enable row level security;
alter table public.group_memberships enable row level security;
alter table public.sessions enable row level security;
alter table public.group_progress enable row level security;
alter table public.attendance enable row level security;
alter table public.student_progress enable row level security;
alter table public.reports enable row level security;
alter table public.email_deliveries enable row level security;

alter table public.schools force row level security;
alter table public.profiles force row level security;
alter table public.students force row level security;
alter table public.guardians force row level security;
alter table public.student_guardians force row level security;
alter table public.groups force row level security;
alter table public.group_teachers force row level security;
alter table public.group_memberships force row level security;
alter table public.sessions force row level security;
alter table public.group_progress force row level security;
alter table public.attendance force row level security;
alter table public.student_progress force row level security;
alter table public.reports force row level security;
alter table public.email_deliveries force row level security;

create policy schools_select_own on public.schools
for select to authenticated
using (id = public.current_school_id());
create policy schools_admin_update on public.schools
for update to authenticated
using (id = public.current_school_id() and public.is_admin())
with check (id = public.current_school_id() and public.is_admin());

create policy profiles_select on public.profiles
for select to authenticated
using (
  school_id = public.current_school_id()
  and (public.is_admin() or id = public.current_profile_id())
);
create policy profiles_admin_insert on public.profiles
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy profiles_admin_update on public.profiles
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());
create policy profiles_self_language_update on public.profiles
for update to authenticated
using (school_id = public.current_school_id() and id = public.current_profile_id())
with check (school_id = public.current_school_id() and id = public.current_profile_id());

create policy students_select on public.students
for select to authenticated
using (
  school_id = public.current_school_id()
  and (public.is_admin() or public.can_access_student(id))
);
create policy students_admin_insert on public.students
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy students_admin_update on public.students
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy guardians_admin_select on public.guardians
for select to authenticated
using (school_id = public.current_school_id() and public.is_admin());
create policy guardians_admin_insert on public.guardians
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy guardians_admin_update on public.guardians
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy student_guardians_admin_select on public.student_guardians
for select to authenticated
using (school_id = public.current_school_id() and public.is_admin());
create policy student_guardians_admin_insert on public.student_guardians
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy student_guardians_admin_update on public.student_guardians
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy groups_select on public.groups
for select to authenticated
using (
  school_id = public.current_school_id()
  and (public.is_admin() or public.teaches_group(id))
);
create policy groups_admin_insert on public.groups
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy groups_admin_update on public.groups
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy group_teachers_select on public.group_teachers
for select to authenticated
using (
  school_id = public.current_school_id()
  and (public.is_admin() or teacher_profile_id = public.current_profile_id())
);
create policy group_teachers_admin_insert on public.group_teachers
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy group_teachers_admin_update on public.group_teachers
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy group_memberships_select on public.group_memberships
for select to authenticated
using (
  school_id = public.current_school_id()
  and (public.is_admin() or public.teaches_group(group_id))
);
create policy group_memberships_admin_insert on public.group_memberships
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy group_memberships_admin_update on public.group_memberships
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy sessions_select on public.sessions
for select to authenticated
using (
  school_id = public.current_school_id()
  and (public.is_admin() or public.teaches_group(group_id))
);
create policy sessions_teacher_insert on public.sessions
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and created_by = public.current_profile_id()
  and status = 'DRAFT'
  and public.teaches_group(group_id)
);
create policy sessions_teacher_update on public.sessions
for update to authenticated
using (
  school_id = public.current_school_id()
  and created_by = public.current_profile_id()
  and status = 'DRAFT'
  and public.teaches_group(group_id)
)
with check (
  school_id = public.current_school_id()
  and created_by = public.current_profile_id()
  and public.teaches_group(group_id)
);

create policy group_progress_select on public.group_progress
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = group_progress.session_id
      and sessions.school_id = group_progress.school_id
      and (public.is_admin() or public.teaches_group(sessions.group_id))
  )
);
create policy group_progress_teacher_insert on public.group_progress
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = group_progress.session_id
      and sessions.school_id = group_progress.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
);
create policy group_progress_teacher_update on public.group_progress
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = group_progress.session_id
      and sessions.school_id = group_progress.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
)
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = group_progress.session_id
      and sessions.school_id = group_progress.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
);

create policy attendance_select on public.attendance
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = attendance.session_id
      and sessions.school_id = attendance.school_id
      and (public.is_admin() or public.teaches_group(sessions.group_id))
  )
);
create policy attendance_teacher_insert on public.attendance
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = attendance.session_id
      and sessions.school_id = attendance.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
);
create policy attendance_teacher_update on public.attendance
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = attendance.session_id
      and sessions.school_id = attendance.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
)
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = attendance.session_id
      and sessions.school_id = attendance.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
);

create policy student_progress_select on public.student_progress
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = student_progress.session_id
      and sessions.school_id = student_progress.school_id
      and (public.is_admin() or public.teaches_group(sessions.group_id))
  )
);
create policy student_progress_teacher_insert on public.student_progress
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = student_progress.session_id
      and sessions.school_id = student_progress.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
);
create policy student_progress_teacher_update on public.student_progress
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = student_progress.session_id
      and sessions.school_id = student_progress.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
)
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = student_progress.session_id
      and sessions.school_id = student_progress.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
);
create policy student_progress_teacher_delete on public.student_progress
for delete to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.sessions
    where sessions.id = student_progress.session_id
      and sessions.school_id = student_progress.school_id
      and sessions.status = 'DRAFT'
      and sessions.created_by = public.current_profile_id()
      and public.teaches_group(sessions.group_id)
  )
);

create policy reports_admin_select on public.reports
for select to authenticated
using (school_id = public.current_school_id() and public.is_admin());
create policy reports_admin_insert on public.reports
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy reports_admin_update on public.reports
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy email_deliveries_admin_select on public.email_deliveries
for select to authenticated
using (school_id = public.current_school_id() and public.is_admin());
create policy email_deliveries_admin_insert on public.email_deliveries
for insert to authenticated
with check (school_id = public.current_school_id() and public.is_admin());
create policy email_deliveries_admin_update on public.email_deliveries
for update to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

grant select, insert, update on public.schools to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update on public.guardians to authenticated;
grant select, insert, update on public.student_guardians to authenticated;
grant select, insert, update on public.groups to authenticated;
grant select, insert, update on public.group_teachers to authenticated;
grant select, insert, update on public.group_memberships to authenticated;
grant select, insert, update on public.sessions to authenticated;
grant select, insert, update on public.group_progress to authenticated;
grant select, insert, update on public.attendance to authenticated;
grant select, insert, update on public.student_progress to authenticated;
grant delete on public.student_progress to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.email_deliveries to authenticated;
