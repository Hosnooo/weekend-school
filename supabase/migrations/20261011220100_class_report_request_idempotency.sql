-- Class-level report update requests: idempotent and group-aware.
-- This migration does not change, dismiss, or remove existing requests.
create or replace function public.request_missing_class_report_updates(
  p_batch_id uuid,
  p_include_dismissed boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_batch public.report_batches%rowtype;
  target_subject record;
  target_group_id uuid;
  new_request_set_id uuid;
  created_count integer := 0;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  select * into target_batch
  from public.report_batches
  where id = p_batch_id
    and school_id = target_school_id
    and scope_type = 'CLASS'
  for share;

  if not found then
    raise exception 'Class Report Cycle not found' using errcode = 'P0002';
  end if;

  if target_batch.status not in ('DRAFT', 'REVIEW') then
    raise exception 'cannot request updates for a finalized Report Cycle'
      using errcode = '55000';
  end if;

  for target_subject in
    select cs.id
    from public.class_subjects cs
    join public.subjects s
      on s.school_id = cs.school_id and s.id = cs.subject_id
    where cs.school_id = target_school_id
      and cs.class_id = target_batch.class_id
      and cs.is_active
      and s.is_active
    order by cs.id
  loop
    -- Serialize requests for this exact Subject and period across cycles and admins.
    perform pg_advisory_xact_lock(
      hashtextextended(
        concat_ws(':', target_school_id::text, target_subject.id::text,
          target_batch.period_start::text, target_batch.period_end::text), 0)
    );
    new_request_set_id := null;

    -- Each active Group needs one update. Ungrouped Subjects need one.
    for target_group_id in
      select sg.id
      from public.subject_groups sg
      where sg.school_id = target_school_id
        and sg.class_subject_id = target_subject.id
        and sg.is_active
      union all
      select null::uuid
      where not exists (
        select 1 from public.subject_groups sg
        where sg.school_id = target_school_id
          and sg.class_subject_id = target_subject.id and sg.is_active
      )
    loop
      -- Submitted overlapping updates already qualify as source material.
      -- A draft covering the period is work already in the teacher queue.
      if exists (
        select 1 from public.weekly_submissions ws
        where ws.school_id = target_school_id
          and ws.class_subject_id = target_subject.id
          and ws.subject_group_id is not distinct from target_group_id
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
                    and wd.covered_on between target_batch.period_start and target_batch.period_end
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
        continue;
      end if;

      -- A dismissal remains actionable by the Admin but is not recreated in bulk.
      if not p_include_dismissed and exists (
        select 1 from public.weekly_submissions ws
        where ws.school_id = target_school_id
          and ws.class_subject_id = target_subject.id
          and ws.subject_group_id is not distinct from target_group_id
          and ws.request_set_id is not null
          and ws.status = 'DISMISSED'
          and ws.coverage_kind = 'RANGE'
          and ws.period_start = target_batch.period_start
          and ws.period_end = target_batch.period_end
      ) then
        continue;
      end if;

      if new_request_set_id is null then
        insert into public.teaching_update_request_sets (
          school_id, class_subject_id, coverage_kind, period_start, period_end,
          requested_by_profile_id, admin_note
        )
        values (
          target_school_id, target_subject.id, 'RANGE',
          target_batch.period_start, target_batch.period_end,
          public.current_profile_id(), null
        )
        returning id into new_request_set_id;
      end if;

      insert into public.weekly_submissions (
        school_id, class_subject_id, subject_group_id, teacher_id,
        week_start, coverage_kind, period_start, period_end,
        request_set_id, created_by_profile_id, requested_by_profile_id
      )
      values (
        target_school_id, target_subject.id, target_group_id, null,
        target_batch.period_start, 'RANGE',
        target_batch.period_start, target_batch.period_end,
        new_request_set_id, public.current_profile_id(), public.current_profile_id()
      );

      created_count := created_count + 1;
    end loop;
  end loop;

  return created_count;
end;
$$;

create or replace function public.request_all_missing_report_cycle_updates(
  p_period_start date,
  p_period_end date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_batch_id uuid;
  created_count integer := 0;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null
    or p_period_start > p_period_end then
    raise exception 'valid reporting period required' using errcode = '23514';
  end if;

  -- Only already-created, unfinished cycles for this exact period.
  -- Never revive dismissed teacher work in the bulk action.
  for target_batch_id in
    select distinct on (rb.class_id) rb.id
    from public.report_batches rb
    where rb.school_id = target_school_id
      and rb.scope_type = 'CLASS'
      and rb.status in ('DRAFT', 'REVIEW')
      and rb.period_start = p_period_start
      and rb.period_end = p_period_end
    order by rb.class_id, rb.created_at desc, rb.id
  loop
    created_count := created_count +
      public.request_missing_class_report_updates(target_batch_id, false);
  end loop;
  return created_count;
end;
$$;

revoke all on function public.request_missing_class_report_updates(uuid, boolean) from public;
revoke execute on function public.request_missing_class_report_updates(uuid, boolean) from anon;
grant execute on function public.request_missing_class_report_updates(uuid, boolean) to authenticated;
revoke all on function public.request_all_missing_report_cycle_updates(date, date) from public;
revoke execute on function public.request_all_missing_report_cycle_updates(date, date) from anon;
grant execute on function public.request_all_missing_report_cycle_updates(date, date) to authenticated;
