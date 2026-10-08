#!/usr/bin/env bash
set -euo pipefail

# Only a disposable local database is acceptable for a destructive race test.
: "${DB_URL:?The local Supabase DB_URL is required}"
case "$DB_URL" in
  *"@127.0.0.1:"*|*"@localhost:"*) ;;
  *) echo "Refusing to run Administrator race test outside localhost" >&2; exit 1 ;;
esac

school_id='7a000000-0000-4000-8000-000000000001'
admin_one='7b000000-0000-4000-8000-000000000001'
admin_two='7b000000-0000-4000-8000-000000000002'

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
insert into public.schools(id,name_en,name_ar)
values ('$school_id','Concurrent Admin Test','مدرسة اختبار التزامن');
insert into public.administrators(id,school_id,display_name,email,is_active)
values
('$admin_one','$school_id','Concurrent Admin One','concurrent-one@example.test',true),
('$admin_two','$school_id','Concurrent Admin Two','concurrent-two@example.test',true);
SQL

first_log="$(mktemp)"
second_log="$(mktemp)"
trap 'rm -f "$first_log" "$second_log"' EXIT

# Hold the school lock in session 1 long enough to overlap session 2.
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  begin;
  update public.administrators set is_active=false where id='$admin_one';
  select pg_sleep(4);
  commit;
" >"$first_log" 2>&1 &
first_pid=$!

# Wait for the first update to acquire the lock; don't assume a sleep alone.
ready=0
for attempt in $(seq 1 150); do
  if grep -q 'UPDATE 1' "$first_log"; then ready=1; break; fi
  if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
  sleep 0.1
done
if [[ "$ready" != 1 ]]; then
  cat "$first_log" >&2
  echo "First transaction never acquired its update lock" >&2
  wait "$first_pid" || true
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  begin;
  update public.administrators set is_active=false where id='$admin_two';
  commit;
" >"$second_log" 2>&1 &
second_pid=$!

if ! wait "$first_pid"; then
  cat "$first_log" >&2
  echo "The first transaction unexpectedly failed" >&2
  wait "$second_pid" || true
  exit 1
fi

if wait "$second_pid"; then
  cat "$second_log" >&2
  echo "Both deactivations succeeded: last-Administrator invariant BROKEN" >&2
  exit 1
fi

if ! grep -q 'Cannot remove the last active Administrator' "$second_log"; then
  cat "$second_log" >&2
  echo "Second transaction failed for an unexpected reason" >&2
  exit 1
fi

active_count="$(psql "$DB_URL" -At -v ON_ERROR_STOP=1 -c "
  select count(*) from public.administrators
   where school_id='$school_id' and is_active;
")"

if [[ "$active_count" != "1" ]]; then
  echo "Expected exactly one active Administrator, found: $active_count" >&2
  exit 1
fi

echo "PASS: concurrent deactivations serialized; exactly one active Administrator remains"
