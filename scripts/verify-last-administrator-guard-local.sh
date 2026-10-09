#!/usr/bin/env bash
set -euo pipefail

# Tests are designed for a CLEAN disposable local database: browser E2E
# fixtures contaminate pgTAP assumptions. This script resets LOCAL data once,
# then installs the candidate guard (without writing migration history).
# It never contacts hosted Supabase or deploys anything.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

command -v psql >/dev/null || {
  echo "PostgreSQL psql is required (run from WSL)." >&2
  exit 1
}

eval "$(pnpm exec supabase status -o env)"
export DB_URL API_URL

# Parse actual endpoints instead of accepting deceptive substring matches.
node <<'NODE'
const db = new URL(process.env.DB_URL || '');
const api = new URL(process.env.API_URL || '');
const local = new Set(['127.0.0.1', 'localhost']);
if (!local.has(db.hostname) || db.port !== '55322' ||
    db.pathname !== '/postgres' ||
    !['postgres:', 'postgresql:'].includes(db.protocol) ||
    !local.has(api.hostname) || api.port !== '55321' ||
    api.protocol !== 'http:') {
  console.error('REFUSED: database/API must be the configured disposable local Supabase endpoints.');
  process.exit(1);
}
NODE

echo "Resetting disposable LOCAL database once to remove browser-test fixtures..."
pnpm db:reset

echo "Installing candidate guard in LOCAL database (not a migration)..."
psql "$DB_URL" -X -v ON_ERROR_STOP=1 \
  -f docs/db-review/last-active-administrator-guard.sql

echo "Checking all local database tests on clean seed..."
pnpm exec supabase test db --local

echo "Checking Administrator guard, atomic deletion and RPC privileges..."
pnpm exec supabase test db --local \
  docs/db-review/last-active-administrator-guard.test.sql

echo "Checking concurrent deactivations in two database sessions..."
bash scripts/test-last-administrator-race.sh

echo "PASS: Administrator guard and existing database suite verified on fresh local seed. No hosted database was modified."
