#!/usr/bin/env bash
# Exercise migration replay and pgTAP in a UNIQUE, throwaway local Supabase
# stack, without touching the production project or any developer's Webapp
# Docker volumes. The worktree's config.toml uses project_id="Webapp",
# so resetting it directly could wipe someone else's local data.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cli="$root/node_modules/.bin/supabase"
if [[ ! -x "$cli" ]]; then
  echo "ERROR: Local Supabase CLI not installed. Run pnpm install --frozen-lockfile." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running or your user cannot reach it." >&2
  echo "Start Docker and confirm 'docker info' works, then retry. No database was reset." >&2
  exit 1
fi

tmp="$(mktemp -d -t weekend-school-report-db-XXXXXXXX)"
project_id="WebappReportReview$$"
cleanup() {
  # Only stop the uniquely named throwaway stack created in this script.
  (cd "$tmp" && "$cli" stop --project-id "$project_id" --no-backup >/dev/null 2>&1) || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT

mkdir -p "$tmp/supabase"
cp -a "$root/supabase/." "$tmp/supabase/"
# Never copy local/remote link metadata to the disposable project.
rm -rf -- "$tmp/supabase/.temp" "$tmp/supabase/.branches"
config="$tmp/supabase/config.toml"
if ! grep -q '^project_id = "Webapp"$' "$config"; then
  echo "ERROR: Unexpected Supabase configuration; no local stack started." >&2
  exit 1
fi
# Fresh stack ID + separate port group avoids collisions with the original
# application (5532x). This does not modify any tracked project files.
sed -i -e "s/^project_id = \"Webapp\"$/project_id = \"$project_id\"/" \
       -e 's/5532/5632/g' "$config"

echo "Starting an isolated local Supabase stack on review-only ports (5632x)..."
if ! (cd "$tmp" && "$cli" start >"$tmp/start.log" 2>&1); then
  echo "ERROR: Isolated local Supabase failed to start; original local and production DBs are untouched." >&2
  # Do not print status output or credentials. Surface only likely error lines.
  grep -Ei 'error|failed|fatal|migration|syntax|port in use|denied|timed out|cannot|could not' \
      "$tmp/start.log" | grep -Evi 'key|token|password|postgres(ql)?://|secret' | tail -n 25 >&2 || true
  exit 1
fi

status="$(cd "$tmp" && "$cli" status 2>&1)" || {
  echo "ERROR: Disposable stack did not reach healthy status." >&2
  exit 1
}
if [[ "$status" != *"127.0.0.1:56322"* && "$status" != *"localhost:56322"* ]]; then
  echo "ERROR: Review-only local database address was not verified; aborting reset." >&2
  exit 1
fi

echo "Resetting ONLY the disposable local project and replaying every migration..."
(cd "$tmp" && "$cli" db reset --local)
echo "Running the complete pgTAP suite against ONLY that local database..."
(cd "$tmp" && "$cli" test db --local)
echo "PASS: isolated local migration replay and database tests completed."
