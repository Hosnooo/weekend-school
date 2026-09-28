-- Subject-only Teacher authority and Teacher-managed Subject Groups.
--
-- Historical teaching_assignments.subject_group_id values are preserved.
-- Effective authorization ignores that historical Group scope and treats any
-- dated assignment as authority over the whole Class Subject.
--
-- New supported assignment creation is Subject-only.

-------------------------------------------------------------------------------
-- Effective Teacher authorization
-------------------------------------------------------------------------------

create or replace function public.teacher_can_teach_context(
  p_profile_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_on_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with candidate_teachers as (
    select teacher.school_id, teacher.id as teacher_id
    from public.teachers teacher
    where teacher.id = p_profile_id
      and teacher.is_active

    union

    select teacher.school_id, teacher.id
    from public.teacher_accounts account_link
    join public.teachers teacher
      on teacher.school_id = account_link.school_id
     and teacher.id = account_link.teacher_id
    join public.profiles profile
      on profile.school_id = account_link.school_id
     and profile.id = account_link.profile_id
    where account_link.profile_id = p_profile_id
      and profile.is_active
      and teacher.is_active
  )
  select exists (
    select 1
    from public.class_subjects class_subject
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    join candidate_teachers candidate
      on candidate.school_id = class_subject.school_id
    where class_subject.id = p_class_subject_id
      and class_subject.is_active
      and class_row.is_active
      and (
        auth.uid() is null
        or (
          class_subject.school_id = public.current_school_id()
          and candidate.teacher_id in (
            select public.current_teacher_ids()
          )
        )
      )
      -- Group remains a structural/organizational context, not a permission
      -- boundary. If supplied, it must still belong to this Class Subject.
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
          and assignment.teacher_id = candidate.teacher_id
          and assignment.class_subject_id = class_subject.id
          and assignment.starts_on <= p_on_date
          and (
            assignment.ends_on is null
            or assignment.ends_on >= p_on_date
          )
          -- Intentionally do not inspect assignment.subject_group_id.
          -- Historical Group-scoped rows grant Subject-wide authority.
      )
  )
$$;

create or replace function public.teacher_can_teach_period_context(
  p_teacher_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_period_start date,
  p_period_end date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_period_start is not null
    and p_period_end is not null
    and p_period_end >= p_period_start
    and exists (
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
          or teacher.id in (
            select public.current_teacher_ids()
          )
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
            and assignment.starts_on <= p_period_end
            and (
              assignment.ends_on is null
              or assignment.ends_on >= p_period_start
            )
        )
    )
$$;

revoke all
on function public.teacher_can_teach_period_context(
  uuid, uuid, uuid, date, date
)
from public;

revoke execute
on function public.teacher_can_teach_period_context(
  uuid, uuid, uuid, date, date
)
from anon;

grant execute
on function public.teacher_can_teach_period_context(
  uuid, uuid, uuid, date, date
)
to authenticated;

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
  select public.teacher_can_teach_period_context(
    p_teacher_id,
    p_class_subject_id,
    p_subject_group_id,
    p_week_start,
    p_week_start + 6
  )
$$;

revoke all
on function public.teacher_can_teach_week_context(
  uuid, uuid, uuid, date
)
from public;

revoke execute
on function public.teacher_can_teach_week_context(
  uuid, uuid, uuid, date
)
from anon;

grant execute
on function public.teacher_can_teach_week_context(
  uuid, uuid, uuid, date
)
to authenticated;

-- Student visibility follows Class Subject authority, never historical
-- assignment.subject_group_id.
create or replace function public.current_teacher_can_access_student(
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
    from public.teaching_assignments assignment
    join public.class_subjects class_subject
      on class_subject.school_id = assignment.school_id
     and class_subject.id = assignment.class_subject_id
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    where assignment.school_id = public.current_school_id()
      and assignment.teacher_id in (
        select public.current_teacher_ids()
      )
      and assignment.starts_on <= p_on_date
      and (
        assignment.ends_on is null
        or assignment.ends_on >= p_on_date
      )
      and class_subject.is_active
      and class_row.is_active
      and public.student_participates_in_class_subject(
        p_student_id,
        assignment.class_subject_id,
        p_on_date
      )
  )
$$;

-------------------------------------------------------------------------------
-- Supported Subject-only assignment creation
-------------------------------------------------------------------------------

create or replace function public.save_teaching_assignment(
  p_teacher_id uuid,
  p_class_subject_id uuid,
  p_starts_on date,
  p_ends_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  new_assignment_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  if p_starts_on is null then
    raise exception 'assignment start date is required'
      using errcode = '23514';
  end if;

  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'assignment end date cannot be before start date'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.teachers teacher
    where teacher.school_id = target_school_id
      and teacher.id = p_teacher_id
      and teacher.is_active
  ) then
    raise exception 'active teacher not found'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.class_subjects class_subject
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    join public.subjects subject
      on subject.school_id = class_subject.school_id
     and subject.id = class_subject.subject_id
    where class_subject.school_id = target_school_id
      and class_subject.id = p_class_subject_id
      and class_subject.is_active
      and class_row.is_active
      and subject.is_active
  ) then
    raise exception 'active Class Subject not found'
      using errcode = '23503';
  end if;

  insert into public.teaching_assignments (
    school_id,
    teacher_id,
    class_subject_id,
    subject_group_id,
    starts_on,
    ends_on
  )
  values (
    target_school_id,
    p_teacher_id,
    p_class_subject_id,
    null,
    p_starts_on,
    p_ends_on
  )
  returning id into new_assignment_id;

  return new_assignment_id;
end;
$$;

revoke all
on function public.save_teaching_assignment(
  uuid, uuid, date, date
)
from public;

revoke execute
on function public.save_teaching_assignment(
  uuid, uuid, date, date
)
from anon;

grant execute
on function public.save_teaching_assignment(
  uuid, uuid, date, date
)
to authenticated;

-------------------------------------------------------------------------------
-- Teacher Group management
-------------------------------------------------------------------------------

create or replace function public.teacher_create_subject_group(
  p_class_subject_id uuid,
  p_name_en text,
  p_name_ar text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_on_date date;
  new_group_id uuid;
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  select (now() at time zone school.timezone)::date
  into target_on_date
  from public.schools school
  where school.id = target_school_id;

  if not exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_context(
      teacher_id,
      p_class_subject_id,
      null,
      target_on_date
    )
  ) then
    raise exception 'assigned Class Subject required'
      using errcode = '42501';
  end if;

  insert into public.subject_groups (
    school_id,
    class_subject_id,
    name_en,
    name_ar
  )
  values (
    target_school_id,
    p_class_subject_id,
    trim(p_name_en),
    nullif(trim(p_name_ar), '')
  )
  returning id into new_group_id;

  return new_group_id;
end;
$$;

create or replace function public.teacher_rename_subject_group(
  p_subject_group_id uuid,
  p_name_en text,
  p_name_ar text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_class_subject_id uuid;
  target_on_date date;
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  select subject_group.class_subject_id
  into target_class_subject_id
  from public.subject_groups subject_group
  where subject_group.school_id = target_school_id
    and subject_group.id = p_subject_group_id
  for update;

  if not found then
    raise exception 'Subject Group not found'
      using errcode = 'P0002';
  end if;

  select (now() at time zone school.timezone)::date
  into target_on_date
  from public.schools school
  where school.id = target_school_id;

  if not exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_context(
      teacher_id,
      target_class_subject_id,
      null,
      target_on_date
    )
  ) then
    raise exception 'assigned Class Subject required'
      using errcode = '42501';
  end if;

  update public.subject_groups
  set
    name_en = trim(p_name_en),
    name_ar = nullif(trim(p_name_ar), '')
  where school_id = target_school_id
    and id = p_subject_group_id;

  return true;
end;
$$;

create or replace function public.teacher_archive_subject_group(
  p_subject_group_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_class_subject_id uuid;
  target_on_date date;
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  select subject_group.class_subject_id
  into target_class_subject_id
  from public.subject_groups subject_group
  where subject_group.school_id = target_school_id
    and subject_group.id = p_subject_group_id
  for update;

  if not found then
    raise exception 'Subject Group not found'
      using errcode = 'P0002';
  end if;

  select (now() at time zone school.timezone)::date
  into target_on_date
  from public.schools school
  where school.id = target_school_id;

  if not exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_context(
      teacher_id,
      target_class_subject_id,
      null,
      target_on_date
    )
  ) then
    raise exception 'assigned Class Subject required'
      using errcode = '42501';
  end if;

  update public.subject_groups
  set is_active = false
  where school_id = target_school_id
    and id = p_subject_group_id;

  return true;
end;
$$;

create or replace function public.teacher_restore_subject_group(
  p_subject_group_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_class_subject_id uuid;
  target_on_date date;
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  select subject_group.class_subject_id
  into target_class_subject_id
  from public.subject_groups subject_group
  where subject_group.school_id = target_school_id
    and subject_group.id = p_subject_group_id
  for update;

  if not found then
    raise exception 'Subject Group not found'
      using errcode = 'P0002';
  end if;

  select (now() at time zone school.timezone)::date
  into target_on_date
  from public.schools school
  where school.id = target_school_id;

  if not exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_context(
      teacher_id,
      target_class_subject_id,
      null,
      target_on_date
    )
  ) then
    raise exception 'assigned Class Subject required'
      using errcode = '42501';
  end if;

  update public.subject_groups
  set is_active = true
  where school_id = target_school_id
    and id = p_subject_group_id;

  return true;
end;
$$;

-------------------------------------------------------------------------------
-- Dated student movement between Subject Groups
-------------------------------------------------------------------------------

create or replace function public.teacher_move_subject_group_student(
  p_class_subject_id uuid,
  p_student_id uuid,
  p_subject_group_id uuid,
  p_on_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  current_membership public.subject_group_memberships%rowtype;
  new_membership_id uuid;
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  if p_on_date is null then
    raise exception 'movement date is required'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_context(
      teacher_id,
      p_class_subject_id,
      null,
      p_on_date
    )
  ) then
    raise exception 'assigned Class Subject required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.subject_groups subject_group
    where subject_group.school_id = target_school_id
      and subject_group.class_subject_id = p_class_subject_id
      and subject_group.id = p_subject_group_id
      and subject_group.is_active
  ) then
    raise exception 'active Subject Group not found'
      using errcode = '23503';
  end if;

  if not public.student_participates_in_class_subject(
    p_student_id,
    p_class_subject_id,
    p_on_date
  ) then
    raise exception 'student is not active in this Class Subject'
      using errcode = '42501';
  end if;

  select membership.*
  into current_membership
  from public.subject_group_memberships membership
  where membership.school_id = target_school_id
    and membership.class_subject_id = p_class_subject_id
    and membership.student_id = p_student_id
    and membership.starts_on <= p_on_date
    and (
      membership.ends_on is null
      or membership.ends_on >= p_on_date
    )
  order by membership.starts_on desc
  limit 1
  for update;

  if found
    and current_membership.subject_group_id = p_subject_group_id
  then
    return current_membership.id;
  end if;

  if found then
    if current_membership.starts_on >= p_on_date then
      raise exception
        'student Group cannot be changed twice on the same effective date'
        using errcode = '23514';
    end if;

    update public.subject_group_memberships
    set ends_on = p_on_date - 1
    where school_id = target_school_id
      and id = current_membership.id;
  end if;

  insert into public.subject_group_memberships (
    school_id,
    class_subject_id,
    subject_group_id,
    student_id,
    starts_on
  )
  values (
    target_school_id,
    p_class_subject_id,
    p_subject_group_id,
    p_student_id,
    p_on_date
  )
  returning id into new_membership_id;

  return new_membership_id;
end;
$$;

create or replace function public.teacher_remove_subject_group_student(
  p_class_subject_id uuid,
  p_student_id uuid,
  p_on_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  current_membership public.subject_group_memberships%rowtype;
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  if p_on_date is null then
    raise exception 'movement date is required'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_context(
      teacher_id,
      p_class_subject_id,
      null,
      p_on_date
    )
  ) then
    raise exception 'assigned Class Subject required'
      using errcode = '42501';
  end if;

  select membership.*
  into current_membership
  from public.subject_group_memberships membership
  where membership.school_id = target_school_id
    and membership.class_subject_id = p_class_subject_id
    and membership.student_id = p_student_id
    and membership.starts_on <= p_on_date
    and (
      membership.ends_on is null
      or membership.ends_on >= p_on_date
    )
  order by membership.starts_on desc
  limit 1
  for update;

  if not found then
    return true;
  end if;

  if current_membership.starts_on >= p_on_date then
    raise exception
      'student Group cannot be removed on its membership start date'
      using errcode = '23514';
  end if;

  update public.subject_group_memberships
  set ends_on = p_on_date - 1
  where school_id = target_school_id
    and id = current_membership.id;

  return true;
end;
$$;

-------------------------------------------------------------------------------
-- RPC permissions
-------------------------------------------------------------------------------

revoke all on function public.teacher_create_subject_group(
  uuid, text, text
) from public;
revoke execute on function public.teacher_create_subject_group(
  uuid, text, text
) from anon;
grant execute on function public.teacher_create_subject_group(
  uuid, text, text
) to authenticated;

revoke all on function public.teacher_rename_subject_group(
  uuid, text, text
) from public;
revoke execute on function public.teacher_rename_subject_group(
  uuid, text, text
) from anon;
grant execute on function public.teacher_rename_subject_group(
  uuid, text, text
) to authenticated;

revoke all on function public.teacher_archive_subject_group(
  uuid
) from public;
revoke execute on function public.teacher_archive_subject_group(
  uuid
) from anon;
grant execute on function public.teacher_archive_subject_group(
  uuid
) to authenticated;

revoke all on function public.teacher_restore_subject_group(
  uuid
) from public;
revoke execute on function public.teacher_restore_subject_group(
  uuid
) from anon;
grant execute on function public.teacher_restore_subject_group(
  uuid
) to authenticated;

revoke all on function public.teacher_move_subject_group_student(
  uuid, uuid, uuid, date
) from public;
revoke execute on function public.teacher_move_subject_group_student(
  uuid, uuid, uuid, date
) from anon;
grant execute on function public.teacher_move_subject_group_student(
  uuid, uuid, uuid, date
) to authenticated;

revoke all on function public.teacher_remove_subject_group_student(
  uuid, uuid, date
) from public;
revoke execute on function public.teacher_remove_subject_group_student(
  uuid, uuid, date
) from anon;
grant execute on function public.teacher_remove_subject_group_student(
  uuid, uuid, date
) to authenticated;

-------------------------------------------------------------------------------
-- Prepare lifecycle enum for the flexible-update migration.
--
-- Do not use DISMISSED in this migration. PostgreSQL may require the enum
-- addition to commit before the new value is used by subsequent statements.
-------------------------------------------------------------------------------

alter type public.session_status
  add value if not exists 'DISMISSED';
