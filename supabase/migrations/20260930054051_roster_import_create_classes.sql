create or replace function public.import_student_roster_with_classes(
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

  row_item jsonb;
  resolved_rows jsonb := '[]'::jsonb;

  target_class_id uuid;
  class_name text;
  normalized_class_name text;

  active_class_ids uuid[];
  inactive_class_count integer;
begin
  if target_school_id is null
     or actor_profile_id is null
     or not public.is_admin() then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'roster rows must be a JSON array'
      using errcode = '22023';
  end if;

  for row_item in
    select value
    from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(row_item) <> 'object' then
      raise exception 'each roster row must be an object'
        using errcode = '22023';
    end if;

    target_class_id := null;

    if nullif(row_item ->> 'classId', '') is not null then
      begin
        target_class_id := (row_item ->> 'classId')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'invalid Class identifier'
            using errcode = '22023';
      end;

    else
      class_name := trim(coalesce(row_item ->> 'className', ''));

      if class_name = '' then
        raise exception 'Class name is required when Class does not already exist'
          using errcode = '22023';
      end if;

      normalized_class_name := lower(class_name);

      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          target_school_id::text || ':class:' || normalized_class_name,
          0
        )
      );

      perform 1
      from public.classes class_row
      where class_row.school_id = target_school_id
        and lower(trim(class_row.name_en)) = normalized_class_name
      for update;

      select
        array_agg(class_row.id order by class_row.id)
          filter (where class_row.is_active),
        count(*) filter (where not class_row.is_active)::integer
      into
        active_class_ids,
        inactive_class_count
      from public.classes class_row
      where class_row.school_id = target_school_id
        and lower(trim(class_row.name_en)) = normalized_class_name;

      if coalesce(array_length(active_class_ids, 1), 0) > 1 then
        raise exception 'Class name is ambiguous'
          using errcode = '23505';

      elsif coalesce(array_length(active_class_ids, 1), 0) = 1 then
        target_class_id := active_class_ids[1];

      elsif inactive_class_count > 0 then
        raise exception 'Class name belongs to an inactive Class'
          using errcode = '23503';

      else
        insert into public.classes (
          school_id,
          name_en
        ) values (
          target_school_id,
          class_name
        )
        returning id into target_class_id;
      end if;
    end if;

    row_item := jsonb_set(
      row_item,
      '{classId}',
      to_jsonb(target_class_id::text),
      true
    );

    row_item := row_item - 'className';

    resolved_rows :=
      resolved_rows || jsonb_build_array(row_item);
  end loop;

  return public.import_student_roster(
    p_import_hash,
    resolved_rows
  );
end;
$$;

revoke all
on function public.import_student_roster_with_classes(text, jsonb)
from public;

revoke execute
on function public.import_student_roster_with_classes(text, jsonb)
from anon;

grant execute
on function public.import_student_roster_with_classes(text, jsonb)
to authenticated;
