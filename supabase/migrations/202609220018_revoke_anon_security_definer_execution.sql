-- Supabase default privileges may explicitly grant anon EXECUTE on new functions.
-- SECURITY DEFINER functions in this application authenticate and authorize inside
-- the function body, but anonymous callers should not be able to invoke them at all.
do $$
declare
  target_function regprocedure;
begin
  for target_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from anon', target_function);
  end loop;
end;
$$;

-- Prevent future functions created by postgres in public from silently regaining
-- anonymous execution. Public functions that intentionally support anon access must
-- opt in with an explicit GRANT in their own migration.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
