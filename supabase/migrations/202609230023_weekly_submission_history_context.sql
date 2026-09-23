-- Preserve author-owned historical labels for weekly submissions after teaching assignments end.
-- This stays school-scoped and does not require the context to remain an active assignment.

create function public.get_weekly_submission_context(p_submission_id uuid)
returns table (
  class_subject_id uuid,
  subject_group_id uuid,
  class_name_en text,
  class_name_ar text,
  subject_name_en text,
  subject_name_ar text,
  group_name_en text,
  group_name_ar text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ws.class_subject_id,
    ws.subject_group_id,
    c.name_en as class_name_en,
    c.name_ar as class_name_ar,
    s.name_en as subject_name_en,
    s.name_ar as subject_name_ar,
    sg.name_en as group_name_en,
    sg.name_ar as group_name_ar
  from public.weekly_submissions ws
  join public.class_subjects cs
    on cs.school_id = ws.school_id
   and cs.id = ws.class_subject_id
  join public.classes c
    on c.school_id = cs.school_id
   and c.id = cs.class_id
  join public.subjects s
    on s.school_id = cs.school_id
   and s.id = cs.subject_id
  left join public.subject_groups sg
    on sg.school_id = ws.school_id
   and sg.class_subject_id = ws.class_subject_id
   and sg.id = ws.subject_group_id
  where ws.school_id = public.current_school_id()
    and ws.id = p_submission_id
    and (
      ws.teacher_profile_id = public.current_profile_id()
      or public.is_admin()
    );
$$;

revoke all on function public.get_weekly_submission_context(uuid) from public;
revoke execute on function public.get_weekly_submission_context(uuid) from anon;
grant execute on function public.get_weekly_submission_context(uuid) to authenticated;
