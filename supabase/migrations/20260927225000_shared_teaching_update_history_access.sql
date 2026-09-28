-- Preserve Teacher read access to shared Admin-request history after dismissal.
--
-- OPEN shared requests are actionable.
-- DISMISSED shared requests remain readable as audited historical records.
-- SUBMITTED shared requests are claimed atomically by the winning Teacher
-- and therefore use normal Teacher ownership access.

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
          and submission.status in (
            'DRAFT',
            'DISMISSED'
          )
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
