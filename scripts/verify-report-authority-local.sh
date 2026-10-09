#!/usr/bin/env bash
# Run from an isolated local review worktree.
# No GitHub Actions, Vercel deployment, linked database, mail sends or remote data writes.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
branch="$(git branch --show-current)"
if [[ "$branch" != "review/admin-authoritative-reports-numeric-attendance-20261009" ]]; then
  echo "ERROR: this verification must run on the report authority review branch." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: run from a clean isolated worktree; preserve unrelated local changes." >&2
  exit 1
fi

echo "PHASE 1: focused unit and contract tests"
pnpm exec vitest run --configLoader runner \
  tests/unit/report-attendance.test.ts \
  tests/unit/teacher-numeric-attendance-ui.test.ts \
  tests/unit/class-report-attendance-finalization.test.ts \
  tests/unit/report-performance-optional-contract.test.ts \
  tests/unit/report-email-customization.test.ts \
  tests/unit/report-service.test.ts \
  tests/unit/admin-submitted-update-view.test.ts \
  tests/unit/admin-report-preview-authority.test.ts \
  tests/integration/database/migrations.test.ts

echo "PHASE 2: lint + TypeScript + all Vitest tests"
pnpm lint
pnpm typecheck
pnpm test

echo "PHASE 3: production build (local only)"
pnpm build

echo "PHASE 4: local disposable Supabase test database"
if [[ "${RESET_LOCAL_SUPABASE:-}" != 1 ]]; then
  echo "Local code checks passed; to reset only the disposable local DB and run"
  echo "the complete pgTAP migration suite, re-run with RESET_LOCAL_SUPABASE=1."
  exit 0
fi

# Supabase status may include local database credentials. Never print them
# or write them into an easily shared test log.
local_status="$(supabase status 2>&1)"
if ! printf '%s' "$local_status" | grep -Eq '127[.]0[.]0[.]1|localhost'; then
  echo "ERROR: local Supabase URL was not confirmed. Do not reset a linked DB." >&2
  exit 1
fi
supabase db reset
pnpm test:db

echo "PASS: local report-authority tests and migration checks. No production data changed."
