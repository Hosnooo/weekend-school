# Last active Administrator — concurrent-edit fix (pending verification)

**Status:** Proposed only. Not installed in production, and not a generated Supabase migration.

## Confirmed issue

The server currently counts active Administrator records, then executes a separate update/delete using the Supabase Data API. Under concurrent requests, two Administrators can each observe a count of two and both deactivate/delete separately. A read-only inspection of the production database found only `administrators_set_updated_at`, not an invariant-protection trigger.

This is not solved by the React confirmation or by checking counts again in JavaScript.

## Proposed database safeguard

Apply `last-active-administrator-guard.sql` (trigger **and** atomic delete RPC) as a forward-only migration **only after local verification**. A `BEFORE UPDATE OF is_active OR DELETE` trigger on `public.administrators` checks for a remaining active Administrator after locking the common `public.schools` row `FOR UPDATE`. This serializes competing deactivations within the same school, and applies even when writes bypass the application through the service-role client.

Both database functions are security-invoker, use fully-qualified table names, lock the school scope, and return a known `P0001` error for user-friendly feedback. The delete RPC executes account unlink + Administrator removal within one database transaction so a failed last-Administrator guard rolls back both operations. Only the server-side `service_role` may execute that RPC.

## Required local verification

1. Clone the repository and install exact dependencies using `pnpm install --frozen-lockfile`. A local Docker engine and Supabase CLI are required. Never point test credentials at `tlitseincunvlnnooply` or another hosted database.
2. Run `pnpm exec supabase --version` and `pnpm exec supabase migration new prevent_last_active_administrator_race`. Copy the candidate SQL into the **CLI-generated filename** under `supabase/migrations/`.
3. Copy `last-active-administrator-guard.test.sql` into `supabase/tests/last-active-administrator-guard.test.sql`.
4. Start/recreate a local database with `pnpm exec supabase start` and `pnpm exec supabase db reset`. Run `pnpm test:db`.
5. In two separate local SQL sessions, race deactivation of the two active Administrators in a disposable school; confirm one succeeds and one returns `P0001`. The pgTAP test covers sequential invariants but **does not substitute for this two-session stress test**.
6. Run the existing `tests/e2e/guardian-stale-unlink.spec.ts` with seeded local Supabase and Chromium, plus the critical-errors unit test suite. The Playwright configuration already refuses hosted Supabase URLs.
7. Run local security advisors and review `public.administrators` access grants. Then open a distinct deploy/migration PR.

## Important additional risks

- The trigger protects Administrator business-record active status. Disabling the linked Profile/Auth user or unlinking all Administrator account links may still revoke the last effective login; that is a separate access-capability invariant to audit.
- The candidate includes a transactional delete RPC and an accompanying application-service change. **Deploy the verified database migration before deploying code that invokes the new RPC**. A partially deployed feature would make Administrator deletion fail.
- This patch must not be applied automatically during a normal Vercel deployment. Do not claim a production fix until the migration is verified and applied.

## Existing manual-only GitHub Actions runner

The repository already contains `.github/workflows/ci.yml` with **only** `workflow_dispatch` (no `push`, `pull_request`, or scheduled triggers). On branch `review/atomic-last-admin-guard-20261008`, its review-specific job:

1. Runs repository-wide ESLint and TypeScript checks, all Vitest unit/component/integration-contract tests, and a Next.js production compilation.
2. Creates a **temporary** CLI-generated migration in the disposable runner, stages the candidate guard SQL, and copies its 13 pgTAP assertions into the local Supabase test directory.
3. Replays the historical pre-role-cutover fixture through the forward migrations and checks Teacher attribution survived the upgrade.
4. Runs all PostgreSQL/RLS tests plus the candidate Administrator-guard pgTAP checks, then runs `scripts/test-last-administrator-race.sh` against **localhost only**; one concurrent deactivation must be rejected and one active Administrator must remain.
5. Resets the disposable database, loads local-only browser fixtures, and runs the complete Playwright E2E suite in Chromium (24 spec files). The local fixture explicitly enables optional Performance ratings for those browser scenarios; production defaults remain unchanged.
6. Stops local Supabase using an `if: always()` cleanup step.

All three general CI jobs are skipped when this review branch is selected, avoiding duplicate runs and extra Actions minutes. On other refs their original behavior remains unchanged.

**To manually run:** open GitHub → Actions → **CI** → **Run workflow**, select the review branch, then confirm Run workflow. Do **not** run the separate Production Supabase Migrations workflow for this exercise. The GitHub connection available in this ChatGPT session can inspect workflow runs and edit workflow files, but does not expose a new workflow-dispatch action; preparation does not mean a run was started.

This CI runner remains manual-only even after this branch change. Never merge the database-dependent application change until the candidate migration is reviewed and tested locally.
