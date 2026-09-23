-- Migration 15 protected newly added roster intervals. Also protect
-- submitted sessions that would be removed from an existing interval.
create or replace function public.protect_submitted_group_roster()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.school_id = new.school_id and old.student_id = new.student_id
      and old.group_id = new.group_id and old.starts_on = new.starts_on
      and old.ends_on is not distinct from new.ends_on then
      return new;
    end if;

    if exists (
      select 1 from public.sessions s
      where s.school_id = old.school_id and s.group_id = old.group_id
        and s.status = 'SUBMITTED'
        and s.session_date >= old.starts_on
        and (old.ends_on is null or s.session_date <= old.ends_on)
        and (
          new.school_id <> old.school_id or new.student_id <> old.student_id
          or new.group_id <> old.group_id or s.session_date < new.starts_on
          or (new.ends_on is not null and s.session_date > new.ends_on)
        )
    ) then
      raise exception 'submitted session depends on prior membership' using errcode = '55000';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.sessions s
      where s.school_id = new.school_id and s.group_id = new.group_id
        and s.status = 'SUBMITTED' and s.session_date >= new.starts_on
        and (new.ends_on is null or s.session_date <= new.ends_on)
    ) then
      raise exception 'submitted session depends on target membership' using errcode = '55000';
    end if;
  else
    if exists (
      select 1 from public.sessions s
      where s.school_id = new.school_id and s.group_id = new.group_id
        and s.status = 'SUBMITTED' and s.session_date >= new.starts_on
        and (new.ends_on is null or s.session_date <= new.ends_on)
        and (
          new.school_id <> old.school_id or new.student_id <> old.student_id
          or new.group_id <> old.group_id or s.session_date < old.starts_on
          or (old.ends_on is not null and s.session_date > old.ends_on)
        )
    ) then
      raise exception 'submitted session depends on target membership' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger group_memberships_protect_submitted_roster on public.group_memberships;
create trigger group_memberships_protect_submitted_roster
before insert or update of school_id, student_id, group_id, starts_on, ends_on
on public.group_memberships
for each row execute function public.protect_submitted_group_roster();
