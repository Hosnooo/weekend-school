-- Trigger functions are invoked by their triggers; none is an application RPC.
-- Revoke both inherited PUBLIC access and any explicit application-role grants.
-- Leave ordinary SECURITY DEFINER RPCs and their authorization contracts intact.
do $$
declare
  trigger_helper regprocedure;
begin
  for trigger_helper in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      trigger_helper
    );
  end loop;
end;
$$;
