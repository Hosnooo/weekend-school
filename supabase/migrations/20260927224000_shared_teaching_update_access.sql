-- Shared Admin-requested Teaching Updates stay unclaimed until submission.
-- Every Teacher assigned to the Class Subject must be able to read an OPEN
-- shared request, its exact dates, and any saved draft student detail.

create or replace function public.teacher_can_access_teaching_update(
  p_submission_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id = public.current_school_id()
      and submission.id = p_submission_id
      and (
        submission.teacher_id in (
          select public.current_teacher_ids()
        )
        or (
          submission.teacher_id is null
          and submission.request_set_id is not null
          and submission.status = 'DRAFT'
          and exists (
            select 1
            from public.current_teacher_ids() teacher_id
            where public.teacher_can_teach_period_context(
              teacher_id,
              submission.class_subject_id,
              submission.subject_group_id,
              submission.period_start,
              submission.period_end
            )
          )
        )
      )
  );
$$;

revoke all on function
  public.teacher_can_access_teaching_update(uuid)
from public;

revoke execute on function
  public.teacher_can_access_teaching_update(uuid)
from anon;

grant execute on function
  public.teacher_can_access_teaching_update(uuid)
to authenticated;

-------------------------------------------------------------------------------
-- Parent Teaching Update rows.
-------------------------------------------------------------------------------

drop policy if exists
  weekly_submissions_teacher_select
on public.weekly_submissions;

create policy weekly_submissions_teacher_select
on public.weekly_submissions
for select
to authenticated
using (
  school_id = public.current_school_id()
  and public.teacher_can_access_teaching_update(id)
);

-------------------------------------------------------------------------------
-- Exact covered dates for shared DATES requests.
-------------------------------------------------------------------------------

drop policy if exists
  weekly_submission_dates_teacher_select
on public.weekly_submission_dates;

create policy weekly_submission_dates_teacher_select
on public.weekly_submission_dates
for select
to authenticated
using (
  school_id = public.current_school_id()
  and public.teacher_can_access_teaching_update(
    submission_id
  )
);

-------------------------------------------------------------------------------
-- Saved student draft detail for shared requests.
-------------------------------------------------------------------------------

drop policy if exists
  weekly_submission_students_teacher_select
on public.weekly_submission_students;

create policy weekly_submission_students_teacher_select
on public.weekly_submission_students
for select
to authenticated
using (
  school_id = public.current_school_id()
  and public.teacher_can_access_teaching_update(
    submission_id
  )
);

-------------------------------------------------------------------------------
-- Historical/editor context RPC.
--
-- The previous implementation predates shared Admin requests and resolves
-- only Teacher-owned submissions. Preserve the same return contract while
-- authorizing either an Admin or a Teacher who can access the Teaching Update.
-------------------------------------------------------------------------------

create or replace function public.get_weekly_submission_context(
  p_submission_id uuid
)
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
    submission.class_subject_id,
    submission.subject_group_id,
    school_class.name_en,
    school_class.name_ar,
    subject.name_en,
    subject.name_ar,
    subject_group.name_en,
    subject_group.name_ar
  from public.weekly_submissions submission
  join public.class_subjects class_subject
    on class_subject.school_id = submission.school_id
   and class_subject.id = submission.class_subject_id
  join public.classes school_class
    on school_class.school_id = class_subject.school_id
   and school_class.id = class_subject.class_id
  join public.subjects subject
    on subject.school_id = class_subject.school_id
   and subject.id = class_subject.subject_id
  left join public.subject_groups subject_group
    on subject_group.school_id = submission.school_id
   and subject_group.id = submission.subject_group_id
  where submission.school_id = public.current_school_id()
    and submission.id = p_submission_id
    and (
      public.is_admin()
      or public.teacher_can_access_teaching_update(
        submission.id
      )
    );
$$;
