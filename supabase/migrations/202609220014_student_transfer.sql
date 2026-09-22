-- A student can have one effective group on any calendar date.
alter table public.group_memberships
  add constraint group_memberships_one_group_per_student
  exclude using gist (
    school_id with =,
    student_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  );

create function public.move_student_group(
  p_student_id uuid, p_target_group_id uuid, p_starts_on date
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_school_id uuid := public.current_school_id();
  current_membership public.group_memberships%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_starts_on is null then
    raise exception 'transfer date is required' using errcode = '22023';
  end if;
  perform 1 from public.students s
  where s.school_id = target_school_id and s.id = p_student_id and s.is_active
  for update;
  if not found then
    raise exception 'active student not found' using errcode = '23503';
  end if;
  perform 1 from public.groups g
  where g.school_id = target_school_id and g.id = p_target_group_id and g.is_active;
  if not found then
    raise exception 'active group not found' using errcode = '23503';
  end if;

  select gm.* into current_membership
  from public.group_memberships gm
  where gm.school_id = target_school_id and gm.student_id = p_student_id
    and gm.ends_on is null
  order by gm.starts_on desc
  limit 1
  for update;

  if current_membership.id is not null then
    if current_membership.group_id = p_target_group_id then
      raise exception 'student is already in this group' using errcode = '22023';
    end if;
    if p_starts_on < current_membership.starts_on then
      raise exception 'transfer date precedes current membership' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.sessions s
      where s.school_id = target_school_id
        and s.group_id = current_membership.group_id
        and s.status = 'SUBMITTED'
        and s.session_date >= p_starts_on
    ) then
      raise exception 'submitted session depends on membership' using errcode = '55000';
    end if;
    if p_starts_on = current_membership.starts_on then
      update public.group_memberships gm
      set group_id = p_target_group_id
      where gm.school_id = target_school_id and gm.id = current_membership.id;
      return;
    end if;
    update public.group_memberships gm
    set ends_on = p_starts_on - 1
    where gm.school_id = target_school_id and gm.id = current_membership.id;
  end if;

  insert into public.group_memberships (school_id, group_id, student_id, starts_on)
  values (target_school_id, p_target_group_id, p_student_id, p_starts_on);
end;
$$;

revoke all on function public.move_student_group(uuid, uuid, date) from public;
grant execute on function public.move_student_group(uuid, uuid, date) to authenticated;
