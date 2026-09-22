# Weekend School Management

A bilingual English/Arabic application for weekend-school administration, weekly teacher updates, immutable student reports, and controlled report email delivery. The product contract is [docs/SPEC.md](docs/SPEC.md); implementation status is tracked in [docs/PROGRESS.md](docs/PROGRESS.md).

## Prerequisites

- Node.js 22 or newer
- pnpm 11 (the exact package-manager version is recorded in `package.json`)
- A Docker-compatible container runtime
- Supabase CLI, installed as this project's pinned development dependency
- Chromium for the Playwright end-to-end suite

## Installation

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm browsers:install
```

## Environment variables

Copy `.env.example` to `.env.local` and replace every placeholder. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public client configuration. `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, and `CRON_SECRET` are server-only secrets and must never use a `NEXT_PUBLIC_` prefix or be committed.

For local development, start Supabase and copy the API URL, anonymous key, and service-role key shown by `pnpm db:status` into `.env.local`. Brevo is required only for an explicitly authorized live email smoke test; automated tests never call the live provider.

## Supabase setup

Start the pinned local stack from the repository root:

```powershell
pnpm db:start
pnpm db:status
```

The local stack is disposable development infrastructure. Do not reuse its credentials or the sample user passwords in a hosted environment.

## Database migration

Apply every forward-only migration to a fresh local database and verify that the full sequence reproduces from zero:

```powershell
pnpm db:reset
```

`db:reset` applies the ordered files in `supabase/migrations/` and then `supabase/seed.sql`. Never edit a migration that has been applied to a shared database; add a new migration instead.

## Seed data

`supabase/seed.sql` is idempotent and development-only. It creates one bilingual school, one administrator, two teachers, three groups, twelve students with guardians, memberships, and submitted bilingual history.

Local sign-in accounts all use the password `WeekendSchool1!`:

| Role | Email |
|---|---|
| Administrator | `admin@example.test` |
| English teacher | `teacher.en@example.test` |
| Arabic teacher | `teacher.ar@example.test` |

Rerun the migration and seed from a known state with `pnpm db:reset`.

## Development

```powershell
pnpm dev
```

Open `http://127.0.0.1:3000/en/login` for English or `http://127.0.0.1:3000/ar/login` for Arabic. Arabic pages set both `lang="ar"` and `dir="rtl"`.

### One-click Windows launcher

Install the desktop shortcut once:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-desktop-shortcut.ps1
```

Open Docker Desktop first and wait until its engine is running. The **Weekend School** shortcut checks Docker without trying to start it, starts the existing local Supabase data without resetting it, refreshes the ignored `.env.local` with local credentials, starts the web application in a minimized terminal, and opens the English login page. Startup errors remain visible in the launcher window.

## Testing

Run the fast suite and static checks:

```powershell
pnpm lint
pnpm typecheck
pnpm test
```

With the local Supabase stack running and freshly reset, run the real pgTAP RLS matrix:

```powershell
pnpm test:db
```

Run exactly the four required browser workflows against the seeded local stack:

```powershell
pnpm test:e2e
```

The E2E process uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` to finish the password setup for the teacher invited during the English workflow. It runs serially because all four workflows intentionally exercise one shared database. Reset the database before each complete E2E run.

## Production build

```powershell
pnpm build
pnpm start
```

A successful build validates compilation only. It does not prove live Supabase access, RLS behavior, or email-provider connectivity.

## Deployment

1. Create a hosted Supabase project and apply the migration files in order using the Supabase CLI or the platform's approved CI workflow.
2. Do not apply `supabase/seed.sql` to production.
3. Configure the public Supabase URL/key and all server-only secrets in the hosting platform. Keep `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, and `CRON_SECRET` server-only.
4. Set the application's Site URL and allowed `/en/set-password` and `/ar/set-password` redirect URLs in Supabase Auth. Disable public signup for the invite-only pilot.
5. Configure Supabase Auth custom SMTP separately from the app's Brevo API key. Teacher invitations are sent by Supabase Auth and need the Brevo SMTP login and SMTP key; parent reports use `BREVO_API_KEY` through the application.
6. Run lint, type-check, unit/component tests, real database/RLS tests, E2E tests, and the production build before promotion.
7. Perform a Brevo smoke test only with explicit authorization and a verified sender address.

Deploy one Next.js application; no worker, queue, scheduler, or second service is required for this MVP.
