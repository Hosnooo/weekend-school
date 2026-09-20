create function public.ensure_session_student_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_group_id uuid;
  target_session_date date;
begin
  select sessions.group_id, sessions.session_date
    into target_group_id, target_session_date
  from public.sessions
  where sessions.school_id = new.school_id
    and sessions.id = new.session_id;

  if not exists (
    select 1
    from public.group_memberships
    where group_memberships.school_id = new.school_id
      and group_memberships.group_id = target_group_id
      and group_memberships.student_id = new.student_id
      and group_memberships.starts_on <= target_session_date
      and (
        group_memberships.ends_on is null
        or group_memberships.ends_on >= target_session_date
      )
  ) then
    raise exception 'student is not a member of the session group on the session date'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger attendance_ensure_membership
before insert or update on public.attendance
for each row execute function public.ensure_session_student_membership();

create trigger student_progress_ensure_membership
before insert or update on public.student_progress
for each row execute function public.ensure_session_student_membership();

create function public.prevent_submitted_session_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'SUBMITTED' then
    raise exception 'submitted sessions are immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger sessions_prevent_submitted_change
before update or delete on public.sessions
for each row execute function public.prevent_submitted_session_change();

create function public.prevent_submitted_session_child_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_session_id uuid;
begin
  if tg_op = 'DELETE' then
    target_session_id = old.session_id;
  else
    target_session_id = new.session_id;
  end if;

  if exists (
    select 1
    from public.sessions
    where sessions.id = target_session_id
      and sessions.status = 'SUBMITTED'
  ) then
    raise exception 'submitted session data is immutable' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger group_progress_prevent_submitted_change
before insert or update or delete on public.group_progress
for each row execute function public.prevent_submitted_session_child_change();
create trigger attendance_prevent_submitted_change
before insert or update or delete on public.attendance
for each row execute function public.prevent_submitted_session_child_change();
create trigger student_progress_prevent_submitted_change
before insert or update or delete on public.student_progress
for each row execute function public.prevent_submitted_session_child_change();

create function public.preserve_report_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.school_id,
    new.student_id,
    new.period_start,
    new.period_end,
    new.language,
    new.snapshot_json,
    new.generated_at
  ) is distinct from row(
    old.school_id,
    old.student_id,
    old.period_start,
    old.period_end,
    old.language,
    old.snapshot_json,
    old.generated_at
  ) then
    raise exception 'report snapshots are immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger reports_preserve_snapshot
before update on public.reports
for each row execute function public.preserve_report_snapshot();

revoke all on function public.ensure_session_student_membership() from public;
revoke all on function public.prevent_submitted_session_change() from public;
revoke all on function public.prevent_submitted_session_child_change() from public;
revoke all on function public.preserve_report_snapshot() from public;
