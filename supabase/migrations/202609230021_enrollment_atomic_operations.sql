-- Task 5: atomic Class enrollment, Subject participation, and per-Subject Group mutations.
-- Migrations 1-20 remain immutable.

create function public.create_student_with_enrollment(
  p_first_name_en text,
  p_last_name_en text,
  p_first_name_ar text,
  p_last_name_ar text,
  p_guardian_name text,
  p_guardian_email text,
  p_report_language public.report_language,
  p_class_id uuid,
  p_starts_on date,
  p_subject_preferences jsonb
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
  class_subject_row record;
  preference jsonb;
  included boolean;
  requested_group_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_starts_on is null then
    raise exception 'enrollment start date is required' using errcode = '22023';
  end if;

  if p_subject_preferences is not null
     and jsonb_typeof(p_subject_preferences) <> 'array' then
    raise exception 'subject preferences must be an array' using errcode = '22023';
  end if;

  perform 1
  from public.classes c
  where c.school_id = target_school_id
    and c.id = p_class_id
    and c.is_active
  for update;

  if not found then
    raise exception 'active class not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_subject_preferences, '[]'::jsonb)) item
    where nullif(item ->> 'classSubjectId', '') is null
       or not exists (
         select 1
         from public.class_subjects cs
         where cs.school_id = target_school_id
           and cs.class_id = p_class_id
           and cs.id = (item ->> 'classSubjectId')::uuid
           and cs.is_active
       )
  ) then
    raise exception 'active class subject not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_subject_preferences, '[]'::jsonb)) item
    group by item ->> 'classSubjectId'
    having count(*) > 1
  ) then
    raise exception 'duplicate subject preference' using errcode = '22023';
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

  select g.id
    into target_guardian_id
  from public.guardians g
  where g.school_id = target_school_id
    and g.email = lower(trim(p_guardian_email));

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

  insert into public.class_enrollments (
    school_id,
    class_id,
    student_id,
    starts_on
  ) values (
    target_school_id,
    p_class_id,
    new_student_id,
    p_starts_on
  );

  for class_subject_row in
    select cs.id, cs.default_group_id
    from public.class_subjects cs
    where cs.school_id = target_school_id
      and cs.class_id = p_class_id
      and cs.is_active
    order by cs.id
  loop
    preference := null;
    select item
      into preference
    from jsonb_array_elements(coalesce(p_subject_preferences, '[]'::jsonb)) item
    where item ->> 'classSubjectId' = class_subject_row.id::text
    limit 1;

    included := true;
    requested_group_id := null;

    if preference is not null then
      if preference ? 'included' then
        included := coalesce((preference ->> 'included')::boolean, true);
      end if;
      if nullif(preference ->> 'groupId', '') is not null then
        requested_group_id := (preference ->> 'groupId')::uuid;
      end if;
    end if;

    if not included then
      insert into public.subject_exclusions (
        school_id,
        class_subject_id,
        student_id,
        starts_on
      ) values (
        target_school_id,
        class_subject_row.id,
        new_student_id,
        p_starts_on
      );
      continue;
    end if;

    requested_group_id := coalesce(requested_group_id, class_subject_row.default_group_id);

    if requested_group_id is not null then
      if not exists (
        select 1
        from public.subject_groups sg
        where sg.school_id = target_school_id
          and sg.class_subject_id = class_subject_row.id
          and sg.id = requested_group_id
          and sg.is_active
      ) then
        raise exception 'active subject group not found' using errcode = '23503';
      end if;

      insert into public.subject_group_memberships (
        school_id,
        class_subject_id,
        subject_group_id,
        student_id,
        starts_on
      ) values (
        target_school_id,
        class_subject_row.id,
        requested_group_id,
        new_student_id,
        p_starts_on
      );
    end if;
  end loop;

  return new_student_id;
end;
$$;

create function public.move_student_subject_group(
  p_student_id uuid,
  p_class_subject_id uuid,
  p_target_group_id uuid,
  p_starts_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_class_id uuid;
  current_membership public.subject_group_memberships%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_starts_on is null then
    raise exception 'group move date is required' using errcode = '22023';
  end if;

  perform 1
  from public.students s
  where s.school_id = target_school_id
    and s.id = p_student_id
    and s.is_active
  for update;

  if not found then
    raise exception 'active student not found' using errcode = '23503';
  end if;

  select cs.class_id
    into target_class_id
  from public.class_subjects cs
  join public.classes c
    on c.school_id = cs.school_id
   and c.id = cs.class_id
  where cs.school_id = target_school_id
    and cs.id = p_class_subject_id
    and cs.is_active
    and c.is_active
  for update of cs;

  if target_class_id is null then
    raise exception 'active class subject not found' using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.class_enrollments ce
    where ce.school_id = target_school_id
      and ce.student_id = p_student_id
      and ce.class_id = target_class_id
      and ce.starts_on <= p_starts_on
      and (ce.ends_on is null or ce.ends_on >= p_starts_on)
  ) then
    raise exception 'student is not enrolled in this class' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.subject_exclusions se
    where se.school_id = target_school_id
      and se.student_id = p_student_id
      and se.class_subject_id = p_class_subject_id
      and se.starts_on <= p_starts_on
      and (se.ends_on is null or se.ends_on >= p_starts_on)
  ) then
    raise exception 'student is excluded from this subject' using errcode = '22023';
  end if;

  perform 1
  from public.subject_groups sg
  where sg.school_id = target_school_id
    and sg.class_subject_id = p_class_subject_id
    and sg.id = p_target_group_id
    and sg.is_active;

  if not found then
    raise exception 'active subject group not found' using errcode = '23503';
  end if;

  select sgm.*
    into current_membership
  from public.subject_group_memberships sgm
  where sgm.school_id = target_school_id
    and sgm.student_id = p_student_id
    and sgm.class_subject_id = p_class_subject_id
    and sgm.ends_on is null
  order by sgm.starts_on desc
  limit 1
  for update;

  if current_membership.id is not null then
    if current_membership.subject_group_id = p_target_group_id then
      raise exception 'student is already in this subject group' using errcode = '22023';
    end if;
    if p_starts_on < current_membership.starts_on then
      raise exception 'group move date precedes current membership' using errcode = '22023';
    end if;

    if p_starts_on = current_membership.starts_on then
      update public.subject_group_memberships sgm
      set subject_group_id = p_target_group_id
      where sgm.school_id = target_school_id
        and sgm.id = current_membership.id;
      return;
    end if;

    update public.subject_group_memberships sgm
    set ends_on = p_starts_on - 1
    where sgm.school_id = target_school_id
      and sgm.id = current_membership.id;
  end if;

  insert into public.subject_group_memberships (
    school_id,
    class_subject_id,
    subject_group_id,
    student_id,
    starts_on
  ) values (
    target_school_id,
    p_class_subject_id,
    p_target_group_id,
    p_student_id,
    p_starts_on
  );
end;
$$;

create function public.set_student_subject_excluded(
  p_student_id uuid,
  p_class_subject_id uuid,
  p_excluded boolean,
  p_effective_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_class_id uuid;
  target_default_group_id uuid;
  current_exclusion public.subject_exclusions%rowtype;
  current_membership public.subject_group_memberships%rowtype;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_effective_on is null then
    raise exception 'subject change date is required' using errcode = '22023';
  end if;

  perform 1
  from public.students s
  where s.school_id = target_school_id
    and s.id = p_student_id
    and s.is_active
  for update;

  if not found then
    raise exception 'active student not found' using errcode = '23503';
  end if;

  select cs.class_id, cs.default_group_id
    into target_class_id, target_default_group_id
  from public.class_subjects cs
  join public.classes c
    on c.school_id = cs.school_id
   and c.id = cs.class_id
  where cs.school_id = target_school_id
    and cs.id = p_class_subject_id
    and cs.is_active
    and c.is_active
  for update of cs;

  if target_class_id is null then
    raise exception 'active class subject not found' using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.class_enrollments ce
    where ce.school_id = target_school_id
      and ce.student_id = p_student_id
      and ce.class_id = target_class_id
      and ce.starts_on <= p_effective_on
      and (ce.ends_on is null or ce.ends_on >= p_effective_on)
  ) then
    raise exception 'student is not enrolled in this class' using errcode = '22023';
  end if;

  select se.*
    into current_exclusion
  from public.subject_exclusions se
  where se.school_id = target_school_id
    and se.student_id = p_student_id
    and se.class_subject_id = p_class_subject_id
    and se.ends_on is null
  order by se.starts_on desc
  limit 1
  for update;

  if p_excluded then
    if current_exclusion.id is not null then
      raise exception 'student is already excluded from this subject' using errcode = '22023';
    end if;

    select sgm.*
      into current_membership
    from public.subject_group_memberships sgm
    where sgm.school_id = target_school_id
      and sgm.student_id = p_student_id
      and sgm.class_subject_id = p_class_subject_id
      and sgm.ends_on is null
    order by sgm.starts_on desc
    limit 1
    for update;

    if current_membership.id is not null then
      if p_effective_on < current_membership.starts_on then
        raise exception 'subject exclusion date precedes current group membership' using errcode = '22023';
      elsif p_effective_on = current_membership.starts_on then
        delete from public.subject_group_memberships sgm
        where sgm.school_id = target_school_id
          and sgm.id = current_membership.id;
      else
        update public.subject_group_memberships sgm
        set ends_on = p_effective_on - 1
        where sgm.school_id = target_school_id
          and sgm.id = current_membership.id;
      end if;
    end if;

    insert into public.subject_exclusions (
      school_id,
      class_subject_id,
      student_id,
      starts_on
    ) values (
      target_school_id,
      p_class_subject_id,
      p_student_id,
      p_effective_on
    );
    return;
  end if;

  if current_exclusion.id is null then
    raise exception 'student is not excluded from this subject' using errcode = '22023';
  end if;

  if p_effective_on < current_exclusion.starts_on then
    raise exception 'subject inclusion date precedes current exclusion' using errcode = '22023';
  elsif p_effective_on = current_exclusion.starts_on then
    delete from public.subject_exclusions se
    where se.school_id = target_school_id
      and se.id = current_exclusion.id;
  else
    update public.subject_exclusions se
    set ends_on = p_effective_on - 1
    where se.school_id = target_school_id
      and se.id = current_exclusion.id;
  end if;

  if target_default_group_id is not null
     and exists (
       select 1
       from public.subject_groups sg
       where sg.school_id = target_school_id
         and sg.class_subject_id = p_class_subject_id
         and sg.id = target_default_group_id
         and sg.is_active
     )
     and not exists (
       select 1
       from public.subject_group_memberships sgm
       where sgm.school_id = target_school_id
         and sgm.student_id = p_student_id
         and sgm.class_subject_id = p_class_subject_id
         and sgm.ends_on is null
     ) then
    insert into public.subject_group_memberships (
      school_id,
      class_subject_id,
      subject_group_id,
      student_id,
      starts_on
    ) values (
      target_school_id,
      p_class_subject_id,
      target_default_group_id,
      p_student_id,
      p_effective_on
    );
  end if;
end;
$$;

create function public.change_student_class(
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
  current_enrollment public.class_enrollments%rowtype;
  class_subject_row record;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_starts_on is null then
    raise exception 'class change date is required' using errcode = '22023';
  end if;

  perform 1
  from public.students s
  where s.school_id = target_school_id
    and s.id = p_student_id
    and s.is_active
  for update;

  if not found then
    raise exception 'active student not found' using errcode = '23503';
  end if;

  perform 1
  from public.classes c
  where c.school_id = target_school_id
    and c.id = p_target_class_id
    and c.is_active
  for update;

  if not found then
    raise exception 'active target class not found' using errcode = '23503';
  end if;

  select ce.*
    into current_enrollment
  from public.class_enrollments ce
  where ce.school_id = target_school_id
    and ce.student_id = p_student_id
    and ce.ends_on is null
  order by ce.starts_on desc
  limit 1
  for update;

  if current_enrollment.id is null then
    raise exception 'active class enrollment not found' using errcode = 'P0002';
  end if;

  if current_enrollment.class_id = p_target_class_id then
    raise exception 'student is already in this class' using errcode = '22023';
  end if;

  if p_starts_on <= current_enrollment.starts_on then
    raise exception 'class change date must follow current enrollment start' using errcode = '22023';
  end if;

  update public.class_enrollments ce
  set ends_on = p_starts_on - 1
  where ce.school_id = target_school_id
    and ce.id = current_enrollment.id;

  update public.subject_group_memberships sgm
  set ends_on = p_starts_on - 1
  where sgm.school_id = target_school_id
    and sgm.student_id = p_student_id
    and sgm.ends_on is null
    and sgm.starts_on < p_starts_on
    and exists (
      select 1
      from public.class_subjects cs
      where cs.school_id = target_school_id
        and cs.id = sgm.class_subject_id
        and cs.class_id = current_enrollment.class_id
    );

  delete from public.subject_group_memberships sgm
  where sgm.school_id = target_school_id
    and sgm.student_id = p_student_id
    and sgm.ends_on is null
    and sgm.starts_on >= p_starts_on
    and exists (
      select 1
      from public.class_subjects cs
      where cs.school_id = target_school_id
        and cs.id = sgm.class_subject_id
        and cs.class_id = current_enrollment.class_id
    );

  update public.subject_exclusions se
  set ends_on = p_starts_on - 1
  where se.school_id = target_school_id
    and se.student_id = p_student_id
    and se.ends_on is null
    and se.starts_on < p_starts_on
    and exists (
      select 1
      from public.class_subjects cs
      where cs.school_id = target_school_id
        and cs.id = se.class_subject_id
        and cs.class_id = current_enrollment.class_id
    );

  delete from public.subject_exclusions se
  where se.school_id = target_school_id
    and se.student_id = p_student_id
    and se.ends_on is null
    and se.starts_on >= p_starts_on
    and exists (
      select 1
      from public.class_subjects cs
      where cs.school_id = target_school_id
        and cs.id = se.class_subject_id
        and cs.class_id = current_enrollment.class_id
    );

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

  for class_subject_row in
    select cs.id, cs.default_group_id
    from public.class_subjects cs
    where cs.school_id = target_school_id
      and cs.class_id = p_target_class_id
      and cs.is_active
    order by cs.id
  loop
    if class_subject_row.default_group_id is not null
       and exists (
         select 1
         from public.subject_groups sg
         where sg.school_id = target_school_id
           and sg.class_subject_id = class_subject_row.id
           and sg.id = class_subject_row.default_group_id
           and sg.is_active
       ) then
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

revoke all on function public.create_student_with_enrollment(
  text,
  text,
  text,
  text,
  text,
  text,
  public.report_language,
  uuid,
  date,
  jsonb
) from public;
revoke execute on function public.create_student_with_enrollment(
  text,
  text,
  text,
  text,
  text,
  text,
  public.report_language,
  uuid,
  date,
  jsonb
) from anon;
grant execute on function public.create_student_with_enrollment(
  text,
  text,
  text,
  text,
  text,
  text,
  public.report_language,
  uuid,
  date,
  jsonb
) to authenticated;

revoke all on function public.change_student_class(uuid, uuid, date) from public;
revoke execute on function public.change_student_class(uuid, uuid, date) from anon;
grant execute on function public.change_student_class(uuid, uuid, date) to authenticated;

revoke all on function public.set_student_subject_excluded(uuid, uuid, boolean, date) from public;
revoke execute on function public.set_student_subject_excluded(uuid, uuid, boolean, date) from anon;
grant execute on function public.set_student_subject_excluded(uuid, uuid, boolean, date) to authenticated;

revoke all on function public.move_student_subject_group(uuid, uuid, uuid, date) from public;
revoke execute on function public.move_student_subject_group(uuid, uuid, uuid, date) from anon;
grant execute on function public.move_student_subject_group(uuid, uuid, uuid, date) to authenticated;
