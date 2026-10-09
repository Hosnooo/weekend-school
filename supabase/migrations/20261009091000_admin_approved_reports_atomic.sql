-- Preserve existing approved report text and save complete Admin edits atomically.
-- This migration is additive and deliberately does NOT change historical
-- Teacher submissions, old report snapshots, or any email delivery state.

alter table public.report_section_approvals
  add column if not exists progress_en_approved boolean not null default false,
  add column if not exists progress_ar_approved boolean not null default false;

-- All existing cycle approvals (including manual edits) are authoritative
-- for their current stored value. Do not try to reconstruct editing history
-- or silently overwrite a blank/null value on source refresh.
update public.report_section_approvals
set progress_en_approved = true, progress_ar_approved = true
where not progress_en_approved or not progress_ar_approved;

create or replace function public.save_class_report_review_atomic(
  p_batch_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_main_report_en text,
  p_main_report_ar text,
  p_include_performance boolean,
  p_include_student_comments boolean,
  p_students jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid := public.current_school_id();
  v_batch_status text;
  v_approval_id uuid;
  v_student record;
  v_existing public.report_student_overrides%rowtype;
  v_performance public.performance_level;
begin
  if v_school_id is null or not public.is_admin() then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;
  if p_batch_id is null or p_class_subject_id is null
     or jsonb_typeof(p_students) is distinct from 'array' then
    raise exception 'Invalid report review payload' using errcode = '22023';
  end if;

  -- Serialize every Editor save and batch finalization against this row.
  select status::text into v_batch_status
  from public.report_batches
  where id = p_batch_id and school_id = v_school_id
    and scope_type = 'CLASS'
  for update;
  if v_batch_status is null then
    raise exception 'Report Cycle not found' using errcode = 'P0002';
  end if;
  if v_batch_status = 'FINALIZED' then
    raise exception 'Finalized reports must be reopened before editing'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from public.reports report
    join public.email_deliveries delivery on delivery.report_id = report.id
    where report.school_id = v_school_id and report.batch_id = p_batch_id
  ) then
    raise exception 'Reports with delivery history cannot be modified'
      using errcode = '55000';
  end if;

  select id into v_approval_id
  from public.report_section_approvals
  where school_id = v_school_id and batch_id = p_batch_id
    and class_subject_id = p_class_subject_id
    and subject_group_id is not distinct from p_subject_group_id
  for update;
  if v_approval_id is null then
    raise exception 'Report approval context not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_students)
      as row(student_id uuid)
    group by student_id having count(*) > 1
  ) then
    raise exception 'Duplicate student in report review payload'
      using errcode = '22023';
  end if;

  -- The Admin text fields are authoritative even when intentionally blank.
  update public.report_section_approvals
  set approved_progress_en = nullif(trim(coalesce(p_main_report_en, '')), ''),
      approved_progress_ar = nullif(trim(coalesce(p_main_report_ar, '')), ''),
      progress_en_approved = true,
      progress_ar_approved = true
  where school_id = v_school_id and id = v_approval_id;

  for v_student in
    select * from jsonb_to_recordset(p_students)
    as item(
      student_id uuid,
      progress_en text,
      progress_ar text,
      performance text,
      performance_overridden boolean,
      comment_en text,
      comment_ar text,
      attendance_attended integer,
      attendance_total integer
    )
  loop
    if v_student.student_id is null or not exists (
      select 1 from public.students
      where id = v_student.student_id and school_id = v_school_id
    ) then
      raise exception 'Invalid student in report review payload'
        using errcode = '22023';
    end if;

    if (v_student.attendance_attended is null) <>
       (v_student.attendance_total is null)
       or (v_student.attendance_attended is not null
         and (v_student.attendance_attended < 0
           or v_student.attendance_total < v_student.attendance_attended)) then
      raise exception 'Attendance must be attended out of total sessions'
        using errcode = '22023';
    end if;

    v_performance := null;
    if coalesce(p_include_performance, false)
       and coalesce(v_student.performance_overridden, false)
       and v_student.performance is not null then
      v_performance := v_student.performance::public.performance_level;
    end if;

    select * into v_existing
    from public.report_student_overrides
    where school_id = v_school_id and approval_id = v_approval_id
      and student_id = v_student.student_id
    for update;

    if found then
      update public.report_student_overrides
      set
        progress_en = nullif(trim(coalesce(v_student.progress_en, '')), ''),
        progress_ar = nullif(trim(coalesce(v_student.progress_ar, '')), ''),
        performance = case
          when p_include_performance then v_performance else v_existing.performance end,
        performance_overridden = case
          when p_include_performance then coalesce(v_student.performance_overridden, false)
          else v_existing.performance_overridden end,
        comment_en = case when p_include_student_comments
          then nullif(trim(coalesce(v_student.comment_en, '')), '')
          else v_existing.comment_en end,
        comment_ar = case when p_include_student_comments
          then nullif(trim(coalesce(v_student.comment_ar, '')), '')
          else v_existing.comment_ar end,
        attendance_attended = v_student.attendance_attended,
        attendance_total = v_student.attendance_total
      where school_id = v_school_id and id = v_existing.id;
    else
      insert into public.report_student_overrides (
        school_id, approval_id, student_id,
        progress_en, progress_ar,
        performance, performance_overridden,
        comment_en, comment_ar,
        attendance_attended, attendance_total
      ) values (
        v_school_id, v_approval_id, v_student.student_id,
        nullif(trim(coalesce(v_student.progress_en, '')), ''),
        nullif(trim(coalesce(v_student.progress_ar, '')), ''),
        v_performance,
        coalesce(p_include_performance, false)
          and coalesce(v_student.performance_overridden, false),
        case when p_include_student_comments
          then nullif(trim(coalesce(v_student.comment_en, '')), '') else null end,
        case when p_include_student_comments
          then nullif(trim(coalesce(v_student.comment_ar, '')), '') else null end,
        v_student.attendance_attended,
        v_student.attendance_total
      );
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.save_class_report_review_atomic(
  uuid, uuid, uuid, text, text, boolean, boolean, jsonb
) from public, anon;
grant execute on function public.save_class_report_review_atomic(
  uuid, uuid, uuid, text, text, boolean, boolean, jsonb
) to authenticated;
