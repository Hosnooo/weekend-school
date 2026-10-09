#!/usr/bin/env bash
# Restore a PRIVATE production public-data dump into a separate, disposable local
# Supabase project, then apply BOTH new migrations and compare all old values.
# This script never contacts or modifies production. No backup leaves this PC.
set -euo pipefail
umask 077

root="$(git rev-parse --show-toplevel)"
cli="$root/node_modules/.bin/supabase"
backup="${1:-}"
if [[ -z "$backup" || ! -d "$backup" ]]; then
  echo "Usage: bash scripts/verify-report-authority-production-restore-local.sh /absolute/private/backup-directory" >&2
  exit 1
fi
backup="$(cd "$backup" && pwd -P)"
if [[ "$backup" != "$HOME/weekend-school-secure-backups/"* ]]; then
  echo "ERROR: The backup must be under the designated private backup directory." >&2
  exit 1
fi
for file in roles.sql schema.sql data.sql SHA256SUMS; do
  [[ -s "$backup/$file" ]] || { echo "ERROR: Missing/empty $file"; exit 1; }
done
(cd "$backup" && sha256sum --check --status SHA256SUMS) || {
  echo "ERROR: Backup files do not match their original checksums."; exit 1;
}
[[ -x "$cli" ]] || { echo "ERROR: Run pnpm install --frozen-lockfile first."; exit 1; }
docker info >/dev/null 2>&1 || { echo "ERROR: Docker is unavailable."; exit 1; }
[[ "$(git branch --show-current)" == "review/admin-authoritative-reports-numeric-attendance-20261009" ]] || {
  echo "ERROR: Use the isolated report-review worktree."; exit 1;
}

tmp="$(mktemp -d -t weekend-school-restore-XXXXXXXX)"
project="WebappRestoreReview$$"
log="$backup/restore-verification-$(date -u +%Y%m%dT%H%M%SZ)-PRIVATE.log"
: > "$log"
chmod 600 "$log"

# Error context may include private records in PostgreSQL DETAIL statements.
# Never print those lines. SQLSTATE is a fixed five-character diagnostic code.
show_safe_sqlstate() {
  local match state
  match="$(grep -Eo 'ERROR:[[:space:]]+[0-9A-Z]{5}([[:space:]]|$)' "$log" | tail -n 1 || true)"
  if [[ -z "$match" ]]; then
    echo "Database error category not available. Inspect PRIVATE local log only." >&2
    return
  fi
  state="$(printf '%s' "$match" | grep -Eo '[0-9A-Z]{5}' | tail -n 1)"
  printf 'Safe diagnostic only — PostgreSQL SQLSTATE: %s\n' "$state" >&2
}
cleanup() {
  (cd "$tmp" && "$cli" stop --project-id "$project" --no-backup >/dev/null 2>&1) || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT

mkdir -p "$tmp/supabase"
cp -a "$root/supabase/." "$tmp/supabase/"
rm -rf "$tmp/supabase/.temp" "$tmp/supabase/.branches"
config="$tmp/supabase/config.toml"
grep -qx 'project_id = "Webapp"' "$config" || {
  echo "ERROR: Unexpected local config; refusing to start."; exit 1;
}
sed -i -e "s/^project_id = \"Webapp\"$/project_id = \"$project\"/" \
       -e 's/5532/5642/g' "$config"
# The original database may contain Supabase-managed schema changes and
# migration timestamp drift not present in this Git worktree. A faithful
# production restore MUST use the schema in the saved production dump, not
# replay the app migrations and then try to COPY into a different schema.
# Remove migrations ONLY from the disposable copy, never the source worktree.
find "$tmp/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -delete
# No fake demo school/Student records may be present when restoring real data.
: > "$tmp/supabase/seed.sql"

echo "Starting an isolated local Supabase project on review-only ports 5642x..."
if ! (cd "$tmp" && "$cli" start >>"$log" 2>&1); then
  echo "ERROR: Isolated local database startup failed. Production unchanged." >&2
  echo "See the PRIVATE local verification log; do not upload it." >&2
  exit 1
fi
status="$(cd "$tmp" && "$cli" status 2>&1)" || {
  echo "ERROR: Isolated local database not healthy."; exit 1;
}
if [[ "$status" != *"127.0.0.1:56422"* && "$status" != *"localhost:56422"* ]]; then
  echo "ERROR: The isolated local database address could not be verified."; exit 1;
fi
echo "Preparing an empty isolated database (no app migrations or demo seed)..."
if ! (cd "$tmp" && "$cli" db reset --local >>"$log" 2>&1); then
  echo "ERROR: Disposable empty database initialization failed; see PRIVATE log."; exit 1;
fi
container="supabase_db_$project"
docker ps --format '{{.Names}}' | grep -Fxq "$container" || {
  echo "ERROR: The specifically named local Postgres container was not found."; exit 1;
}

# Local Supabase already provisions platform roles (postgres, authenticated,
# anon, service_role, supabase_admin and friends). Production roles.sql can
# contain grants and ALTER ROLE commands requiring Supabase-internal admin
# privileges; replaying it is neither safe nor needed for PUBLIC value-parity.
# Retain roles.sql in the original backup for full disaster recovery separately.
echo "Using locally provisioned Supabase platform roles (not replaying roles.sql)..."
echo "Restoring the ACTUAL production public application schema..."
if ! docker exec -i "$container" psql -U postgres -d postgres \
    -X -q -1 -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f - \
    < "$backup/schema.sql" >>"$log" 2>&1; then
  echo "ERROR: The production public schema could not be restored to the local clone." >&2
  show_safe_sqlstate
  echo "This is an isolated-restore compatibility problem, not a production change." >&2
  echo "Review the PRIVATE log locally; do not upload it or any personal data." >&2
  exit 1
fi

echo "Preparing a PUBLIC-only restore from the existing verified dump..."
# pg_dump --data-only contains Auth/Storage COPY blocks but the CLI schema
# dump excludes managed schemas. Local Supabase's Auth schema can be a
# different version (for example missing auth.mfa_recovery_code_sets).
# Filter only into the temporary directory; NEVER edit the original backup.
public_copy="$tmp/public-data-PRIVATE.sql"
if ! python3 "$root/scripts/filter-public-pg-dump.py" \
    "$backup/data.sql" "$public_copy"; then
  echo "ERROR: Refusing incomplete or unexpected public-data fixture." >&2
  exit 1
fi
chmod 600 "$public_copy"

echo "Restoring backed-up PUBLIC application data into disposable DB..."
# One transaction; trigger/FK checks are disabled ONLY inside this local restore
# transaction, allowing COPY of circular references among groups/reports.
if ! docker exec -i "$container" psql -U postgres -d postgres \
    -X -q -1 -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate \
    -c 'SET session_replication_role=replica' -f - \
    -c 'SET session_replication_role=origin' \
    < "$public_copy" >>"$log" 2>&1; then
  echo "ERROR: Production public-data dump could not be restored on baseline schema." >&2
  show_safe_sqlstate
  echo "Original backup and production data are untouched. Keep PRIVATE log local." >&2
  exit 1
fi

echo "Comparing restored report data before and after the two migrations..."
if ! {
cat <<'SQL'
\set ON_ERROR_STOP on
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.report_student_overrides
   WHERE attendance_attended IS NOT NULL AND attendance_total IS NOT NULL;
  IF n <> 87 THEN RAISE EXCEPTION 'Attendance override count differs from 87'; END IF;
  SELECT count(*) INTO n FROM public.report_student_overrides
   WHERE nullif(trim(coalesce(comment_en,'')),'') IS NOT NULL
      OR nullif(trim(coalesce(comment_ar,'')),'') IS NOT NULL;
  IF n <> 13 THEN RAISE EXCEPTION 'Saved comment count differs from 13'; END IF;
  SELECT count(*) INTO n FROM public.report_section_approvals;
  IF n <> 10 THEN RAISE EXCEPTION 'Approval count differs from 10'; END IF;
  SELECT count(*) INTO n FROM public.report_batches WHERE scope_type='CLASS' AND status='DRAFT';
  IF n <> 3 THEN RAISE EXCEPTION 'Open cycle count differs from 3'; END IF;
  SELECT count(*) INTO n FROM public.reports WHERE status='DRAFT' AND snapshot_version=2;
  IF n <> 21 THEN RAISE EXCEPTION 'Draft report count differs from 21'; END IF;
  SELECT count(*) INTO n FROM public.email_deliveries;
  IF n <> 0 THEN RAISE EXCEPTION 'Delivery count differs from zero'; END IF;
END $$;
CREATE TEMP TABLE review_before(table_name text primary key,n bigint,hash text);
DO $$
DECLARE name text; expr text;
BEGIN
FOREACH name IN ARRAY ARRAY[
  'report_batches','report_section_approvals','report_section_sources',
  'report_student_overrides','reports','weekly_submissions',
  'weekly_submission_students','weekly_submission_dates',
  'students','subject_groups','groups'
] LOOP
  expr := CASE name
    WHEN 'report_section_approvals' THEN
      'to_jsonb(src) - ''progress_en_approved'' - ''progress_ar_approved'''
    WHEN 'report_student_overrides' THEN
      'to_jsonb(src) - ''progress_en_overridden'' - ''progress_ar_overridden'' - ''comment_en_overridden'' - ''comment_ar_overridden'''
    WHEN 'weekly_submissions' THEN 'to_jsonb(src) - ''attendance_format'''
    WHEN 'weekly_submission_students' THEN
      'to_jsonb(src) - ''attendance_attended'' - ''attendance_total'''
    ELSE 'to_jsonb(src)'
  END;
  EXECUTE format('INSERT INTO review_before
      SELECT %L, count(*),
      md5(coalesce(string_agg((%s)::text, ''|'' ORDER BY (%s)::text), ''''))
      FROM public.%I AS src',name,expr,expr,name);
END LOOP;
END $$;
SQL
cat "$root/supabase/migrations/20261009090000_numeric_teacher_attendance.sql"
cat "$root/supabase/migrations/20261009091000_admin_approved_reports_atomic.sql"
cat <<'SQL'
DO $$
DECLARE baseline record; n bigint; hash text; expr text;
BEGIN
FOR baseline IN SELECT * FROM review_before LOOP
  expr := CASE baseline.table_name
    WHEN 'report_section_approvals' THEN
      'to_jsonb(src) - ''progress_en_approved'' - ''progress_ar_approved'''
    WHEN 'report_student_overrides' THEN
      'to_jsonb(src) - ''progress_en_overridden'' - ''progress_ar_overridden'' - ''comment_en_overridden'' - ''comment_ar_overridden'''
    WHEN 'weekly_submissions' THEN 'to_jsonb(src) - ''attendance_format'''
    WHEN 'weekly_submission_students' THEN
      'to_jsonb(src) - ''attendance_attended'' - ''attendance_total'''
    ELSE 'to_jsonb(src)'
  END;
  EXECUTE format('SELECT count(*),
      md5(coalesce(string_agg((%s)::text, ''|'' ORDER BY (%s)::text), ''''))
      FROM public.%I AS src',expr,expr,baseline.table_name)
    INTO n,hash;
  IF n <> baseline.n OR hash <> baseline.hash THEN
    RAISE EXCEPTION 'Original values changed in protected table %',baseline.table_name;
  END IF;
END LOOP;
IF EXISTS (SELECT 1 FROM public.report_section_approvals
    WHERE NOT progress_en_approved OR NOT progress_ar_approved) THEN
  RAISE EXCEPTION 'Saved shared approvals were not locked';
END IF;
IF EXISTS (SELECT 1 FROM public.report_student_overrides WHERE
    (progress_en IS NOT NULL AND NOT progress_en_overridden) OR
    (progress_ar IS NOT NULL AND NOT progress_ar_overridden) OR
    (comment_en IS NOT NULL AND NOT comment_en_overridden) OR
    (comment_ar IS NOT NULL AND NOT comment_ar_overridden)) THEN
  RAISE EXCEPTION 'Saved Administrator text/comments lost override authority';
END IF;
END $$;
SQL
} | docker exec -i "$container" psql -U postgres -d postgres -X -q -1 \
    -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f - >>"$log" 2>&1; then
  echo "ERROR: Baseline comparison, upgrade, or preserved-value verification failed." >&2
  show_safe_sqlstate
  echo "Everything was rolled back in the disposable database. Production unchanged." >&2
  echo "Do not share private SQL logs or school records." >&2
  exit 1
fi
echo "PASS: 3 cycles, 21 reports, 87 attendance corrections, 13 comments, 10 approvals, zero sends."
echo "PASS: Existing records/Teacher observations/old report snapshots unchanged during upgrade."
echo "PASS: Stored Administrator approvals retain authority after migration."
echo "LIMIT: Public-data restore only; Auth/Storage and live end-to-end email preview not yet verified."
