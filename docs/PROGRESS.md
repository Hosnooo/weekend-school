# Implementation Progress

Last updated: 2026-09-20

## Current status

Planning and the locally verifiable portions of Phases 1–3 are complete. Phase 3 work is on `phase-3-teacher-workflow` and includes the Phase 2 commit as its base.

## Planning completed

- Read and preserved the complete product specification at `docs/SPEC.md`.
- Inspected the repository; it initially contained only a misnamed root specification and no Git or application scaffold.
- Added the repository working agreement in `AGENTS.md`.
- Defined the six-phase implementation plan, target file structure, migration order, dependency list, and test strategy.
- Recorded architectural interpretations, simplifications, and security decisions in `docs/DECISIONS.md`.

## Phase 1 — Foundation

Status: Complete.

Completed:

- Created a pinned pnpm/Next.js 16 project with strict TypeScript, Tailwind, ESLint, Vitest, Testing Library, and a reproducible lockfile.
- Added validated public environment configuration and separate Supabase browser, server, and proxy clients. No service-role client or secret is exposed to browser code.
- Added seven ordered forward-only migrations covering all specified MVP tables, tenant-safe composite relationships, history-preserving constraints, duplicate prevention, immutable submitted sessions/report snapshots, least-privilege RLS, and teacher self-service language preference only.
- Added `next-intl` locale routing, complete foundation message catalogs, locale switching, persisted authenticated preference, and document-level `lang`/`dir`.
- Added accessible email/password login, generic login failures, logout, active-profile checks, admin/teacher role route boundaries, exact role navigation, and responsive foundation pages.
- Added test-first coverage for public environment validation, locale guards/direction, login normalization, safe language redirects, role navigation, active-profile authorization, accessible navigation, migration ordering, required tables/RLS, and duplicate invariants.

Verification evidence from 2026-09-20:

- `pnpm lint` — passed with zero warnings/errors.
- `pnpm typecheck` — passed.
- `pnpm test` — 4 files and 19 tests passed.
- `pnpm build` — passed; Next.js generated all 22 pages and both locale login variants.
- Production HTTP smoke check — `/en/login` and `/ar/login` returned 200; English rendered `lang="en" dir="ltr"`, Arabic rendered `lang="ar" dir="rtl"`, and both rendered their translated school name.

Not claimed in Phase 1:

- Live Supabase migration execution, Auth login, and adversarial RLS runtime tests were not possible on this workstation because Docker and the Supabase CLI are unavailable and no remote project credentials were provided. SQL contract tests passed, but real PostgreSQL/RLS execution remains mandatory before MVP completion.
- Feature pages intentionally remain translated foundation/empty states. Their product behavior belongs to Phases 2–5.

## Phase 2 — School Administration

Status: Implementation complete; live Supabase verification remains outstanding.

Completed:

- Added normalized Zod schemas, typed repositories, and admin-only Server Actions for students, guardians, groups, memberships, teacher invitations, and exact group assignments.
- Added an eighth forward-only migration with atomic student/guardian/membership creation, atomic group/teacher updates, atomic teacher assignment replacement, one-primary-teacher enforcement, normalized guardian email uniqueness, and the required delete policy for assignment replacement.
- Added a server-only service-role client and compensating cleanup for failed teacher invitations. Group validity and primary-teacher availability are checked before invitation email is sent.
- Built responsive English/Arabic list, empty, create, edit, activate/deactivate, assignment, and membership-history screens without adding top-level navigation.
- Preserved membership history by ending memberships rather than deleting them.
- Added tests for input normalization, optional Arabic names, email normalization, teacher invitation success/cleanup/preflight behavior, server environment isolation, and migration contracts.

Verification evidence from 2026-09-20:

- `pnpm lint` — passed with zero warnings/errors.
- `pnpm typecheck` — passed.
- `pnpm test` — 6 files and 30 tests passed.
- `pnpm build` — passed; Next.js generated all 32 routes/pages, including the Phase 2 administration routes.

Not claimed in Phase 2:

- Fresh-database migration execution and real authorization/RLS integration tests remain unavailable because this workstation has neither Docker nor the Supabase CLI and no remote test project was provided. Static SQL contract coverage passed; this limitation must be cleared before MVP completion.

## Remaining phases

- Phase 4 — Reports
- Phase 5 — Email
- Phase 6 — Hardening

## Phase 3 — Teacher Workflow

Status: Implementation complete; live Supabase authorization and browser E2E verification remain outstanding.

Completed:

- Built `My Groups` from exact teacher assignments with school-timezone-aware session dates, current roster counts, and last submitted update dates.
- Added one atomic, idempotent weekly-update database function for draft creation, group progress, full attendance, sparse student exceptions, and submission.
- Enforced assigned-group access, draft ownership, roster membership as of the session date, complete attendance on submission, duplicate-session reuse, and immutable submitted sessions.
- Built the mobile-first weekly update screen with Mark All Present, English/Arabic progress, translated performance keys, inline student exceptions, visible autosave status, manual Save Draft, Submit, and unsaved-navigation protection.
- Built submitted history and read-only detail screens for assigned groups.
- Added English/Arabic UI messages, RTL-aware layouts, locale date formatting, and 360px responsive rules.
- Added unit/component coverage for default-versus-override behavior, sparse exceptions, all-present behavior, database payload mapping, school-local dates, translated Arabic roster rendering, and Phase 3 migration contracts.

Verification evidence from 2026-09-20:

- `pnpm lint` — passed with zero warnings/errors.
- `pnpm typecheck` — passed.
- `pnpm test` — 8 files and 39 tests passed.
- `pnpm build` — passed, including My Groups, weekly update, History, and submitted-detail routes.

Not claimed in Phase 3:

- The planned authenticated Playwright flows and real RLS matrix require a running seeded Supabase instance. They cannot run on this workstation yet, so Phase 3 is not considered deployment-verified despite passing all locally available gates.

## Environment limitations discovered

- Node.js 24.19.0 and pnpm 11.19.0 are available.
- This workstation currently has neither Docker nor a Supabase CLI. Static migration contract tests cover ordering, schema presence, RLS activation, and critical uniqueness declarations only; real PostgreSQL/RLS tests remain mandatory before MVP completion.
