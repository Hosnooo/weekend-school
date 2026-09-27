-- Explicit Guardian identity during Student creation.
-- v2 remains intact for migration compatibility.
-- Application creation moves to v3 so email never silently chooses identity.

create function public.create_student_with_enrollment_v3(
  p_first_name_en text,
  p_last_name_en text,
  p_first_name_ar text,
  p_last_name_ar text,
  p_guardian_mode text,
  p_guardian_id uuid,
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
  guardian_mode text := lower(trim(coalesce(p_guardian_mode, '')));
  new_student_id uuid;
  new_guardian_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  if guardian_mode not in ('none', 'existing', 'new') then
    raise exception 'invalid guardian mode'
      using errcode = '22023';
  end if;

  if guardian_mode = 'none' then
    if p_guardian_id is not null
       or nullif(trim(coalesce(p_guardian_name, '')), '') is not null
       or nullif(trim(coalesce(p_guardian_email, '')), '') is not null
       or nullif(trim(coalesce(p_guardian_phone, '')), '') is not null then
      raise exception 'no-guardian mode cannot include guardian identity'
        using errcode = '22023';
    end if;

  elsif guardian_mode = 'existing' then
    if p_guardian_id is null then
      raise exception 'existing guardian id is required'
        using errcode = '22023';
    end if;

    if nullif(trim(coalesce(p_guardian_name, '')), '') is not null
       or nullif(trim(coalesce(p_guardian_email, '')), '') is not null
       or nullif(trim(coalesce(p_guardian_phone, '')), '') is not null then
      raise exception 'existing guardian must be selected by id'
        using errcode = '22023';
    end if;

    perform 1
    from public.guardians g
    where g.school_id = target_school_id
      and g.id = p_guardian_id
    for update;

    if not found then
      raise exception 'guardian not found'
        using errcode = '23503';
    end if;

  else
    if p_guardian_id is not null then
      raise exception 'new guardian cannot include an existing guardian id'
        using errcode = '22023';
    end if;

    if nullif(trim(coalesce(p_guardian_name, '')), '') is null
       or nullif(trim(coalesce(p_guardian_email, '')), '') is null
       or nullif(trim(coalesce(p_guardian_phone, '')), '') is null
       or p_report_language is null then
      raise exception 'complete new guardian details are required'
        using errcode = '22023';
    end if;

    perform 1
    from public.guardians g
    where g.school_id = target_school_id
      and g.email = lower(trim(p_guardian_email))
    for update;

    if found then
      raise exception 'guardian email already exists; link existing guardian'
        using errcode = '23505';
    end if;
  end if;

  -- v2 performs the Student + enrollment transaction, but receives no
  -- Guardian identity. v3 owns all Guardian identity decisions explicitly.
  new_student_id := public.create_student_with_enrollment_v2(
    p_first_name_en,
    p_last_name_en,
    p_first_name_ar,
    p_last_name_ar,
    null,
    null,
    null,
    coalesce(p_report_language, 'en'::public.report_language),
    p_class_id,
    p_starts_on,
    p_subject_preferences
  );

  if guardian_mode = 'existing' then
    perform public.link_existing_student_guardian(
      new_student_id,
      p_guardian_id,
      true,
      true
    );

  elsif guardian_mode = 'new' then
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
    returning id into new_guardian_id;

    perform public.link_existing_student_guardian(
      new_student_id,
      new_guardian_id,
      true,
      true
    );
  end if;

  return new_student_id;
end;
$$;

revoke all on function public.create_student_with_enrollment_v3(
  text, text, text, text,
  text, uuid,
  text, text, text,
  public.report_language,
  uuid, date, jsonb
) from public;

revoke execute on function public.create_student_with_enrollment_v3(
  text, text, text, text,
  text, uuid,
  text, text, text,
  public.report_language,
  uuid, date, jsonb
) from anon;

grant execute on function public.create_student_with_enrollment_v3(
  text, text, text, text,
  text, uuid,
  text, text, text,
  public.report_language,
  uuid, date, jsonb
) to authenticated;
