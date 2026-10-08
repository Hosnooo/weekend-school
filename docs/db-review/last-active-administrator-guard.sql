-- CANDIDATE ONLY. Generate an actual migration with:
--   pnpm exec supabase migration new prevent_last_active_administrator_race
-- Then copy this body into the CLI-generated migration filename.
-- DO NOT apply this directly to the production project without local DB tests.
--
-- Existing application-level count-then-mutate is non-atomic. This trigger
-- serializes status reductions and deletes of Administrator records by locking
-- the school's row in the SAME database transaction as the modification.
--
-- Keep SECURITY INVOKER: Administrator lifecycle writes currently use a
-- server-side service-role client. Do not expose a new privileged RPC.

create or replace function public.prevent_last_active_administrator()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  other_active_exists boolean;
begin
  if tg_op = 'UPDATE' then
    if not old.is_active or new.is_active then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    if not old.is_active then
      return old;
    end if;
  else
    raise exception 'Unexpected Administrator guard operation'
      using errcode = '22023';
  end if;

  -- Both concurrent changes to different Administrator rows must wait on
  -- one *shared* school row. Lock remains held until commit/rollback.
  perform 1
    from public.schools school
   where school.id = old.school_id
     for update;
  if not found then
    raise exception 'Administrator school no longer exists'
      using errcode = 'P0002';
  end if;

  -- VOLATILE statements under the default READ COMMITTED level observe
  -- changes committed by the previously serialized transaction.
  select exists (
    select 1
      from public.administrators administrator
     where administrator.school_id = old.school_id
       and administrator.id <> old.id
       and administrator.is_active
  ) into other_active_exists;

  if not other_active_exists then
    raise exception 'Cannot remove the last active Administrator'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_last_active_administrator() from public;
revoke execute on function public.prevent_last_active_administrator() from anon, authenticated;

drop trigger if exists administrators_preserve_last_active on public.administrators;
create trigger administrators_preserve_last_active
before update of is_active or delete on public.administrators
for each row
execute function public.prevent_last_active_administrator();

-- Unlink and delete must share a transaction. The previous implementation
-- unlinked via one HTTP request, then attempted deletion via a second
-- request. A concurrent last-Administrator rejection could leave the last
-- active business record with no account link.
create or replace function public.delete_administrator_with_accounts(
  p_school_id uuid,
  p_administrator_id uuid
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  target_active boolean;
begin
  perform 1 from public.schools school
   where school.id = p_school_id for update;
  if not found then
    raise exception 'Administrator school not found' using errcode='P0002';
  end if;

  select administrator.is_active into target_active
    from public.administrators administrator
   where administrator.school_id = p_school_id
     and administrator.id = p_administrator_id
    for update;
  if not found then
    raise exception 'Administrator record not found' using errcode='P0002';
  end if;

  if target_active and not exists (
    select 1 from public.administrators administrator
     where administrator.school_id = p_school_id
       and administrator.id <> p_administrator_id
       and administrator.is_active
  ) then
    raise exception 'Cannot remove the last active Administrator'
      using errcode='P0001';
  end if;

  delete from public.administrator_accounts account_link
   where account_link.school_id = p_school_id
     and account_link.administrator_id = p_administrator_id;

  delete from public.administrators administrator
   where administrator.school_id = p_school_id
     and administrator.id = p_administrator_id;
end;
$$;

revoke all on function public.delete_administrator_with_accounts(uuid,uuid) from public;
revoke execute on function public.delete_administrator_with_accounts(uuid,uuid) from anon, authenticated;
grant execute on function public.delete_administrator_with_accounts(uuid,uuid) to service_role;
