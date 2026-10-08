# Local regression testing on Windows — no repeated CI minutes

This guide tests the unmerged review branch. **Never point these checks at a hosted Supabase project.** No Vercel deployment or GitHub Actions job is involved.

## First-time setup (once per checkout)

Install Node.js 22+, pnpm/Corepack, Docker Desktop and the pinned dependencies:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm db:start
pnpm browsers:install
```

Use `scripts/start-local.ps1` to set local URLs in `.env.local` and launch the existing local app (it does **not** reset data). Playwright also starts/reuses a local Next development server automatically.

## Prepare disposable E2E data (explicit reset)

**Warning:** `pnpm db:reset` destroys the current `Webapp` local database, not the hosted database. Back up any local work first and only perform this step in an expendable test environment.

```powershell
pnpm db:reset
docker cp supabase/seed.e2e.sql supabase_db_Webapp:/tmp/seed.e2e.sql
docker exec supabase_db_Webapp psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed.e2e.sql
```

This loads the current Class/Subject/Group fixtures and activates optional Performance ratings **only in the local E2E database**. The new Teacher-template read policy is supplied by this branch's forward migration. Do not expect fresh fixtures without a reset: browser tests change records as they run.

Alternatively, the local runner can do **the same explicit local-only reset and fixture load** when you request it:

```powershell
.\scripts\test-local-regression.ps1 -Mode Smoke -ResetLocalFixtures
```

Without `-ResetLocalFixtures`, the runner never resets or reseeds the database.

## Fast iteration (no repeated installations or reset)

Run in PowerShell from the repository root:

```powershell
.\scripts\test-local-regression.ps1 -Mode Unit
.\scripts\test-local-regression.ps1 -Mode Smoke
```

The smoke mode executes four high-value specs (Admin Teaching Updates, Arabic reports, English reports, and Report Cycle workflow) and stops at the **first** Playwright failure. Both commands reuse local dependencies; neither resets your database, deploys, or contacts GitHub Actions. It also validates that the Supabase API and database point to localhost.

Other modes:

```powershell
.\scripts\test-local-regression.ps1 -Mode Database
.\scripts\test-local-regression.ps1 -Mode Quality
.\scripts\test-local-regression.ps1 -Mode Browser
.\scripts\test-local-regression.ps1 -Mode All
```

`Quality` runs lint, typecheck, Vitest, and the Next build. `Database` runs pgTAP on the current local schema. `Browser` runs all browser specs but stops on the first failure; `All` runs quality, database and browser checks. None of these modes performs a hidden database reset. When rerunning stateful browser specs after a completed/partial run, **reset and reload disposable fixtures explicitly first**.

For a single failing browser spec, you can bypass the runner and use the pinned Playwright CLI with fail-fast enabled, after ensuring `.env.local` points to local services:

```powershell
$env:E2E_FAIL_FAST = 'true'
pnpm test:e2e tests/e2e/arabic-flow.spec.ts
```

## Last-active Administrator candidate

The concurrent Administrator guard in `docs/db-review/last-active-administrator-guard.sql` is a **proposed**, unmerged migration. It is not applied to your hosted school. The ordinary clean-reset commands above **do not automatically install this separate candidate**. To validate that specific safeguard, follow `docs/db-review/README.md`: stage its SQL as a CLI-generated temporary local migration **before** the disposable database reset, stage its pgTAP test, run the database tests and the two-session race checker, and remove only the temporary staged files after verification.

Stage the candidate **after** running the static migration-contract tests (or remove it before rerunning those tests), since the contract test intentionally pins the migration filenames in the repository.

## What counts as verified

Unit tests and builds cannot prove database authorization or browser behavior. The PR should not be merged or deployed until the full local quality, database/RLS, concurrency, and browser checks pass on the same revision. Keep CI manual-only as a final independent confirmation, not a debugging loop.
