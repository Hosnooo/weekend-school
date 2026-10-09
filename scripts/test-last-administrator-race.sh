#!/usr/bin/env bash
set -euo pipefail

# Only a disposable local database is acceptable for a destructive race test.
: "${DB_URL:?The local Supabase DB_URL is required}"
node <<'NODE'
const db = new URL(process.env.DB_URL || '');
if (!['127.0.0.1', 'localhost'].includes(db.hostname) ||
    db.port !== '55322' || db.pathname !== '/postgres' ||
    !['postgres:', 'postgresql:'].includes(db.protocol)) {
  console.error('Refusing to run Administrator race test outside the configured local database.');
  process.exit(1);
}
NODE

# Unique fixtures keep the local test repeatable without another DB reset.
read -r school_id admin_one admin_two < <(
  node -e 'const {randomUUID} = require("node:crypto"); console.log([randomUUID(),randomUUID(),randomUUID()].join(" "))'
)

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
first_ready="$(mktemp)"
rm -f "$first_ready"
trap 'rm -f "$first_log" "$second_log" "$first_ready"' EXIT

# Hold the school lock in session 1 while session 2 attempts its update.
# A psql -c command with multiple SQL statements may print only its final
# command result. Signal readiness from psql after its UPDATE instead.
psql "$DB_URL" -v ON_ERROR_STOP=1 >"$first_log" 2>&1 <<SQL &
begin;
update public.administrators set is_active=false where id='$admin_one';
\! touch "$first_ready"
select pg_sleep(7);
commit;
SQL
first_pid=$!

ready=0
for attempt in $(seq 1 150); do
  if [[ -f "$first_ready" ]]; then ready=1; break; fi
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
