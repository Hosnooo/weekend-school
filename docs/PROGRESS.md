# Implementation Progress

Last updated: 2026-09-22

## Current status

All six implementation phases and the final review-remediation pass are complete on `phase-6-hardening`. The release gate includes a fresh local Supabase reset, real PostgreSQL/RLS tests, four authenticated browser workflows (including actual teacher invitation acceptance), the standard lint/typecheck/test/build checks, and an authorized live Resend sandbox delivery.

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

- None.

## Phase 4 — Reports

Status: Implementation complete; live Supabase integration verification remains outstanding.

Completed:

- Added pure submitted-session aggregation with inclusive periods, attendance totals, language fallback, latest effective non-null performance, sparse comments, and historical group capture for moved students.
- Added explicit readiness outcomes for no submitted sessions, incomplete attendance, missing progress, and missing performance; missing active report recipients are counted separately.
- Added atomic, idempotent snapshot insertion through a school-scoped admin RPC. Existing snapshots are never overwritten.
- Added one escaped, responsive renderer for English, Arabic, and bilingual HTML; teacher-authored content is always treated as text.
- Built the admin period selector, readiness summary, report generation, report list, localized statuses, and sandboxed individual preview.
- Added unit and migration-contract coverage for draft exclusion, attendance aggregation, moved groups, performance overrides, missing data, language fallback, HTML escaping, bilingual output, leap-month periods, and atomic snapshot generation.

Verification evidence from 2026-09-20:

- `pnpm lint` — passed with zero warnings/errors.
- `pnpm typecheck` — passed.
- `pnpm test` — 10 files and 48 tests passed.
- `pnpm build` — passed, including report list and preview routes.

Not claimed in Phase 4:

- Fresh PostgreSQL migration execution and live RLS authorization remain unavailable without a Supabase runtime or configured remote test project.

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

## Phase 5 — Email

Status: Implementation complete; live Supabase and Resend sandbox verification remain outstanding.

Completed:

- Added a provider-neutral email interface, a Resend adapter isolated to server-only configuration, and fake-provider service tests.
- Added React Email output that reuses the escaped report renderer for English, Arabic, and bilingual snapshots.
- Added atomic school-scoped delivery reservation and completion functions. They capture the recipient email, persist safe outcomes, aggregate report status, retry failed rows in place, and prevent duplicate pending or sent deliveries.
- Added admin-only single and bounded sequential bulk sending with resumable partial failures and provider idempotency keys.
- Added visible localized pending, sent, and failed states; in-flight reports cannot be submitted again from the reports screen.
- Added tests for provider success/rejection, partial failure, missing recipients, pending/sent duplicate prevention, safe error storage, Resend adaptation, environment validation, and migration contracts.
- Replaced the deprecated React Email umbrella dependency with focused official layout packages. Resend's unused optional renderer is not installed, avoiding its build-only Prettier dependency while preserving React Email templates.

Verification evidence from 2026-09-20:

- `pnpm lint` — passed with zero warnings/errors.
- `pnpm typecheck` — passed.
- `pnpm test` — 12 files and 56 tests passed.
- `pnpm build` — passed; Next.js generated all 32 routes/pages, including reports and preview routes.

Not claimed in Phase 5:

- No Resend sandbox message was sent because no explicitly authorized sandbox credentials were provided.
- Fresh PostgreSQL migration execution, concurrent reservation testing, and live RLS authorization remain unavailable without a Supabase runtime or configured remote test project. Static migration contracts and application authorization tests passed, but Phase 6 must run the real integration matrix before MVP completion.

## Environment limitations discovered

- Node.js 24.19.0, pnpm 11.19.0, Docker Desktop 29.7.2, Supabase CLI 2.117.0, and Playwright 1.63.0 are available.
- Docker Desktop's CLI is installed outside the sandbox PATH, but invoking it from its installed location provides a healthy Linux container engine and supports the local Supabase stack.
- Local Supabase credentials are configured in the ignored `.env.local` file and match the running stack. The Resend API key used for the authorized smoke test was consumed from the clipboard without being printed, logged, or persisted by the project.

## Phase 6 — Hardening

Status: Complete.

Completed:

- Added a real pgTAP RLS matrix for own-school admins, assigned and unrelated teachers, inactive profiles, cross-school identifiers, unrelated students, and teacher report-send denial.
- Audited every Server Action. Authenticated mutations validate with Zod; feature mutations require the appropriate active role; school scoping is explicit in repositories or derived inside narrow security-definer RPCs; failures shown to users are generic; successful mutations revalidate their affected routes. Login, logout, and language preference remain the intentional special cases.
- Added localized protected-route loading and error states, live success announcements, translated table action headings and language options, and removed remaining visible English/Arabic literals from feature screens.
- Confirmed the existing focus styles, semantic labels, no-color-only status text, logical CSS properties, RTL document direction, and 360px teacher layout rules; the authenticated visual check still belongs to the blocked E2E run.
- Added an idempotent development seed with one bilingual school, one admin, two teachers, three groups, twelve students and guardians, current memberships, and submitted bilingual history.
- Added pinned local Supabase configuration, Playwright configuration, `.env.example`, and complete setup/migration/seed/test/build/deployment instructions in `README.md`.
- Added exactly four serial Playwright workflows: English administrator-to-report, Arabic RTL/report, student performance exception, and unrelated-group denial.
- Added release-hardening contracts for message-catalog parity, documentation coverage, seed quantities/idempotency markers, RLS scenarios, and the exact E2E file set.

Verification evidence from 2026-09-20:

- `pnpm lint` — passed with zero warnings/errors.
- `pnpm typecheck` — passed.
- `pnpm test` — 13 files and 60 tests passed.
- `pnpm test:e2e --list` — discovered exactly 4 tests in 4 required files.
- `pnpm build` with safe placeholder public Supabase values — passed; Next.js generated all 32 routes/pages.
- `supabase test db` — attempted with the pinned CLI and failed to connect to `127.0.0.1:54322` because no local Supabase/PostgreSQL runtime is running.

Runtime verification evidence from 2026-09-21:

- Docker Desktop 29.7.2 — healthy Linux engine.
- `pnpm db:start` — started the pinned local Supabase stack.
- `pnpm db:reset` — recreated PostgreSQL from zero, applied all 11 migrations in order, loaded `supabase/seed.sql`, and restarted the stack successfully.
- `.env.local` — verified to match the running local API URL, anonymous key, and service-role key without printing credentials.
- `pnpm test:db` — real pgTAP run passed 1 file and all 9 RLS tests.
- `pnpm browsers:install` — Chromium installation/verification completed successfully.
- `pnpm test:e2e` — all 4 serial workflows passed in 1.9 minutes: Arabic RTL/report, unrelated-group denial, English administrator-to-report, and student performance exception. The managed PTY retained the child development server on the first attempt; rerunning the same command in a detached host process exited cleanly and confirmed the process-lifecycle issue was confined to the PTY boundary.
- `pnpm lint` — passed with zero warnings/errors.
- `pnpm typecheck` — passed.
- `pnpm test` — 14 files and 66 tests passed.
- `pnpm build` — passed; Next.js generated all 32 routes/pages.
- Resend sandbox smoke test — a separate live message to the authorized account owner `mohssen.elshaar@gmail.com` was accepted with a provider delivery ID. A second attempt to `mostafa.kh.elghandour@gmail.com` was rejected by Resend's expected sandbox restriction because unverified accounts may send only to their owner; no application defect or secret exposure occurred.

Final review remediation verified on 2026-09-22:

- Added migration 12 so delivery uniqueness is enforced by `(school, student, reporting period, guardian)` independently of report language. Recent uncertain PENDING deliveries safely reuse the same provider idempotency key; older uncertain deliveries require reconciliation instead of an unsafe automatic resend.
- Provider acceptance followed by a persistence failure no longer rewrites the delivery as a provider rejection.
- Reports now represent missing optional performance as localized “Not rated” rather than blocking generation.
- The development seed was run a second time against protected submitted sessions and completed with zero child writes and zero updates.
- Expanded the live pgTAP suite from 9 to 14 checks, covering cross-school mutation denial, submitted-session mutation denial, immutable report snapshots, and the language-independent logical-delivery invariant.
- Replaced the service-role E2E password shortcut with the real Supabase invitation email, local Mailpit link, invitation session establishment, and password-setting screen.
- Bulk sending scans past ineligible reports and prioritizes READY reports before FAILED retries; failed saves retain weekly-form navigation protection.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — 14 files and 70 tests passed.
- `pnpm test:db` — 1 file and all 14 pgTAP tests passed against a freshly reset database.
- `pnpm build` — passed; Next.js generated all 34 routes/pages, including English and Arabic password setup.
- `pnpm test:e2e` — all 4 serial workflows passed in 2.9 minutes from a freshly reset database.

No Phase 6 verification items remain. Deployment hosting, production Supabase configuration, and production email credentials are launch-environment tasks rather than unfinished application behavior.

Zero-cost pilot email update verified on 2026-09-22:

- Replaced the Resend adapter and environment contract with a provider-neutral Brevo REST adapter using native server-side `fetch`.
- Added Brevo request, sender parsing, idempotency, rejection, and malformed-response tests; the complete suite now passes 15 files and 71 tests.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm build` — passed; Next.js generated all 34 routes/pages.
- A live Brevo API request from the verified pilot sender `mohssen.elshaar@gmail.com` to the unverified recipient `mostafa.kh.elghandour@gmail.com` was accepted and returned a provider message ID. The API key was consumed from the clipboard without being printed or persisted.

Production deployment observations from 2026-09-22:

- Created the free hosted Supabase project `tlitseincunvlnnooply` in `ca-central-1`, linked the repository, and applied all twelve migrations. The development seed was not applied.
- Created the Vercel Hobby project `mce-school/weekend-school`; the production deployment completed with ready state and the alias `https://weekend-school-nine.vercel.app`. Both `/en/login` and `/ar/login` returned HTTP 200 with login forms.
- Configured the production public Supabase URL/anonymous key and server-only service-role, Brevo API, and cron keys in Vercel. The Vercel environment listing confirmed all six required names without revealing secret values.
- Set the hosted Supabase Auth Site URL and both language-specific password setup redirects. Configured Brevo custom SMTP for Auth invitations, disabled public signup, and raised the hosted minimum password length to eight characters. The SMTP credential was supplied through an environment variable and the configuration command reported it as masked.
- Created one production school and an administrator profile for `mohssen.elshaar@gmail.com`. Created an unassigned test teacher profile for `mostafa.kh.elghandour@gmail.com`; the teacher invitation was accepted by Supabase after SMTP configuration. The administrator's initial invite email was not observed by the user, so a password recovery email was sent. The user confirmed setting the password and reaching the authenticated administrator dashboard. The test teacher's invitation acceptance remains unconfirmed.
- `pnpm lint` — passed. `pnpm typecheck` — passed. `pnpm test` — 15 files and 71 tests passed. `pnpm build` — passed; 34 routes/pages generated. The Vercel production build also completed successfully.

The purchased sending domain remains deferred for the pilot. Administrator login is user-verified; teacher invitation delivery and parent report delivery through the full production UI are not yet user-verified.

Pilot usability follow-up on 2026-09-22:

- The user reached the hosted administrator dashboard but saw the Phase placeholder. Implemented the specified minimal dashboard with active record counts and a school-local Monday–Sunday group-submission summary; implemented the previously placeholder school Settings page for bilingual names, timezone, and default language.
- Corrected password-setup routing so administrators land on the dashboard while teachers land on My Groups. Added unit tests for role routing, dashboard week/count rules, and settings validation after observing relevant failing tests.
- Moved local Supabase ports to 55320–55329 because Windows reserves the former 54320–54329 range. Local E2E now refuses a hosted Supabase URL to prevent test records from being written to production after Vercel linking changed the ignored `.env.local` file.
- `pnpm lint` — passed. `pnpm typecheck` — passed. `pnpm test` — 18 files and 77 tests passed. `pnpm build` — passed with all 34 pages/routes generated.
- The first rerun of the English E2E workflow reached the new dashboard successfully and completed report generation, but timed out while loading the report preview on the slow local development server. The configured per-test timeout was increased from 120 to 240 seconds; the rerun passed in 2.7 minutes, including Settings save and report preview.
- The first post-E2E `pnpm test:db` run found that two RLS assertions assumed only the original seed rows existed. They now assert access to the explicit seed IDs and separately deny cross-school group visibility, so they remain meaningful after browser tests add local records. The rerun passed 1 file and all 15 pgTAP tests without deleting local data.
- The ignored `.env.local` still contains Vercel-linked hosted values. An attempted credential-safe restoration to the local Docker values was rejected by the execution safety reviewer because it would serialize secrets; no file change was made. Local E2E is protected by a hard refusal of non-local Supabase URLs and explicitly injected local values in the verified run. Ordinary local development must not be used for test mutations until its environment is safely restored.
- Published deployment `dpl_9hAraof5yo7MpQsShfg56Y44bM3R` to the same Vercel production alias `https://weekend-school-nine.vercel.app`; Vercel reported `READY` and its build generated all 34 routes/pages. Live `/en/login` and `/ar/login` returned HTTP 200. Unauthenticated `/en/dashboard` and `/en/settings` returned HTTP 307 to `/en/login`. The signed-in rendering of the new production pages awaits user confirmation because only the administrator knows the password set through recovery.

## Administrator workflow extension — Phase 1 local implementation (2026-09-22)

- Branch: `codex/admin-assignments-access`. The approved product contract is `docs/SPEC.md` section 57, with design and implementation plans under `docs/superpowers/`. Production remains on the prior `main` deployment until migrations and the branch are released in that order.
- Added forward-only migrations 13–17. They enforce explicit, atomic primary-teacher reassignment in both teacher and group forms; permit assigned active administrators to teach; enforce one effective student group with transactional transfer and preserved submitted-session history. No hosted migration has been applied for this phase yet.
- Added administrator My Groups and History access limited to explicitly assigned groups, teacher assignment/access state and resend, student transfer and bilingual search, password recovery, dashboard report/delivery counts, and administrator-only recipient delivery history. Existing Auth identities without a profile can be reconciled during teacher invitation; an existing administrator email is shown as an assignment path rather than invited again.
- Verified TDD regressions: the old group-edit RPC silently replaced a primary teacher; a pgTAP test first failed, then passed with migration 17. Unit tests similarly observed failures before the new recovery, resend, student search, and count rules were implemented.
- Local `pnpm db:reset` applied all 17 migrations and the development seed successfully. `pnpm test:db` passed 25 real PostgreSQL/RLS checks. `pnpm test:e2e` passed the four browser workflows in 2.8 minutes after the fresh seed. A focused rerun of the authorization workflow passed with known/unknown email recovery confirmation checks. `pnpm lint` passed, `pnpm typecheck` passed after regenerating Next route types, `pnpm test` passed 21 files and 94 tests, and `pnpm build` passed with 36 generated pages/routes.
- The first browser run encountered a previously submitted local seed session and correctly rendered that update read-only; after resetting only local Docker Supabase, all four workflows passed. A concurrent typecheck saw a partially rewritten generated `.next/dev/types` file; deleting only that generated directory, restoring generated `next-env.d.ts`, and regenerating types resolved it. Neither issue involved hosted data.
- GitHub branch was pushed and draft PR #1 opened. GitHub reports the first Vercel Preview deployment as failed, while its status exposes no build-log detail. Browser access to the private Vercel log was blocked by automatic approval review when it attempted a separate Google sign-in. The production site remains on the earlier `main` deployment; hosted migrations 13–17 were not applied.
- Next release steps: inspect/fix the Vercel preview, apply migrations 13–17 to hosted Supabase, merge the PR to `main`, then verify the live admin flows and invitation email. Student/guardian/group CSV import and reusable report wording with teacher read-only preview remain Phases 2 and 3, in that order.

## Architecture correction — 2026-09-23

- Approved redesign authority synchronized; D-025 supersedes group-centric cardinalities.
- Forward-only migrations 19-24 added for academic structure/RLS, independent weekly submissions, attendance resolution, subject-aware report workflow, and archive/export metadata.
- Current navigation and shared auth controls updated for Classes/My Teaching and consistent password-field styling.
- Phase 2 CSV remains blocked pending full local database/browser gates and hosted production smoke verification.
- Local `pnpm db:reset`: unavailable (`LegacyLocalDbRunningError: failed to inspect service`); no hosted database was touched.

### Local gate observed 2026-09-23

- `pnpm lint`: passed (0 errors, 0 warnings).
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 21 files / 95 tests.
- `pnpm db:reset`: could not run because the cloud local database service inspection failed (`LegacyLocalDbRunningError`).
- `pnpm test:db`: could not connect to local PostgreSQL at `127.0.0.1:55322` because Docker/Supabase was unavailable.
- `pnpm test:e2e`: could not start because `.env.local` is not provisioned in this cloud checkout.
- `pnpm build`: compiled and typechecked, then prerendering stopped because required public Supabase environment variables are not provisioned.
- Hosted migration, deployment, and production smoke steps were not run; Phase 2 remains blocked.

## Redesign application wiring follow-up — 2026-09-23

- Replaced the `/classes` and `/my-teaching` compatibility redirects with authenticated, school-scoped application screens.
- Added Class creation/edit/archive, Subject and Group creation/default selection, multi-teacher Subject/Group assignment, student Class/Subject/Group administration, deduplicated teacher context cards, independent teacher-owned draft/submission forms, Present/Absent-only attendance, sparse exceptions, and author-owned submission history.
- Added forward migration 25 to protect submitted weekly records and provide transactional Class and Subject Group moves. Migrations 1-24 were not edited in this follow-up.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` passed; unit suite reported 22 files and 98 tests.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key pnpm build` passed and generated all 40 routes using non-secret local placeholder build values.
- Local PostgreSQL/RLS and browser E2E remain unverified because the cloud task has no running local Supabase or `.env.local`. No hosted migration, seed, or production action was run.
