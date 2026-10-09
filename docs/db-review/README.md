# Last active Administrator — concurrent-edit fix (pending verification)

**Status:** Proposed only. Not installed in production, and not a generated Supabase migration.

## Confirmed issue

The server currently counts active Administrator records, then executes a separate update/delete using the Supabase Data API. Under concurrent requests, two Administrators can each observe a count of two and both deactivate/delete separately. A read-only inspection of the production database found only `administrators_set_updated_at`, not an invariant-protection trigger.

This is not solved by the React confirmation or by checking counts again in JavaScript.

## Proposed database safeguard

Apply `last-active-administrator-guard.sql` (trigger **and** atomic delete RPC) as a forward-only migration **only after local verification**. A `BEFORE UPDATE OF is_active, school_id OR DELETE` trigger on `public.administrators` checks for a remaining active Administrator after locking the common `public.schools` row `FOR UPDATE`. This serializes competing deactivations within the same school, and applies even when writes bypass the application through the service-role client.

Both database functions are security-invoker, use fully-qualified table names, lock the school scope, and return a known `P0001` error for user-friendly feedback. The delete RPC executes account unlink + Administrator removal within one database transaction so a failed last-Administrator guard rolls back both operations. Only the server-side `service_role` may execute that RPC. The guard also forbids changing an Administrator's school, which would otherwise bypass deactivation checks.

## Required local verification

1. Install the locked dependencies (`pnpm install --frozen-lockfile`) and start the **local** Supabase project. Never use hosted project credentials for a destructive race test.
2. With local Supabase already running on API port `55321` and Postgres port `55322`, run **`bash scripts/verify-last-administrator-guard-local.sh`** once. It refuses remote URLs, **resets the disposable local database once** to remove E2E fixtures, installs the candidate locally, runs existing PostgreSQL tests, executes the **18 pgTAP checks** (including RPC privileges and school immutability), and races two deactivations. It performs **no hosted operation, migration or deployment**. This local reset deletes local test data, not hosted data.
3. Only after local verification passes, generate a real migration with `pnpm exec supabase migration new prevent_last_active_administrator_race`; copy the candidate SQL into the CLI-generated file and confirm a fresh **local** `pnpm db:reset` applies it. Never invent migration timestamps.
4. Review Administrator table grants and local database security advisors. Update the strict migration-order unit test to include the new migration before running the final migration-specific checks.
5. Commit the validated migration as a separate database release. Apply it **before** shipping the application code that calls the new atomic delete RPC; verify that function exists after applying it. The full application unit/build/E2E checks have already passed independently.

## Important additional risks

- The trigger protects Administrator business-record active status. Disabling the linked Profile/Auth user or unlinking all Administrator account links may still revoke the last effective login; that is a separate access-capability invariant to audit.
- The candidate includes a transactional delete RPC and an accompanying application-service change. **Deploy the verified database migration before deploying code that invokes the new RPC**. A partially deployed feature would make Administrator deletion fail.
- This patch must not be applied automatically during a normal Vercel deployment. Do not claim a production fix until the migration is verified and applied.

## Existing manual-only GitHub Actions runner

The repository already contains `.github/workflows/ci.yml` with **only** `workflow_dispatch` (no `push`, `pull_request`, or scheduled triggers). On branch `review/atomic-last-admin-guard-20261008`, its review-specific job:

1. Runs repository-wide ESLint and TypeScript checks, all Vitest unit/component/integration-contract tests, and a Next.js production compilation.
2. Creates a **temporary** CLI-generated migration in the disposable runner, stages the candidate guard SQL, and copies its 18 pgTAP assertions into the local Supabase test directory.
3. Replays the historical pre-role-cutover fixture through the forward migrations and checks Teacher attribution survived the upgrade.
4. Runs all PostgreSQL/RLS tests plus the candidate Administrator-guard pgTAP checks, then runs `scripts/test-last-administrator-race.sh` against **localhost only**; one concurrent deactivation must be rejected and one active Administrator must remain.
5. Resets the disposable database, loads local-only browser fixtures, and runs the complete Playwright E2E suite in Chromium (24 spec files). The local fixture explicitly enables optional Performance ratings for those browser scenarios; production defaults remain unchanged.
6. Stops local Supabase using an `if: always()` cleanup step.

All three general CI jobs are skipped when this review branch is selected, avoiding duplicate runs and extra Actions minutes. On other refs their original behavior remains unchanged.

**To manually run:** open GitHub → Actions → **CI** → **Run workflow**, select the review branch, then confirm Run workflow. Do **not** run the separate Production Supabase Migrations workflow for this exercise. The GitHub connection available in this ChatGPT session can inspect workflow runs and edit workflow files, but does not expose a new workflow-dispatch action; preparation does not mean a run was started.

This CI runner remains manual-only even after this branch change. Never merge the database-dependent application change until the candidate migration is reviewed and tested locally.
