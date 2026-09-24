-- Official attendance resolution for co-teacher weekly observations.
-- Consensus remains derived from immutable submitted teacher observations;
-- this table stores only an explicit admin decision for true conflicts.

create table public.attendance_resolutions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_subject_id uuid not null,
  subject_group_id uuid,
  week_start date not null,
  student_id uuid not null,
  resolved_status public.attendance_status not null,
  resolved_by_profile_id uuid not null,
  resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  constraint attendance_resolutions_class_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict,
  constraint attendance_resolutions_group_context_fk
    foreign key (school_id, class_subject_id, subject_group_id)
    references public.subject_groups(school_id, class_subject_id, id) on delete restrict,
  constraint attendance_resolutions_student_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  constraint attendance_resolutions_profile_school_fk
    foreign key (school_id, resolved_by_profile_id)
    references public.profiles(school_id, id) on delete restrict,
  constraint attendance_resolutions_status_check
    check (resolved_status in ('PRESENT', 'ABSENT')),
  constraint attendance_resolutions_one_context_student_week
    unique nulls not distinct (
      school_id,
      class_subject_id,
      subject_group_id,
      week_start,
      student_id
    )
);

create index attendance_resolutions_week_idx
  on public.attendance_resolutions (
    school_id,
    week_start desc,
    class_subject_id,
    subject_group_id,
    student_id
  );

create trigger attendance_resolutions_set_updated_at
before update on public.attendance_resolutions
for each row execute function public.set_updated_at();

alter table public.attendance_resolutions enable row level security;
alter table public.attendance_resolutions force row level security;

-- Admins may inspect decisions through RLS. Writes are intentionally withheld from
-- authenticated clients and go through resolve_attendance_conflict() only.
create policy attendance_resolutions_admin_select on public.attendance_resolutions
for select to authenticated
using (school_id = public.current_school_id() and public.is_admin());

create function public.get_effective_attendance(
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_week_start date,
  p_student_id uuid
)
returns table (
  status public.attendance_status,
  has_conflict boolean,
  is_resolved boolean,
  observation_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();
begin
  if target_school_id is null or target_profile_id is null then
    raise exception 'authenticated school profile required' using errcode = '42501';
  end if;

  if not public.is_admin()
    and not public.teacher_can_teach_context(
      target_profile_id,
      p_class_subject_id,
      p_subject_group_id,
      p_week_start
    )
  then
    raise exception 'attendance context access required' using errcode = '42501';
  end if;

  return query
  with observations as (
    select wss.attendance_status
    from public.weekly_submission_students wss
    join public.weekly_submissions ws
      on ws.school_id = wss.school_id
     and ws.id = wss.submission_id
    where ws.school_id = target_school_id
      and ws.class_subject_id = p_class_subject_id
      and ws.subject_group_id is not distinct from p_subject_group_id
      and ws.week_start = p_week_start
      and ws.status = 'SUBMITTED'
      and wss.student_id = p_student_id
  ), stats as (
    select
      count(*)::bigint as observation_count,
      count(distinct attendance_status)::bigint as distinct_count
    from observations
  )
  select
    case
      when stats.distinct_count = 1 then (
        select observation.attendance_status
        from observations observation
        limit 1
      )
      when stats.distinct_count > 1 then resolution.resolved_status
      else null::public.attendance_status
    end as status,
    stats.distinct_count > 1 as has_conflict,
    stats.distinct_count > 1 and resolution.id is not null as is_resolved,
    stats.observation_count
  from stats
  left join public.attendance_resolutions resolution
    on resolution.school_id = target_school_id
   and resolution.class_subject_id = p_class_subject_id
   and resolution.subject_group_id is not distinct from p_subject_group_id
   and resolution.week_start = p_week_start
   and resolution.student_id = p_student_id;
end;
$$;

revoke all on function public.get_effective_attendance(uuid, uuid, date, uuid) from public;
revoke execute on function public.get_effective_attendance(uuid, uuid, date, uuid) from anon;
grant execute on function public.get_effective_attendance(uuid, uuid, date, uuid) to authenticated;

create function public.resolve_attendance_conflict(
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_week_start date,
  p_student_id uuid,
  p_status public.attendance_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();
  distinct_status_count bigint;
begin
  if target_school_id is null
    or target_profile_id is null
    or not public.is_admin()
  then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('PRESENT', 'ABSENT') then
    raise exception 'official attendance must be PRESENT or ABSENT' using errcode = '23514';
  end if;

  select count(distinct wss.attendance_status)::bigint
  into distinct_status_count
  from public.weekly_submission_students wss
  join public.weekly_submissions ws
    on ws.school_id = wss.school_id
   and ws.id = wss.submission_id
  where ws.school_id = target_school_id
    and ws.class_subject_id = p_class_subject_id
    and ws.subject_group_id is not distinct from p_subject_group_id
    and ws.week_start = p_week_start
    and ws.status = 'SUBMITTED'
    and wss.student_id = p_student_id;

  if coalesce(distinct_status_count, 0) < 2 then
    raise exception 'attendance conflict required' using errcode = '23514';
  end if;

  insert into public.attendance_resolutions (
    school_id,
    class_subject_id,
    subject_group_id,
    week_start,
    student_id,
    resolved_status,
    resolved_by_profile_id,
    resolved_at
  ) values (
    target_school_id,
    p_class_subject_id,
    p_subject_group_id,
    p_week_start,
    p_student_id,
    p_status,
    target_profile_id,
    now()
  )
  on conflict on constraint attendance_resolutions_one_context_student_week
  do update set
    resolved_status = excluded.resolved_status,
    resolved_by_profile_id = excluded.resolved_by_profile_id,
    resolved_at = now();
end;
$$;

revoke all on function public.resolve_attendance_conflict(uuid, uuid, date, uuid, public.attendance_status) from public;
revoke execute on function public.resolve_attendance_conflict(uuid, uuid, date, uuid, public.attendance_status) from anon;
grant execute on function public.resolve_attendance_conflict(uuid, uuid, date, uuid, public.attendance_status) to authenticated;
