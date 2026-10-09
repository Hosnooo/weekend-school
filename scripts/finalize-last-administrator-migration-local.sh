#!/usr/bin/env bash
set -euo pipefail

# Generate the durable CLI migration, replay it in local Supabase, test its
# committed pgTAP contract and the two-session race, and commit on review branch.
# This script never targets hosted Supabase, merges main, pushes, or deploys.

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "$(git branch --show-current)" != 'review/atomic-last-admin-guard-20261008' ]]; then
  echo "REFUSED: switch to the Administrator review branch." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "REFUSED: uncommitted changes found; preserve them before generating migration." >&2
  exit 1
fi
command -v psql >/dev/null || {
  echo "PostgreSQL psql client is required." >&2
  exit 1
}

eval "$(pnpm exec supabase status -o env)"
export DB_URL API_URL
node <<'NODE'
const db = new URL(process.env.DB_URL || '');
const api = new URL(process.env.API_URL || '');
const local = new Set(['127.0.0.1', 'localhost']);
if (!local.has(db.hostname) || db.port !== '55322' ||
    db.pathname !== '/postgres' ||
    !['postgres:', 'postgresql:'].includes(db.protocol) ||
    !local.has(api.hostname) || api.port !== '55321' ||
    api.protocol !== 'http:') {
  console.error('REFUSED: Supabase must be the disposable local project on ports 55321/55322.');
  process.exit(1);
}
NODE

if compgen -G 'supabase/migrations/*_prevent_last_active_administrator_race.sql' >/dev/null; then
  echo 'REFUSED: a generated last-Administrator migration already exists.' >&2
  exit 1
fi
if [[ -e supabase/tests/last_active_administrator_guard.test.sql ]]; then
  echo 'REFUSED: committed last-Administrator test already exists.' >&2
  exit 1
fi

echo 'Generating migration using Supabase CLI...'
pnpm exec supabase migration new prevent_last_active_administrator_race
migration="$(find supabase/migrations -maxdepth 1 -type f \
  -name '*_prevent_last_active_administrator_race.sql' -print -quit)"
test -n "$migration"
cp docs/db-review/last-active-administrator-guard.sql "$migration"
cp docs/db-review/last-active-administrator-guard.test.sql \
  supabase/tests/last_active_administrator_guard.test.sql

# Ensure the database schema contains this migration via an actual replay
# rather than only the earlier manual candidate SQL installation.
echo 'Replaying ALL migrations into disposable local database (one reset)...'
pnpm db:reset

version="$(basename "$migration" | cut -d_ -f1)"
if [[ ! "$version" =~ ^[0-9]{14}$ ]]; then
  echo "FAIL: Supabase CLI produced an unexpected migration version." >&2
  exit 1
fi
registered="$(psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 \
  -c "select count(*) from supabase_migrations.schema_migrations
      where version = '$version';")"
if [[ "$registered" != '1' ]]; then
  echo "FAIL: generated migration $version missing from local migration history." >&2
  exit 1
fi

echo 'Running full PostgreSQL/RLS suite including 18 Administrator assertions...'
pnpm test:db
echo 'Running two-session Administrator deactivation race...'
bash scripts/test-last-administrator-race.sh
echo 'Checking migration order and local administrator contracts...'
pnpm exec vitest run --configLoader runner \
  tests/integration/database/migrations.test.ts \
  tests/unit/administrator-management.test.ts \
  tests/unit/administrator-lifecycle-error.test.ts

git add -- "$migration" supabase/tests/last_active_administrator_guard.test.sql
git commit -m "fix(db): enforce last active Administrator with atomic deletion migration"

echo 'PASS: formal migration created, replayed, tested, and COMMITTED LOCALLY.'
echo "Migration: $migration"
echo "Commit: $(git log -1 --format=%h)"
echo 'Nothing has been pushed, merged, or deployed.'
