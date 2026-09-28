-- Transactional Student roster CSV import.
-- Raw CSV files are never stored; only the completed import summary/hash is retained.

create table public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  requested_by_profile_id uuid not null,
  import_hash text not null check (
    length(import_hash) = 64
    and import_hash = lower(trim(import_hash))
    and import_hash ~ '^[0-9a-f]{64}$'
  ),
  row_count integer not null check (row_count between 1 and 500),
  students_created integer not null default 0 check (students_created >= 0),
  guardians_created integer not null default 0 check (guardians_created >= 0),
  guardians_reused integer not null default 0 check (guardians_reused >= 0),
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, import_hash),
  constraint roster_imports_profile_school_fk
    foreign key (school_id, requested_by_profile_id)
    references public.profiles(school_id, id)
    on delete restrict
);

create index roster_imports_school_created_idx
  on public.roster_imports (school_id, created_at desc);

alter table public.roster_imports enable row level security;
alter table public.roster_imports force row level security;

create policy roster_imports_admin_select
on public.roster_imports
for select
to authenticated
using (
  school_id = public.current_school_id()
  and public.is_admin()
);

create function public.import_student_roster(
  p_import_hash text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  actor_profile_id uuid := public.current_profile_id();

  normalized_hash text := lower(trim(coalesce(p_import_hash, '')));
  total_rows integer;

  row_item jsonb;
  group_preferences jsonb;
  class_subject_row record;
  preference jsonb;

  new_student_id uuid;
  resolved_guardian_id uuid;
  requested_guardian_id uuid;
  requested_group_id uuid;
  resolved_group_id uuid;
  target_class_id uuid;

  first_name_en text;
  last_name_en text;
  first_name_ar text;
  last_name_ar text;
  guardian_name text;
  guardian_email text;
  guardian_phone text;
  starts_on date;
  report_language public.report_language;

  active_guardian_ids uuid[];
  inactive_guardian_count integer;

  guardians_created_count integer := 0;
  reused_guardian_ids uuid[] := array[]::uuid[];
  created_guardian_ids uuid[] := array[]::uuid[];
begin
  if target_school_id is null
     or actor_profile_id is null
     or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  if normalized_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid roster import hash'
      using errcode = '22023';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'roster rows must be a JSON array'
      using errcode = '22023';
  end if;

  total_rows := jsonb_array_length(p_rows);

  if total_rows < 1 or total_rows > 500 then
    raise exception 'roster import must contain between 1 and 500 rows'
      using errcode = '22023';
  end if;

  -- Reserve the hash before creating any records. A repeated completed import
  -- fails here, and any later failure rolls this reservation back too.
  insert into public.roster_imports (
    school_id,
    requested_by_profile_id,
    import_hash,
    row_count,
    students_created,
    guardians_created,
    guardians_reused
  ) values (
    target_school_id,
    actor_profile_id,
    normalized_hash,
    total_rows,
    0,
    0,
    0
  );

  for row_item in
    select value
    from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(row_item) <> 'object' then
      raise exception 'each roster row must be an object'
        using errcode = '22023';
    end if;

    first_name_en := trim(coalesce(row_item ->> 'firstNameEn', ''));
    last_name_en := trim(coalesce(row_item ->> 'lastNameEn', ''));
    first_name_ar := nullif(trim(coalesce(row_item ->> 'firstNameAr', '')), '');
    last_name_ar := nullif(trim(coalesce(row_item ->> 'lastNameAr', '')), '');

    guardian_name := trim(coalesce(row_item ->> 'guardianName', ''));
    guardian_email := lower(trim(coalesce(row_item ->> 'guardianEmail', '')));
    guardian_phone := trim(coalesce(row_item ->> 'guardianPhone', ''));

    if first_name_en = ''
       or last_name_en = ''
       or guardian_name = ''
       or guardian_email = ''
       or guardian_phone = '' then
      raise exception 'complete Student and Guardian details are required'
        using errcode = '22023';
    end if;

    if position('@' in guardian_email) <= 1 then
      raise exception 'invalid Guardian email'
        using errcode = '22023';
    end if;

    begin
      target_class_id := (row_item ->> 'classId')::uuid;
      starts_on := (row_item ->> 'startsOn')::date;
      report_language :=
        lower(trim(coalesce(row_item ->> 'reportLanguage', '')))::public.report_language;
    exception
      when invalid_text_representation or datetime_field_overflow then
        raise exception 'invalid roster row identifiers, date, or report language'
          using errcode = '22023';
    end;

    if target_class_id is null or starts_on is null then
      raise exception 'Class and enrollment start date are required'
        using errcode = '22023';
    end if;

    perform 1
    from public.classes class_row
    where class_row.school_id = target_school_id
      and class_row.id = target_class_id
      and class_row.is_active
    for update;

    if not found then
      raise exception 'active Class not found'
        using errcode = '23503';
    end if;

    group_preferences := coalesce(row_item -> 'groups', '[]'::jsonb);

    if jsonb_typeof(group_preferences) <> 'array' then
      raise exception 'groups must be a JSON array'
        using errcode = '22023';
    end if;

    -- Every submitted Class Subject must be active and belong to this Class.
    if exists (
      select 1
      from jsonb_array_elements(group_preferences) item
      where nullif(item ->> 'classSubjectId', '') is null
         or not exists (
           select 1
           from public.class_subjects class_subject
           where class_subject.school_id = target_school_id
             and class_subject.class_id = target_class_id
             and class_subject.id = (item ->> 'classSubjectId')::uuid
             and class_subject.is_active
         )
    ) then
      raise exception 'active Class Subject not found for selected Class'
        using errcode = '23503';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(group_preferences) item
      group by item ->> 'classSubjectId'
      having count(*) > 1
    ) then
      raise exception 'duplicate Class Subject Group preference'
        using errcode = '22023';
    end if;

    requested_guardian_id := null;

    if nullif(row_item ->> 'guardianId', '') is not null then
      begin
        requested_guardian_id := (row_item ->> 'guardianId')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'invalid Guardian identifier'
            using errcode = '22023';
      end;
    end if;

    -- Serialize Guardian identity resolution by school/email so sibling rows and
    -- concurrent imports cannot create the same new Guardian simultaneously.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        target_school_id::text || ':' || guardian_email,
        0
      )
    );

    if requested_guardian_id is not null then
      select guardian.id
        into resolved_guardian_id
      from public.guardians guardian
      where guardian.school_id = target_school_id
        and guardian.id = requested_guardian_id
        and guardian.email = guardian_email
        and guardian.is_active
      for update;

      if resolved_guardian_id is null then
        raise exception 'active Guardian not found for supplied identity'
          using errcode = '23503';
      end if;

    else
      -- Lock matching Guardian rows before resolving identity. PostgreSQL
      -- does not permit FOR UPDATE directly on aggregate queries.
      perform 1
      from public.guardians guardian
      where guardian.school_id = target_school_id
        and guardian.email = guardian_email
      for update;

      select
        array_agg(guardian.id order by guardian.id)
          filter (where guardian.is_active),
        count(*) filter (where not guardian.is_active)::integer
      into
        active_guardian_ids,
        inactive_guardian_count
      from public.guardians guardian
      where guardian.school_id = target_school_id
        and guardian.email = guardian_email;

      if coalesce(array_length(active_guardian_ids, 1), 0) > 1 then
        raise exception 'Guardian email is ambiguous'
          using errcode = '23505';

      elsif coalesce(array_length(active_guardian_ids, 1), 0) = 1 then
        resolved_guardian_id := active_guardian_ids[1];

      elsif inactive_guardian_count > 0 then
        raise exception 'Guardian email belongs to an inactive Guardian'
          using errcode = '23503';

      else
        insert into public.guardians (
          school_id,
          name,
          email,
          phone,
          report_language
        ) values (
          target_school_id,
          guardian_name,
          guardian_email,
          guardian_phone,
          report_language
        )
        returning id into resolved_guardian_id;

        guardians_created_count := guardians_created_count + 1;
        created_guardian_ids :=
          array_append(created_guardian_ids, resolved_guardian_id);
      end if;
    end if;

    if not resolved_guardian_id = any(created_guardian_ids)
       and not resolved_guardian_id = any(reused_guardian_ids) then
      reused_guardian_ids :=
        array_append(reused_guardian_ids, resolved_guardian_id);
    end if;

    insert into public.students (
      school_id,
      first_name_en,
      last_name_en,
      first_name_ar,
      last_name_ar
    ) values (
      target_school_id,
      first_name_en,
      last_name_en,
      first_name_ar,
      last_name_ar
    )
    returning id into new_student_id;

    insert into public.student_guardians (
      school_id,
      student_id,
      guardian_id,
      receives_reports,
      is_primary
    ) values (
      target_school_id,
      new_student_id,
      resolved_guardian_id,
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
      target_class_id,
      new_student_id,
      starts_on
    );

    -- Active Class Subjects are automatic. A submitted Group overrides the
    -- default; otherwise the default is used; otherwise the Student is ungrouped.
    for class_subject_row in
      select
        class_subject.id,
        class_subject.default_group_id
      from public.class_subjects class_subject
      where class_subject.school_id = target_school_id
        and class_subject.class_id = target_class_id
        and class_subject.is_active
      order by class_subject.id
    loop
      preference := null;

      select item
        into preference
      from jsonb_array_elements(group_preferences) item
      where item ->> 'classSubjectId' = class_subject_row.id::text
      limit 1;

      requested_group_id := null;

      if preference is not null
         and nullif(preference ->> 'groupId', '') is not null then
        begin
          requested_group_id := (preference ->> 'groupId')::uuid;
        exception
          when invalid_text_representation then
            raise exception 'invalid Group identifier'
              using errcode = '22023';
        end;
      end if;

      resolved_group_id :=
        coalesce(requested_group_id, class_subject_row.default_group_id);

      if resolved_group_id is not null then
        perform 1
        from public.subject_groups subject_group
        where subject_group.school_id = target_school_id
          and subject_group.class_subject_id = class_subject_row.id
          and subject_group.id = resolved_group_id
          and subject_group.is_active
        for update;

        if not found then
          raise exception 'active Subject Group not found for Class Subject'
            using errcode = '23503';
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
          resolved_group_id,
          new_student_id,
          starts_on
        );
      end if;
    end loop;
  end loop;

  update public.roster_imports
  set
    students_created = total_rows,
    guardians_created = guardians_created_count,
    guardians_reused = coalesce(array_length(reused_guardian_ids, 1), 0)
  where school_id = target_school_id
    and import_hash = normalized_hash;

  return jsonb_build_object(
    'rowCount', total_rows,
    'studentsCreated', total_rows,
    'guardiansCreated', guardians_created_count,
    'guardiansReused', coalesce(array_length(reused_guardian_ids, 1), 0)
  );
end;
$$;

revoke all on function public.import_student_roster(text, jsonb) from public;
revoke execute on function public.import_student_roster(text, jsonb) from anon;
grant execute on function public.import_student_roster(text, jsonb) to authenticated;
