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

create policy attendance_resolutions_admin_all on public.attendance_resolutions
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

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
  select
    null::public.attendance_status,
    false,
    false,
    0::bigint;
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
begin
  if public.current_school_id() is null
    or public.current_profile_id() is null
    or not public.is_admin()
  then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  raise exception 'attendance conflict resolution not implemented' using errcode = '0A000';
end;
$$;

revoke all on function public.resolve_attendance_conflict(uuid, uuid, date, uuid, public.attendance_status) from public;
revoke execute on function public.resolve_attendance_conflict(uuid, uuid, date, uuid, public.attendance_status) from anon;
grant execute on function public.resolve_attendance_conflict(uuid, uuid, date, uuid, public.attendance_status) to authenticated;
