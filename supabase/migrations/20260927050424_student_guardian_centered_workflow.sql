-- Student-centered Guardian workflow.
-- Existing migrations remain immutable.

alter table public.guardians
  add column phone text;

alter table public.guardians
  add constraint guardians_phone_nonblank
  check (phone is null or length(trim(phone)) > 0);

create function public.create_student_with_enrollment_v2(
  p_first_name_en text,
  p_last_name_en text,
  p_first_name_ar text,
  p_last_name_ar text,
  p_guardian_name text,
  p_guardian_email text,
  p_guardian_phone text,
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

  if nullif(trim(coalesce(p_guardian_email, '')), '') is not null then
    if nullif(trim(coalesce(p_guardian_name, '')), '') is null
       or nullif(trim(coalesce(p_guardian_phone, '')), '') is null then
      raise exception 'complete guardian details are required'
        using errcode = '22023';
    end if;

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
        phone,
        report_language
      ) values (
        target_school_id,
        trim(p_guardian_name),
        lower(trim(p_guardian_email)),
        trim(p_guardian_phone),
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
  elsif nullif(trim(coalesce(p_guardian_name, '')), '') is not null
     or nullif(trim(coalesce(p_guardian_phone, '')), '') is not null then
    raise exception 'complete guardian details are required'
      using errcode = '22023';
  end if;

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


create function public.link_student_guardian(
  p_student_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_report_language public.report_language,
  p_is_primary boolean,
  p_receives_reports boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_guardian_id uuid;
  first_link boolean;
  requested_primary boolean := coalesce(p_is_primary, false);
  requested_reports boolean := coalesce(p_receives_reports, true);
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null
     or nullif(trim(coalesce(p_email, '')), '') is null
     or nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'complete guardian details are required'
      using errcode = '22023';
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

  select g.id
    into target_guardian_id
  from public.guardians g
  where g.school_id = target_school_id
    and g.email = lower(trim(p_email))
  for update;

  if target_guardian_id is null then
    insert into public.guardians (
      school_id,
      name,
      email,
      phone,
      report_language
    ) values (
      target_school_id,
      trim(p_name),
      lower(trim(p_email)),
      trim(p_phone),
      p_report_language
    )
    returning id into target_guardian_id;
  end if;

  if exists (
    select 1
    from public.student_guardians sg
    where sg.school_id = target_school_id
      and sg.student_id = p_student_id
      and sg.guardian_id = target_guardian_id
  ) then
    raise exception 'guardian already linked to student'
      using errcode = '23505';
  end if;

  select not exists (
    select 1
    from public.student_guardians sg
    where sg.school_id = target_school_id
      and sg.student_id = p_student_id
  ) into first_link;

  if first_link then
    requested_primary := true;
    requested_reports := true;
  end if;

  if requested_primary then
    update public.student_guardians
    set is_primary = false
    where school_id = target_school_id
      and student_id = p_student_id
      and is_primary;
  end if;

  insert into public.student_guardians (
    school_id,
    student_id,
    guardian_id,
    receives_reports,
    is_primary
  ) values (
    target_school_id,
    p_student_id,
    target_guardian_id,
    requested_reports,
    requested_primary
  );

  return target_guardian_id;
end;
$$;

create function public.update_student_guardian_link(
  p_student_id uuid,
  p_guardian_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_report_language public.report_language,
  p_is_primary boolean,
  p_receives_reports boolean
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

  if nullif(trim(coalesce(p_name, '')), '') is null
     or nullif(trim(coalesce(p_email, '')), '') is null
     or nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'complete guardian details are required'
      using errcode = '22023';
  end if;

  perform 1
  from public.student_guardians sg
  where sg.school_id = target_school_id
    and sg.student_id = p_student_id
    and sg.guardian_id = p_guardian_id
  for update;

  if not found then
    raise exception 'guardian link not found' using errcode = 'P0002';
  end if;

  update public.guardians
  set name = trim(p_name),
      email = lower(trim(p_email)),
      phone = trim(p_phone),
      report_language = p_report_language
  where school_id = target_school_id
    and id = p_guardian_id;

  if coalesce(p_is_primary, false) then
    update public.student_guardians
    set is_primary = false
    where school_id = target_school_id
      and student_id = p_student_id
      and guardian_id <> p_guardian_id
      and is_primary;
  end if;

  update public.student_guardians
  set is_primary = coalesce(p_is_primary, false),
      receives_reports = coalesce(p_receives_reports, false)
  where school_id = target_school_id
    and student_id = p_student_id
    and guardian_id = p_guardian_id;
end;
$$;

create function public.unlink_student_guardian(
  p_student_id uuid,
  p_guardian_id uuid
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

  delete from public.student_guardians
  where school_id = target_school_id
    and student_id = p_student_id
    and guardian_id = p_guardian_id;

  if not found then
    raise exception 'guardian link not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_student_with_enrollment_v2(
  text, text, text, text, text, text, text,
  public.report_language, uuid, date, jsonb
) from public;
revoke all on function public.link_student_guardian(
  uuid, text, text, text, public.report_language, boolean, boolean
) from public;
revoke all on function public.update_student_guardian_link(
  uuid, uuid, text, text, text, public.report_language, boolean, boolean
) from public;
revoke all on function public.unlink_student_guardian(uuid, uuid) from public;

grant execute on function public.create_student_with_enrollment_v2(
  text, text, text, text, text, text, text,
  public.report_language, uuid, date, jsonb
) to authenticated;
grant execute on function public.link_student_guardian(
  uuid, text, text, text, public.report_language, boolean, boolean
) to authenticated;
grant execute on function public.update_student_guardian_link(
  uuid, uuid, text, text, text, public.report_language, boolean, boolean
) to authenticated;
grant execute on function public.unlink_student_guardian(uuid, uuid)
  to authenticated;
