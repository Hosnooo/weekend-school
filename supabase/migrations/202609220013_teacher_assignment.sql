-- Keep the original RPC signatures; applied migrations are immutable.
create or replace function public.create_group_with_teacher(
  p_name_en text, p_name_ar text, p_parent_group_id uuid, p_teacher_profile_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target_school_id uuid := public.current_school_id();
  new_group_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_teacher_profile_id is not null and not exists (
    select 1 from public.profiles p
    where p.school_id = target_school_id and p.id = p_teacher_profile_id
      and p.role in ('ADMIN', 'TEACHER') and p.is_active
  ) then
    raise exception 'active teaching profile not found' using errcode = '23503';
  end if;
  insert into public.groups (school_id, name_en, name_ar, parent_group_id)
  values (target_school_id, trim(p_name_en), nullif(trim(p_name_ar), ''), p_parent_group_id)
  returning id into new_group_id;
  if p_teacher_profile_id is not null then
    insert into public.group_teachers (school_id, group_id, teacher_profile_id, assignment_type)
    values (target_school_id, new_group_id, p_teacher_profile_id, 'PRIMARY');
  end if;
  return new_group_id;
end;
$$;

create or replace function public.update_group_with_teacher(
  p_group_id uuid, p_name_en text, p_name_ar text,
  p_parent_group_id uuid, p_teacher_profile_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_school_id uuid := public.current_school_id();
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_teacher_profile_id is not null and not exists (
    select 1 from public.profiles p
    where p.school_id = target_school_id and p.id = p_teacher_profile_id
      and p.role in ('ADMIN', 'TEACHER') and p.is_active
  ) then
    raise exception 'active teaching profile not found' using errcode = '23503';
  end if;
  update public.groups g
  set name_en = trim(p_name_en), name_ar = nullif(trim(p_name_ar), ''),
      parent_group_id = p_parent_group_id
  where g.school_id = target_school_id and g.id = p_group_id;
  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  delete from public.group_teachers gt
  where gt.school_id = target_school_id and gt.group_id = p_group_id
    and gt.assignment_type = 'PRIMARY'
    and (p_teacher_profile_id is null or gt.teacher_profile_id <> p_teacher_profile_id);
  if p_teacher_profile_id is not null and not exists (
    select 1 from public.group_teachers gt
    where gt.school_id = target_school_id and gt.group_id = p_group_id
      and gt.teacher_profile_id = p_teacher_profile_id and gt.assignment_type = 'PRIMARY'
  ) then
    insert into public.group_teachers (school_id, group_id, teacher_profile_id, assignment_type)
    values (target_school_id, p_group_id, p_teacher_profile_id, 'PRIMARY');
  end if;
end;
$$;

create function public.replace_teacher_group_assignments_confirmed(
  p_teacher_profile_id uuid, p_group_ids uuid[], p_allow_reassignment boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_school_id uuid := public.current_school_id();
  requested_group_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_group_ids is null or p_allow_reassignment is null then
    raise exception 'invalid assignment request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.school_id = target_school_id and p.id = p_teacher_profile_id
      and p.role in ('ADMIN', 'TEACHER') and p.is_active
  ) then
    raise exception 'active teaching profile not found' using errcode = '23503';
  end if;
  -- Lock in stable order: two concurrent admins cannot silently overwrite each other.
  for requested_group_id in
    select distinct requested.group_id from unnest(p_group_ids) as requested(group_id)
    order by requested.group_id
  loop
    if requested_group_id is null then
      raise exception 'active group not found' using errcode = '23503';
    end if;
    perform 1 from public.groups g
    where g.school_id = target_school_id and g.id = requested_group_id and g.is_active
    for update;
    if not found then
      raise exception 'active group not found' using errcode = '23503';
    end if;
  end loop;
  if not p_allow_reassignment and exists (
    select 1 from public.group_teachers gt
    where gt.school_id = target_school_id and gt.assignment_type = 'PRIMARY'
      and gt.group_id = any(p_group_ids)
      and gt.teacher_profile_id <> p_teacher_profile_id
  ) then
    raise exception 'primary teacher conflict' using errcode = '23505';
  end if;
  if p_allow_reassignment then
    delete from public.group_teachers gt
    where gt.school_id = target_school_id and gt.assignment_type = 'PRIMARY'
      and gt.group_id = any(p_group_ids)
      and gt.teacher_profile_id <> p_teacher_profile_id;
  end if;
  delete from public.group_teachers gt
  where gt.school_id = target_school_id and gt.assignment_type = 'PRIMARY'
    and gt.teacher_profile_id = p_teacher_profile_id
    and not (gt.group_id = any(p_group_ids));
  insert into public.group_teachers (school_id, group_id, teacher_profile_id, assignment_type)
  select target_school_id, requested.group_id, p_teacher_profile_id, 'PRIMARY'
  from (select distinct unnest(p_group_ids) as group_id) requested
  where not exists (
    select 1 from public.group_teachers gt
    where gt.school_id = target_school_id and gt.group_id = requested.group_id
      and gt.teacher_profile_id = p_teacher_profile_id and gt.assignment_type = 'PRIMARY'
  );
end;
$$;

create or replace function public.replace_teacher_group_assignments(
  p_teacher_profile_id uuid, p_group_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.replace_teacher_group_assignments_confirmed(
    p_teacher_profile_id, p_group_ids, false
  );
end;
$$;

create function public.update_teacher_administration_confirmed(
  p_teacher_profile_id uuid, p_display_name text,
  p_preferred_language public.language_code, p_group_ids uuid[],
  p_allow_reassignment boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_school_id uuid := public.current_school_id();
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  update public.profiles p
  set display_name = trim(p_display_name), preferred_language = p_preferred_language
  where p.school_id = target_school_id and p.id = p_teacher_profile_id
    and p.role in ('ADMIN', 'TEACHER') and p.is_active;
  if not found then
    raise exception 'active teaching profile not found' using errcode = 'P0002';
  end if;
  perform public.replace_teacher_group_assignments_confirmed(
    p_teacher_profile_id, p_group_ids, p_allow_reassignment
  );
end;
$$;

create or replace function public.update_teacher_administration(
  p_teacher_profile_id uuid, p_display_name text,
  p_preferred_language public.language_code, p_group_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.update_teacher_administration_confirmed(
    p_teacher_profile_id, p_display_name, p_preferred_language, p_group_ids, false
  );
end;
$$;

revoke all on function public.replace_teacher_group_assignments_confirmed(uuid, uuid[], boolean) from public;
revoke all on function public.update_teacher_administration_confirmed(uuid, text, public.language_code, uuid[], boolean) from public;
grant execute on function public.replace_teacher_group_assignments_confirmed(uuid, uuid[], boolean) to authenticated;
grant execute on function public.update_teacher_administration_confirmed(uuid, text, public.language_code, uuid[], boolean) to authenticated;
