# Task 12 Verification — Architecture Correction

Verified on 2026-09-24 against branch `codex/class-subject-group-redesign-spec`, commit `899b3aefdc5493313ddc6588b930d8feb9b0958e`.

Task 12 is complete based on GitHub Actions **Redesign CI #191** (`35953597589`), which completed successfully on the exact commit above.

## Fresh verification evidence

### Quality

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — **37 test files, 162 tests passed**.
- `pnpm build` — passed with Next.js 16.3.5; optimized production compilation, TypeScript, page-data collection, and static generation all completed successfully.

### Database

- Local Supabase started successfully.
- `pnpm db:reset` — passed from a fresh local database, applying migrations 1–27 and the development seed.
- `pnpm test:db` — **11 pgTAP files, 157 tests passed**.
- Result: `PASS`.

### Browser workflows

- Local Supabase reset and redesigned E2E fixtures loaded successfully.
- Chromium installed successfully.
- `pnpm test:e2e` — **6/6 Playwright workflows passed** using one worker.
- Covered the approved Task 12 browser gate, including English/Arabic redesigned workflows, authorization boundaries, sparse student exception behavior, co-teacher attendance conflict resolution, and archive/export/restore/permanent-delete behavior.
- The development server emitted one non-fatal `The destination stream closed early` message during the browser run; all six workflows still completed successfully. Runtime/log review remains part of Task 13.

## Release boundary

Task 12 verification does **not** authorize release side effects.

At this checkpoint:

- `main` is untouched by the redesign closeout.
- Hosted Supabase redesign migrations **19–27** remain unapplied.
- Production remains on the previous release.
- Phase 2 roster CSV remains blocked until Task 13 completes the preview, hosted migration, production deployment, runtime-error review, and production smoke-test gates.

## Next: Task 13

Task 13 is the release/readiness gate. It begins with non-production checks: inspect the Vercel Preview for this branch and inspect hosted Supabase state read-only. Only after those checks are clean should the intentional release sequence proceed: apply hosted migrations 19–27 in order, run hosted SQL safety checks, deploy the production code, run production smoke tests, review runtime errors/logs, and update release documentation.
