-- Migration 14 is already applied locally. Guard the target side of all
-- membership writes without rewriting that migration.
create function public.protect_submitted_group_roster()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.group_id = new.group_id and old.starts_on = new.starts_on
      and old.ends_on is not distinct from new.ends_on then
      return new;
    end if;
  end if;
  if exists (
    select 1 from public.sessions s
    where s.school_id = new.school_id
      and s.group_id = new.group_id
      and s.status = 'SUBMITTED'
      and s.session_date >= new.starts_on
      and (new.ends_on is null or s.session_date <= new.ends_on)
  ) then
    raise exception 'submitted session depends on target membership' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger group_memberships_protect_submitted_roster
before insert or update of group_id, starts_on, ends_on on public.group_memberships
for each row execute function public.protect_submitted_group_roster();

revoke all on function public.protect_submitted_group_roster() from public;
