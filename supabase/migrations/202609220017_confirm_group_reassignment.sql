create function public.update_group_with_teacher_confirmed(
  p_group_id uuid, p_name_en text, p_name_ar text,
  p_parent_group_id uuid, p_teacher_profile_id uuid,
  p_allow_reassignment boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_school_id uuid := public.current_school_id();
  current_teacher_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_allow_reassignment is null then
    raise exception 'invalid assignment request' using errcode = '22023';
  end if;
  perform 1 from public.groups g
  where g.school_id = target_school_id and g.id = p_group_id and g.is_active
  for update;
  if not found then
    raise exception 'active group not found' using errcode = 'P0002';
  end if;
  if p_teacher_profile_id is not null and not exists (
    select 1 from public.profiles p
    where p.school_id = target_school_id and p.id = p_teacher_profile_id
      and p.role in ('ADMIN', 'TEACHER') and p.is_active
  ) then
    raise exception 'active teaching profile not found' using errcode = '23503';
  end if;
  select gt.teacher_profile_id into current_teacher_id
  from public.group_teachers gt
  where gt.school_id = target_school_id and gt.group_id = p_group_id
    and gt.assignment_type = 'PRIMARY';
  if current_teacher_id is not null
    and current_teacher_id is distinct from p_teacher_profile_id
    and not p_allow_reassignment then
    raise exception 'primary teacher conflict' using errcode = '23505';
  end if;
  update public.groups g
  set name_en = trim(p_name_en), name_ar = nullif(trim(p_name_ar), ''),
      parent_group_id = p_parent_group_id
  where g.school_id = target_school_id and g.id = p_group_id;
  if current_teacher_id is distinct from p_teacher_profile_id then
    delete from public.group_teachers gt
    where gt.school_id = target_school_id and gt.group_id = p_group_id
      and gt.assignment_type = 'PRIMARY';
    if p_teacher_profile_id is not null then
      insert into public.group_teachers (school_id, group_id, teacher_profile_id, assignment_type)
      values (target_school_id, p_group_id, p_teacher_profile_id, 'PRIMARY');
    end if;
  end if;
end;
$$;

create or replace function public.update_group_with_teacher(
  p_group_id uuid, p_name_en text, p_name_ar text,
  p_parent_group_id uuid, p_teacher_profile_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.update_group_with_teacher_confirmed(
    p_group_id, p_name_en, p_name_ar, p_parent_group_id,
    p_teacher_profile_id, false
  );
end;
$$;

revoke all on function public.update_group_with_teacher_confirmed(uuid, text, text, uuid, uuid, boolean) from public;
grant execute on function public.update_group_with_teacher_confirmed(uuid, text, text, uuid, uuid, boolean) to authenticated;
