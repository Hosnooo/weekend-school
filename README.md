# Weekend School

Weekend School is a bilingual school-operations application for administrators and teachers. Administrators organize Classes, Subjects, optional Groups, people, teaching assignments, Teaching Update requests, report cycles, delivery, and protected exports. Teachers manage their assigned Class Subjects, submit dated Teaching Updates, and review their history. The product contract is [docs/SPEC.md](docs/SPEC.md); durable architectural decisions are in [docs/DECISIONS.md](docs/DECISIONS.md).

One login can have Administrator capability, Teacher capability, both, or neither. Supabase Auth supplies the login identity. Independent school business records and explicit account links grant the capabilities; matching names or email addresses never grant access.

## Main workflows

- **Access:** Administrators invite or link accounts. Users set or recover passwords through Supabase Auth. Public signup is disabled for the invite-only deployment.
- **Administration:** The dashboard surfaces work needing attention. Administrators manage Administrator and Teacher records, Classes, Subjects, optional Groups, assignments, Students, Guardians, enrollment, archives, and school settings.
- **Roster CSV:** Administrators download a school-specific template, preview row errors and Guardian/Class resolution, then confirm one transactional import. A missing Class can be created as part of that transaction. Current school or single-Class rosters can be exported as CSV.
- **Teaching Updates:** Teachers create updates for a Class Subject and optional Group using a date range or selected dates. Administrators can request linked updates, review completion, and reopen or dismiss eligible work. Submitted source history stays attributable to its Teacher.
- **Reports:** Administrators create a Class Report Cycle for a custom period, choose submitted sources, resolve attendance and student content, preview Guardian output, and finalize immutable report snapshots. Corrections create revisions. The Reports workspace tracks email delivery and retries.
- **Exports and deletion:** Administrators can request protected historical exports. Normal record removal uses archive/restore; permanent deletion is an explicit administrator action with a dependent-data preview and a school-scoped transaction.

## Architecture

The application is one Next.js App Router modular monolith. Pages and Server Actions call feature services; services apply business rules and use repositories; repositories reach Supabase/PostgreSQL. Provider adapters handle external email and Auth concerns. PostgreSQL row-level security (RLS) is a second authorization layer.

## Repository map

```text
src/app/             locale routes, layouts, Server Actions, external Route Handlers
src/features/        feature UI, schemas, services, repositories, domain types
src/components/      reusable presentational elements
src/lib/             shared Auth, Supabase, environment, validation infrastructure
messages/            English and Arabic application copy
supabase/            configuration, forward-only migrations, development seeds, pgTAP
tests/               unit, component, integration, and browser workflows
scripts/             local Windows launcher and shortcut setup
docs/                product specification and durable decisions
```

## Internationalization

The user routes live under `/en/...` and `/ar/...`. Arabic sets document `lang="ar"` and `dir="rtl"`; layout uses direction-aware styling. Teacher-authored content is preserved in its authored language and follows the fallback rules in the specification.

## Security and data

Every school-owned row is scoped to a school. Server-side capability checks and PostgreSQL RLS both protect reads and mutations. Authenticated users without an active linked capability receive no corresponding school access. `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, and `CRON_SECRET` remain server-only and must never use a `NEXT_PUBLIC_` name.

Submitted Teaching Updates and finalized report snapshots preserve historical evidence. A finalized report is not silently regenerated when source data changes. Archive/restore is the normal lifecycle; permanent deletion requires an archived target when meaningful history exists, an impact preview, and confirmed same-school transactional deletion. Exports use protected downloads rather than public permanent links.

## Local development

Prerequisites: Node.js 22+, Corepack/pnpm 11.19.0, and a Docker-compatible runtime. The pinned Supabase CLI, Vitest, and Playwright are development dependencies. Chromium is needed for browser tests.

```text
corepack enable
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:reset
pnpm db:status
```

Copy `.env.example` to `.env.local`. Use the local `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` from `pnpm db:status` for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep `.env.local` uncommitted. Set local placeholder values for Brevo and the other server-only variables unless testing an authorized provider connection. The two `NEXT_PUBLIC_` values are deliberately browser-visible.

```text
pnpm dev
```

Open `http://127.0.0.1:3000/en/login` or `http://127.0.0.1:3000/ar/login`. On Windows, `scripts/install-desktop-shortcut.ps1` installs an optional launcher; `scripts/start-local.ps1` starts the existing local stack and refreshes local environment values without resetting data.

## Database

`pnpm db:reset` replays every migration and then `supabase/seed.sql`. Both seeds are development-only and must never be pushed to production. The local sample accounts created by `seed.sql` include `admin@example.test`, `teacher.en@example.test`, and `teacher.ar@example.test` with the development password `WeekendSchool1!`.

## Tests

```text
pnpm lint           # ESLint
pnpm typecheck      # strict TypeScript
pnpm test           # unit, component, and static contracts
pnpm build          # production Next.js build
pnpm test:db        # real PostgreSQL constraints, permissions, and RLS via pgTAP
pnpm test:e2e       # serial browser workflows against local Supabase
```

For the database gate, run `pnpm db:start`, `pnpm db:reset`, then `pnpm test:db`. The separate compatibility fixture in `supabase/fixtures/` verifies the historical Profile-to-Teacher migration upgrade path in CI; it is not part of a normal clean reset.

For the browser gate, reset local Supabase and load the E2E-only seed into its local Postgres container. The reset first loads `supabase/seed.sql` as configured in `supabase/config.toml`; `seed.e2e.sql` then adds Class/Subject/Group and archive fixtures on top of that base, using stable IDs and conflict handling so it does not create duplicate base accounts or Students:

```text
pnpm db:reset
docker cp supabase/seed.e2e.sql supabase_db_Webapp:/tmp/seed.e2e.sql
docker exec supabase_db_Webapp psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed.e2e.sql
pnpm browsers:install
pnpm test:e2e
```

Set `.env.local` to that local stack first. The Playwright configuration rejects hosted Supabase URLs. The E2E suite runs serially because its workflows share fixtures. Stop the local stack with `pnpm db:stop` when finished.

## Deployment

CI in `.github/workflows/ci.yml` checks quality, a clean database/RLS reset, the named historical migration upgrade fixture, and the browser suite. The production database workflow is separate and manual: `.github/workflows/production-supabase-migrations.yml` takes the full SHA of a reviewed release candidate. In GitHub Actions, select that candidate branch as the workflow branch and supply its exact HEAD SHA as `revision`. The workflow checks both, links the intended Supabase project, lists migration history, and runs a dry-run preview. Use `apply=false` for the preview; invoke it again at the same SHA with `apply=true` only after the production environment approval and migration review. Keep the candidate branch at that SHA between preview and apply; if it moves, rerun CI and preview the new SHA. A migration-history mismatch must be reconciled separately before application. Protect the `production` environment with required reviewers in GitHub settings. Configure `SUPABASE_PROJECT_REF` as a repository variable and `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as repository secrets. The workflow never includes development seeds.

GitHub requires a `workflow_dispatch` file on the default branch before it can be run. This workflow path already exists on `main`; choose the reviewed release-candidate branch in the **Run workflow** branch selector so its updated workflow and exact SHA are used for this release. Keep the manual workflow available for subsequent candidate releases.

Release order:

```text
verify the reviewed release candidate and its CI
→ reconcile any production migration-history mismatch under separate approval
→ preview candidate migrations at its exact SHA
→ approve and apply backward-compatible migrations at that same SHA
→ verify production schema and RLS
→ merge or promote the reviewed application changes
→ smoke test English, Arabic, Administrator, Teacher, reports, and delivery
```

Only apply a candidate's migrations before its application reaches production when those migrations are backward-compatible with the currently deployed application. If a change is destructive or incompatible, use an expand/migrate/contract sequence across separate releases: add compatible schema, migrate data and application use, then remove old schema after no deployed code needs it. With Vercel set to deploy `main` automatically, merge the reviewed application changes only after the required compatible migrations are verified. Vercel hosts the Next.js application; Supabase hosts Auth and PostgreSQL. Configure Supabase Auth Site URL, English/Arabic password redirect URLs, invite-only signup, and its custom SMTP separately. Supabase Auth invitations and recovery use SMTP credentials; parent report delivery uses the application Brevo API key and a verified sender. No production email or hosted migration should be tested with development seed data.
