create unique index guardians_school_email_idx
  on public.guardians (school_id, email);

create unique index group_teachers_one_primary_idx
  on public.group_teachers (school_id, group_id)
  where assignment_type = 'PRIMARY';

create function public.create_student_with_guardian(
  p_first_name_en text,
  p_last_name_en text,
  p_first_name_ar text,
  p_last_name_ar text,
  p_group_id uuid,
  p_guardian_name text,
  p_guardian_email text,
  p_report_language public.report_language,
  p_starts_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  new_student_id uuid;
  target_guardian_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.groups
    where groups.school_id = target_school_id
      and groups.id = p_group_id
      and groups.is_active
  ) then
    raise exception 'active group not found' using errcode = '23503';
  end if;

  insert into public.students (
    school_id,
    first_name_en,
    last_name_en,
    first_name_ar,
    last_name_ar
  ) values (
    target_school_id,
    trim(p_first_name_en),
    trim(p_last_name_en),
    nullif(trim(p_first_name_ar), ''),
    nullif(trim(p_last_name_ar), '')
  )
  returning id into new_student_id;

  select guardians.id into target_guardian_id
  from public.guardians
  where guardians.school_id = target_school_id
    and guardians.email = lower(trim(p_guardian_email));

  if target_guardian_id is null then
    insert into public.guardians (
      school_id,
      name,
      email,
      report_language
    ) values (
      target_school_id,
      trim(p_guardian_name),
      lower(trim(p_guardian_email)),
      p_report_language
    )
    returning id into target_guardian_id;
  end if;

  insert into public.student_guardians (
    school_id,
    student_id,
    guardian_id,
    receives_reports,
    is_primary
  ) values (
    target_school_id,
    new_student_id,
    target_guardian_id,
    true,
    true
  );

  insert into public.group_memberships (
    school_id,
    group_id,
    student_id,
    starts_on
  ) values (
    target_school_id,
    p_group_id,
    new_student_id,
    p_starts_on
  );

  return new_student_id;
end;
$$;

revoke all on function public.create_student_with_guardian(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  public.report_language,
  date
) from public;

grant execute on function public.create_student_with_guardian(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  public.report_language,
  date
) to authenticated;

create function public.create_group_with_teacher(
  p_name_en text,
  p_name_ar text,
  p_parent_group_id uuid,
  p_teacher_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  new_group_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  insert into public.groups (school_id, name_en, name_ar, parent_group_id)
  values (
    target_school_id,
    trim(p_name_en),
    nullif(trim(p_name_ar), ''),
    p_parent_group_id
  )
  returning id into new_group_id;

  if p_teacher_profile_id is not null then
    if not exists (
      select 1 from public.profiles
      where profiles.school_id = target_school_id
        and profiles.id = p_teacher_profile_id
        and profiles.role = 'TEACHER'
        and profiles.is_active
    ) then
      raise exception 'active teacher not found' using errcode = '23503';
    end if;

    insert into public.group_teachers (
      school_id,
      group_id,
      teacher_profile_id,
      assignment_type
    ) values (
      target_school_id,
      new_group_id,
      p_teacher_profile_id,
      'PRIMARY'
    );
  end if;

  return new_group_id;
end;
$$;

create function public.update_group_with_teacher(
  p_group_id uuid,
  p_name_en text,
  p_name_ar text,
  p_parent_group_id uuid,
  p_teacher_profile_id uuid
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
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  update public.groups
  set name_en = trim(p_name_en),
      name_ar = nullif(trim(p_name_ar), ''),
      parent_group_id = p_parent_group_id
  where groups.school_id = target_school_id
    and groups.id = p_group_id;

  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  delete from public.group_teachers
  where group_teachers.school_id = target_school_id
    and group_teachers.group_id = p_group_id
    and group_teachers.assignment_type = 'PRIMARY';

  if p_teacher_profile_id is not null then
    if not exists (
      select 1 from public.profiles
      where profiles.school_id = target_school_id
        and profiles.id = p_teacher_profile_id
        and profiles.role = 'TEACHER'
        and profiles.is_active
    ) then
      raise exception 'active teacher not found' using errcode = '23503';
    end if;

    insert into public.group_teachers (
      school_id,
      group_id,
      teacher_profile_id,
      assignment_type
    ) values (
      target_school_id,
      p_group_id,
      p_teacher_profile_id,
      'PRIMARY'
    );
  end if;
end;
$$;

create function public.replace_teacher_group_assignments(
  p_teacher_profile_id uuid,
  p_group_ids uuid[]
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
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where profiles.school_id = target_school_id
      and profiles.id = p_teacher_profile_id
      and profiles.role = 'TEACHER'
  ) then
    raise exception 'teacher not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from unnest(p_group_ids) as requested(group_id)
    where not exists (
      select 1 from public.groups
      where groups.school_id = target_school_id
        and groups.id = requested.group_id
        and groups.is_active
    )
  ) then
    raise exception 'active group not found' using errcode = '23503';
  end if;

  delete from public.group_teachers
  where group_teachers.school_id = target_school_id
    and group_teachers.teacher_profile_id = p_teacher_profile_id;

  insert into public.group_teachers (
    school_id,
    group_id,
    teacher_profile_id,
    assignment_type
  )
  select target_school_id, requested.group_id, p_teacher_profile_id, 'PRIMARY'
  from unnest(p_group_ids) as requested(group_id)
  on conflict do nothing;
end;
$$;

create function public.update_teacher_administration(
  p_teacher_profile_id uuid,
  p_display_name text,
  p_preferred_language public.language_code,
  p_group_ids uuid[]
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
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  update public.profiles
  set display_name = trim(p_display_name),
      preferred_language = p_preferred_language
  where profiles.school_id = target_school_id
    and profiles.id = p_teacher_profile_id
    and profiles.role = 'TEACHER';

  if not found then
    raise exception 'teacher not found' using errcode = 'P0002';
  end if;

  perform public.replace_teacher_group_assignments(p_teacher_profile_id, p_group_ids);
end;
$$;

revoke all on function public.create_group_with_teacher(text, text, uuid, uuid) from public;
revoke all on function public.update_group_with_teacher(uuid, text, text, uuid, uuid) from public;
revoke all on function public.replace_teacher_group_assignments(uuid, uuid[]) from public;
revoke all on function public.update_teacher_administration(
  uuid,
  text,
  public.language_code,
  uuid[]
) from public;
grant execute on function public.create_group_with_teacher(text, text, uuid, uuid) to authenticated;
grant execute on function public.update_group_with_teacher(uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.replace_teacher_group_assignments(uuid, uuid[]) to authenticated;
grant execute on function public.update_teacher_administration(
  uuid,
  text,
  public.language_code,
  uuid[]
) to authenticated;

grant delete on public.group_teachers to authenticated;
create policy group_teachers_admin_delete on public.group_teachers
for delete to authenticated
using (school_id = public.current_school_id() and public.is_admin());
