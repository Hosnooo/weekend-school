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

if [[ "${DB_ONLY:-0}" == 1 ]]; then
  if [[ "${RESET_LOCAL_SUPABASE:-0}" != 1 ]]; then
    echo "ERROR: DB_ONLY requires RESET_LOCAL_SUPABASE=1 for explicit local test consent." >&2
    exit 1
  fi
  echo "Skipping app tests because this same review commit was already verified."
else
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
fi

echo "PHASE 4: isolated disposable Supabase database tests"
if [[ "${RESET_LOCAL_SUPABASE:-0}" != 1 ]]; then
  echo "Local application checks passed. For isolated pgTAP migration tests, run"
  echo "RESET_LOCAL_SUPABASE=1 bash scripts/verify-report-authority-local.sh"
  exit 0
fi

bash "$PWD/scripts/verify-report-authority-db-isolated.sh"
echo "PASS: local report-authority checks. No production data changed."
