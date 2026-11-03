-- Permit concurrent enrollments in different Classes, but never overlapping
-- enrollment periods for the same student in the same Class.
alter table public.class_enrollments
  drop constraint class_enrollments_one_active_class_per_student;

alter table public.class_enrollments
  add constraint class_enrollments_no_overlap_in_same_class
  exclude using gist (
    school_id with =,
    student_id with =,
    class_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  );

-- Bulk Class-page enrollment is all-or-nothing. Reuse the existing, audited
-- enrollment RPC so its default Subject Group behavior remains consistent.
create function public.enroll_students_in_class(
  p_student_ids uuid[],
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
  student_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if p_student_ids is null or cardinality(p_student_ids) < 1 or cardinality(p_student_ids) > 100
     or exists (select 1 from unnest(p_student_ids) as requested(id) where requested.id is null)
     or (select count(*) from (select distinct id from unnest(p_student_ids) as requested(id)) distinct_ids)
        <> cardinality(p_student_ids) then
    raise exception 'select between 1 and 100 unique students' using errcode = '22023';
  end if;

  -- Stable lock order avoids batch deadlocks; any invalid student or overlapping
  -- enrollment aborts the entire transaction.
  for student_id in select id from unnest(p_student_ids) as requested(id) order by id
  loop
    perform public.enroll_student_in_class(student_id, p_target_class_id, p_starts_on);
  end loop;
end;
$$;

revoke all on function public.enroll_students_in_class(uuid[], uuid, date) from public;
revoke execute on function public.enroll_students_in_class(uuid[], uuid, date) from anon;
grant execute on function public.enroll_students_in_class(uuid[], uuid, date) to authenticated;
