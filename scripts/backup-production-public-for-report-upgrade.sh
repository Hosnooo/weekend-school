#!/usr/bin/env bash
# Read-only production PUBLIC database export before the report-authority release.
# This exports public database roles/schema/data, NOT Supabase-managed auth/storage.
# Never commit backup files or secrets. They contain private school data.
set -euo pipefail
umask 077

root="$(git rev-parse --show-toplevel)"
cli="$root/node_modules/.bin/supabase"
if [[ ! -x "$cli" ]]; then
  echo "Missing local Supabase CLI. Run pnpm install --frozen-lockfile first." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker is required for the Supabase CLI database dump." >&2
  exit 1
fi

out="$HOME/weekend-school-secure-backups/report-upgrade-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p -- "$out"
chmod 700 "$out"
printf '%s\n' "Enter the production Session Pooler connection URL from Supabase Dashboard > Connect."
printf '%s\n' "This input is hidden. It must point to project tlitseincunvlnnooply."
IFS= read -r -s -p "Connection URL (hidden): " db_url
printf '\n'

if [[ "$db_url" != *"postgres.tlitseincunvlnnooply"* &&
      "$db_url" != *"db.tlitseincunvlnnooply.supabase.co"* ]]; then
  echo "ERROR: Connection URL does not identify the expected production project." >&2
  unset db_url
  exit 1
fi
if [[ "$db_url" != postgresql://* && "$db_url" != postgres://* ]]; then
  echo "ERROR: Expected a PostgreSQL connection URL." >&2
  unset db_url
  exit 1
fi

echo "Exporting read-only database roles to an encrypted-permissions local directory..."
"$cli" db dump --db-url "$db_url" -f "$out/roles.sql" --role-only
echo "Exporting read-only application schema..."
"$cli" db dump --db-url "$db_url" -f "$out/schema.sql"
echo "Exporting read-only application data..."
"$cli" db dump --db-url "$db_url" -f "$out/data.sql" --use-copy --data-only
unset db_url

for name in roles.sql schema.sql data.sql; do
  if [[ ! -s "$out/$name" ]]; then
    echo "ERROR: Backup incomplete: $name is missing or empty." >&2
    exit 1
  fi
done
for expected in report_student_overrides report_section_approvals report_batches reports weekly_submission_students; do
  if ! grep -q "$expected" "$out/data.sql"; then
    echo "ERROR: Essential public table missing in exported data: $expected" >&2
    exit 1
  fi
done

( cd "$out" && sha256sum roles.sql schema.sql data.sql > SHA256SUMS )
cat >"$out/README_PRIVATE.txt" <<'EOF'
PRIVATE production backup — never attach to ChatGPT, email, GitHub or support tickets.
Source: Supabase Weekend School (tlitseincunvlnnooply).
Exported: public-app roles/schema/data using Supabase CLI db dump.
Supabase-managed auth and storage schema/data are EXCLUDED by the CLI.
This is NOT a verified full-platform restore and does not include storage objects.
All files contain confidential school data. Encrypt for off-site storage.
Before production migration, restore in an isolated database and compare row counts,
especially 87 Admin attendance pairs, 13 comment rows and all approvals.
EOF
touch "$out/PUBLIC_EXPORT_COMPLETE_UNVERIFIED_RESTORE"
chmod 600 "$out"/*

printf 'Backup files created (private): %s\n' "$out"
printf 'Roles/schema/data export completed; SHA256SUMS created.\n'
printf 'IMPORTANT: This is not yet a verified restore or full Auth/Storage backup.\n'
printf 'Do NOT send any backup files, SQL rows, passwords, or the URL to this chat.\n'
