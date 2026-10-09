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

if [[ "${REPORT_OUTPUT_PARITY:-0}" == 1 ]]; then
  echo "Starting application report-output parity against ONLY the disposable restore..."
  # Obtain the key from the locally running disposable Supabase stack. Never
  # echo keys, use .env.local (may point to production), or source untrusted text.
  local_status="$(cd "$tmp" && "$cli" status -o env)" || {
    echo "ERROR: Cannot retrieve disposable local Supabase configuration." >&2
    exit 1
  }
  api_url="$(printf '%s\n' "$local_status" | sed -n 's/^API_URL=//p' | head -n 1 | tr -d '"')"
  service_key="$(printf '%s\n' "$local_status" | sed -n 's/^SERVICE_ROLE_KEY=//p' | head -n 1 | tr -d '"')"
  unset local_status
  if [[ "$api_url" != "http://127.0.0.1:56421" || -z "$service_key" ]]; then
    echo "ERROR: Could not validate local-only API URL and service key; no parity test run." >&2
    exit 1
  fi
  parity_result="$tmp/PRIVATE-parity-result.txt"
  if ! (cd "$root" &&
    REPORT_PARITY_URL="$api_url" REPORT_PARITY_SERVICE_ROLE_KEY="$service_key" \
      REPORT_PARITY_RESULT_FILE="$parity_result" \
      pnpm exec vitest run --configLoader runner \
      tests/integration/report-production-parity.local.test.ts >>"$log" 2>&1); then
    unset api_url service_key
    echo "FAIL: Restored-production report-output parity. Production unchanged." >&2
    echo "Review the PRIVATE local log only; do not upload logs containing school data." >&2
    exit 1
  fi
  unset api_url service_key
  # Vitest exits successfully when a suite is skipped. Require a private
  # per-run marker written ONLY after every real-cycle assertion passed.
  if [[ ! -f "$parity_result" ]]; then
    echo "FAIL: Parity suite did not produce its execution marker; it may have been skipped." >&2
    echo "Inspect the PRIVATE local log; do not share school records." >&2
    exit 1
  fi
  parity_summary="$(cat "$parity_result")"
  if ! printf '%s\n' "$parity_summary" | grep -Eq '^PASS: 3 cycles; reports=[0-9]+; report sections=[0-9]+; eligible attendance pairs=[0-9]+; out-of-eligibility historical pairs=[0-9]+; checked explicit Admin fields=[0-9]+$'; then
    echo "FAIL: Parity execution marker is malformed; no release pass established." >&2
    exit 1
  fi
  printf '%s\n' "$parity_summary"
  echo "PASS: Application finalization payload, live preview and guardian email parity against restored production PUBLIC data."
  echo "LIMIT: The actual finalization RPC is intentionally intercepted; no database reports or emails were created."
fi

if [[ "${REPORT_DB_RPC_ROLLBACK:-0}" == 1 ]]; then
  echo "Testing ACTUAL Administrator-save and finalization SQL in disposable restore..."
  if ! docker ps --format '{{.Names}}' | grep -Fxq "$container"; then
    echo "ERROR: Isolated restore container disappeared; refusing SQL verification." >&2
    exit 1
  fi
  if ! docker exec -i "$container" psql -U postgres -d postgres \
      -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f - \
      < "$root/scripts/verify-report-authority-rpcs-rollback.sql" >>"$log" 2>&1; then
    echo "FAIL: Actual report RPC rollback verification failed." >&2
    show_safe_sqlstate
    echo "Review the PRIVATE local log only; do not share private database records." >&2
    exit 1
  fi
  if ! grep -Fq 'PASS: Actual atomic Admin RPC + 3 finalized cycles + 29 saved revisions validated inside disposable transaction' "$log" ||
     ! grep -Fq 'PASS: Transaction rollback restored all protected report, Teacher and school rows unchanged' "$log"; then
    echo "FAIL: RPC execution or rollback confirmation marker missing." >&2
    exit 1
  fi
  echo "PASS: Actual atomic Admin save rejects invalid input and commits bilingual/numeric corrections inside transaction."
  echo "PASS: Actual finalization RPC created 29 unsent READY revisions for all three cycles in disposable database."
  echo "PASS: All RPC writes rolled back; protected records, Teacher data and previous report snapshots match baseline hashes."
  echo "LIMIT: SQL finalization uses a minimal valid V2 envelope; full output/email parity was verified separately."
fi

if [[ "${REPORT_AUTH_UI:-0}" == 1 ]]; then
  echo "Testing restored Auth identities and browser UI in the SAME disposable local project..."
  # Fail closed: do not import ANY Auth record into a nonempty target.
  if ! docker exec "$container" psql -U postgres -d postgres -X -At \
      -c 'select (select count(*) from auth.users) + (select count(*) from auth.identities)' |
      grep -qx '0'; then
    echo "FAIL: Disposable Auth target is not empty. No Auth import attempted." >&2
    exit 1
  fi
  local_auth_schema="$tmp/PRIVATE-auth-schema.json"
  if ! docker exec "$container" psql -U postgres -d postgres -X -At \
      -c "SELECT json_build_object(
         'auth.users', (SELECT coalesce(json_agg(column_name ORDER BY ordinal_position), '[]'::json)
           FROM information_schema.columns WHERE table_schema='auth' AND table_name='users'),
         'auth.identities', (SELECT coalesce(json_agg(column_name ORDER BY ordinal_position), '[]'::json)
           FROM information_schema.columns WHERE table_schema='auth' AND table_name='identities'))::text" \
      >"$local_auth_schema" 2>>"$log"; then
    echo "FAIL: Cannot inspect isolated local Auth schema." >&2
    exit 1
  fi
  auth_copy="$tmp/PRIVATE-auth-identity-fixture.sql"
  if ! python3 "$root/scripts/prepare-local-auth-recovery.py" \
       "$backup/data.sql" "$local_auth_schema" "$auth_copy"; then
    echo "FAIL: Managed Auth table compatibility preflight; no Auth import attempted." >&2
    exit 1
  fi
  # Only the six backed-up users and identities are imported. Session/refresh
  # tokens must NEVER be copied into the local browser-test environment.
  if ! docker exec -i "$container" psql -U postgres -d postgres -X -q -1 \
      -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate \
      -c 'SET session_replication_role=replica' -f - \
      -c 'SET session_replication_role=origin' \
      < "$auth_copy" >>"$log" 2>&1; then
    echo "FAIL: Supabase-managed Auth data incompatible with local GoTrue schema." >&2
    show_safe_sqlstate
    echo "Original backup and production remain untouched." >&2
    exit 1
  fi
  # Validate ALL restored profile references and identity-user keys without
  # printing or accessing personally identifying values.
  if ! docker exec "$container" psql -U postgres -d postgres -X -At \
      -v ON_ERROR_STOP=1 -c "SELECT
         (SELECT count(*) FROM auth.users)=6 AND
         (SELECT count(*) FROM auth.identities)=6 AND
         (SELECT count(*) FROM public.profiles)=6 AND
         NOT EXISTS (SELECT 1 FROM public.profiles p LEFT JOIN auth.users u
                      ON p.auth_user_id=u.id WHERE u.id IS NULL) AND
         NOT EXISTS (SELECT 1 FROM auth.identities i LEFT JOIN auth.users u
                      ON i.user_id=u.id WHERE u.id IS NULL)" \
        2>>"$log" | grep -qx t; then
    echo "FAIL: Restored user, identity and profile referential integrity." >&2
    exit 1
  fi
  echo "PASS: Six backed-up Auth users, identities and public profiles reference valid restored identities."

  local_status="$(cd "$tmp" && "$cli" status -o env)" || {
    echo "ERROR: Disposable Supabase credentials unavailable." >&2; exit 1;
  }
  api_url="$(printf '%s\n' "$local_status" | sed -n 's/^API_URL=//p' | head -n 1 | tr -d '"')"
  service_key="$(printf '%s\n' "$local_status" | sed -n 's/^SERVICE_ROLE_KEY=//p' | head -n 1 | tr -d '"')"
  anon_key="$(printf '%s\n' "$local_status" | sed -n 's/^ANON_KEY=//p' | head -n 1 | tr -d '"')"
  unset local_status
  if [[ "$api_url" != http://127.0.0.1:56421 || -z "$service_key" || -z "$anon_key" ]]; then
    echo "FAIL: Unexpected isolated API URL or missing local-only Auth keys." >&2
    exit 1
  fi
  local_creds="$tmp/PRIVATE-restored-auth-browser-credentials.json"
  if ! (cd "$root" &&
      REPORT_RECOVERY_API_URL="$api_url" \
      REPORT_RECOVERY_SERVICE_KEY="$service_key" \
      REPORT_RECOVERY_ANON_KEY="$anon_key" \
      REPORT_RECOVERY_CREDENTIAL_FILE="$local_creds" \
      node scripts/prepare-local-auth-ui-smoke.mjs >>"$log" 2>&1); then
    echo "FAIL: Restored GoTrue Auth password sign-in or role-account checks." >&2
    echo "Inspect private local log; never share identity/credentials." >&2
    exit 1
  fi
  echo "PASS: Restored Administrator and Teacher-only account can sign in using temporary local-only credentials."

  # Browser tests deliberately do not finalize reports or invoke email send.
  # Empty email credentials prevent contacting Brevo, even accidentally.
  if ! (cd "$root" &&
      NEXT_PUBLIC_SUPABASE_URL="$api_url" \
      NEXT_PUBLIC_SUPABASE_ANON_KEY="$anon_key" \
      SUPABASE_SERVICE_ROLE_KEY="$service_key" \
      BREVO_API_KEY='' EMAIL_FROM='' \
      REPORT_RECOVERY_CREDENTIAL_FILE="$local_creds" \
      REPORT_RECOVERY_ARTIFACT_DIR="$tmp/PRIVATE-playwright" \
      pnpm exec playwright test --config playwright.report-recovery.config.ts \
      >>"$log" 2>&1); then
    echo "FAIL: Administrator/Teacher browser smoke tests against restored local project." >&2
    echo "Review PRIVATE log only. Production remains untouched." >&2
    exit 1
  fi
  if ! grep -Fq 'PASS: Restored Admin browser save, reload and bilingual email-preview smoke.' "$log" ||
     ! grep -Fq 'PASS: Restored Teacher-only browser identity cannot open Admin report editor.' "$log"; then
    echo "FAIL: Browser suite exited without both required execution markers." >&2
    exit 1
  fi
  unset api_url service_key anon_key
  echo "PASS: Local browser Administrator report save/reload and bilingual guardian-email preview."
  echo "PASS: Restored Teacher-only identity blocked from Administrator editor."
  echo "LIMIT: Only core Auth users/identities were restored; sessions, MFA and Auth configuration are NOT fully verified."
  echo "PASS: Disposable project and temporary credentials are removed by EXIT cleanup."
fi
