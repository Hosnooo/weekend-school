-- Restore per-Subject and per-Group requests without removing Class or bulk controls.
-- Existing requests are not changed.
create or replace function public.request_class_report_context_update(
  p_batch_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_include_dismissed boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();
  target_batch public.report_batches%rowtype;
  new_request_set_id uuid;
begin
  if target_school_id is null
     or target_profile_id is null
     or not public.is_admin()
  then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  select rb.* into target_batch
  from public.report_batches rb
  where rb.id = p_batch_id
    and rb.school_id = target_school_id
    and rb.scope_type = 'CLASS'
  for share;

  if not found then
    raise exception 'Class Report Cycle not found' using errcode = 'P0002';
  end if;
  if target_batch.status not in ('DRAFT', 'REVIEW') then
    raise exception 'Cannot request updates for a finalized Report Cycle'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.class_subjects cs
    join public.subjects s
      on s.school_id = cs.school_id and s.id = cs.subject_id
    join public.classes c
      on c.school_id = cs.school_id and c.id = cs.class_id
    where cs.id = p_class_subject_id
      and cs.school_id = target_school_id
      and cs.class_id = target_batch.class_id
      and cs.is_active and s.is_active and c.is_active
  ) then
    raise exception 'Active Class Subject not found in this Report Cycle'
      using errcode = 'P0002';
  end if;

  -- Whole-Subject requests are permitted only if no active Groups exist.
  if p_subject_group_id is null then
    if exists (
      select 1 from public.subject_groups sg
      where sg.school_id = target_school_id
        and sg.class_subject_id = p_class_subject_id
        and sg.is_active
    ) then
      raise exception 'Choose an active Subject Group'
        using errcode = '23514';
    end if;
  elsif not exists (
    select 1 from public.subject_groups sg
    where sg.school_id = target_school_id
      and sg.class_subject_id = p_class_subject_id
      and sg.id = p_subject_group_id
      and sg.is_active
  ) then
    raise exception 'Active Subject Group not found in this Class Subject'
      using errcode = 'P0002';
  end if;

  -- Same lock key as the existing class-wide RPC, protecting mixed requests.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      concat_ws(':', target_school_id::text, p_class_subject_id::text,
        target_batch.period_start::text, target_batch.period_end::text), 0
    )
  );

  if exists (
    select 1 from public.weekly_submissions ws
    where ws.school_id = target_school_id
      and ws.class_subject_id = p_class_subject_id
      and ws.subject_group_id is not distinct from p_subject_group_id
      and (
        (
          ws.status = 'SUBMITTED'
          and ws.period_start <= target_batch.period_end
          and ws.period_end >= target_batch.period_start
          and (
            ws.coverage_kind <> 'DATES'
            or exists (
              select 1 from public.weekly_submission_dates wd
              where wd.school_id = target_school_id
                and wd.submission_id = ws.id
                and wd.covered_on between target_batch.period_start
                                      and target_batch.period_end
            )
          )
        )
        or (
          ws.status = 'DRAFT'
          and ws.coverage_kind = 'RANGE'
          and ws.period_start <= target_batch.period_start
          and ws.period_end >= target_batch.period_end
        )
      )
  ) then
    return 0;
  end if;

  if not p_include_dismissed and exists (
    select 1 from public.weekly_submissions ws
    where ws.school_id = target_school_id
      and ws.class_subject_id = p_class_subject_id
      and ws.subject_group_id is not distinct from p_subject_group_id
      and ws.request_set_id is not null
      and ws.status = 'DISMISSED'
      and ws.coverage_kind = 'RANGE'
      and ws.period_start = target_batch.period_start
      and ws.period_end = target_batch.period_end
  ) then
    return 0;
  end if;

  insert into public.teaching_update_request_sets (
    school_id, class_subject_id, coverage_kind, period_start, period_end,
    requested_by_profile_id, admin_note
  ) values (
    target_school_id, p_class_subject_id, 'RANGE',
    target_batch.period_start, target_batch.period_end,
    target_profile_id, null
  ) returning id into new_request_set_id;

  insert into public.weekly_submissions (
    school_id, class_subject_id, subject_group_id, teacher_id,
    week_start, coverage_kind, period_start, period_end,
    request_set_id, created_by_profile_id, requested_by_profile_id
  ) values (
    target_school_id, p_class_subject_id, p_subject_group_id, null,
    target_batch.period_start, 'RANGE',
    target_batch.period_start, target_batch.period_end,
    new_request_set_id, target_profile_id, target_profile_id
  );

  return 1;
end;
$$;

revoke all on function public.request_class_report_context_update(
  uuid, uuid, uuid, boolean
) from public;
revoke execute on function public.request_class_report_context_update(
  uuid, uuid, uuid, boolean
) from anon;
grant execute on function public.request_class_report_context_update(
  uuid, uuid, uuid, boolean
) to authenticated;
