# Implementation Progress

Last updated: 2026-09-26

## Current status

The full website UX redesign, Class -> Subject -> optional Group architecture, and independent Administrator/Teacher role model are released to production on `main`. The production release is commit `88c3429f8cf6e40fbfe8f5b90af4adbf545560a2`. Local quality, PostgreSQL/RLS, browser E2E, branch CI, main-branch CI, Vercel production deployment, and live HTTP smoke verification all passed.

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

Status: Implementation complete; live Supabase and Resend sandbox verification remains outstanding.

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

## Architecture correction — active (2026-09-22)

Status: In progress on `codex/class-subject-group-redesign-spec`.

- The user rejected the one-primary-teacher model, one-global-current-group student model, subgroup hierarchy, group-only session identity, Late/Excused attendance in the new teaching workflow, and group-only reporting/dashboard assumptions after production smoke testing exposed the mismatch with the actual school structure.
- The approved replacement is explicit `Class -> Subject -> optional Group`, one active Class per student, automatic Subject participation unless excluded, at most one Group per Class Subject, flexible multi-teacher assignments without PRIMARY/ASSISTANT business semantics, and separate co-teacher weekly submissions.
- Attendance in the corrected model is Present/Absent only. Matching co-teacher observations count once; disagreements become admin-resolved conflicts.
- Reports become period- and Subject-aware with admin-approved shared content, optional student exceptions, `Draft -> Review -> Finalize -> Send`, immutable finalized snapshots, no parent-facing teacher names, and `MCE Weekend School` authorship.
- Normal lifecycle becomes `Active -> Archived -> Restore OR Permanently Delete`; confirmed admin deletion may remove dependent history after an impact review. Export/download is available independently and prominently before deletion.
- Teacher invitation handling must resolve existing Auth state before inviting and must regress the production `email_exists` failure. Password setup/recovery uses unified visible auth-field styling.
- Authority synchronization is Task 1 of `docs/superpowers/plans/2026-09-22-class-subject-group-reporting-redesign.md`; D-025 and `docs/SPEC.md` section 58 supersede conflicting historical rules without rewriting old decisions.
- Forward-only architecture migrations start at 19; applied migrations 1–18 remain immutable. Hosted production receives no development seed.
- Phase 2 roster CSV remains blocked until the architecture correction passes the full local gate, Vercel preview, hosted migrations, production deploy, runtime-error review, and production smoke test.

## Independent role records correction — implementation complete, release verification active (2026-09-24)

- Branch: `codex/independent-role-records`. The approved design is `docs/superpowers/specs/2026-09-23-independent-role-records-design.md`; `docs/SPEC.md` section 59 and D-026 are the current authority for Administrator/Teacher identity and capability semantics.
- Added the single forward-only independent-role migration after immutable migrations 1-27. It creates independent `administrators`, `teachers`, `administrator_accounts`, and `teacher_accounts`, deterministically backfills legacy roles, moves Teacher-owned teaching history to Teacher IDs, removes the current Profile role discriminator, and rewrites capability/RLS helpers around explicit account links.
- Production-style legacy ADMIN backfill remains Administrator-only. Administrator business records and Teacher business records are independent; names/business emails may repeat; matching email never grants or removes a role. An Administrator becomes a teaching candidate only through a separate Teacher record and explicit Teacher account link.
- Teacher business creation is separate from login access. Existing same-school Auth/Profile identities can be reused only during an explicit access action. Teacher unlink/deactivation does not mutate Administrator access or historical Teacher attribution.
- Administrator management was added with independent business/login handling and last-active-Administrator protection. Removing Administrator capability does not remove Teacher access, the Teacher record, the shared Profile, or Teacher history.
- Capability-based navigation now supports Administrator-only, Teacher-only, and dual Administrator+Teacher logins. Administrator and dual-capability accounts default to Dashboard; Teacher-only accounts default to My Teaching.
- Export was intentionally simplified to one rule: active Administrator capability gets all export-related UI/actions/protected downloads; no Administrator capability gets none. Teacher capability does not grant export access.
- The implementation head `3457f2f09a44ff6a16cde3addd9049b990fbe9f9` passed Redesign CI #246: Quality, Database/RLS, and E2E/browser workflows all succeeded. Task 7 documentation/final branch verification is the remaining pre-PR work.
- Hosted Supabase migrations and production deployment remain untouched. No production release occurs without explicit authorization after the final branch gate.

## 2026-09-26 — Full website UX redesign: Task 15 complete

Completed the whole-product copy, RTL, accessibility, and reachability audit.

- Moved remaining interactive Archives, Export Data, Teaching Assignments, and attendance-conflict copy into `next-intl` message catalogs.
- English and Arabic catalogs remain structurally identical: 658 keys each.
- Preserved locale-sensitive record/name selection separately from translated UI copy.
- Updated the hardening contract so required E2E workflows must remain present without incorrectly forbidding additional workflows.
- Added product-level EN/AR desktop and ~360px reachability/overflow coverage.
- Added keyboard navigation, dialog focus restoration, and accessible School Settings control coverage.
- Retained the full export-generation assertions while giving the PDF/ZIP test an explicit timeout appropriate for full-suite contention.

Verification:
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — 59 files, 267 tests passed.
- `pnpm build` — passed; 68/68 static pages generated.
- UX responsive/RTL Playwright audit — 6/6 passed.
- Accessibility Playwright audit — 6/6 passed.
- `git diff --check` — passed.

## 2026-09-26 — Full website UX redesign: Task 16 production release complete

Release commit: `88c3429f8cf6e40fbfe8f5b90af4adbf545560a2`.

Final local verification:
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — 60 files, 268 tests passed.
- `pnpm build` — passed; 68/68 pages generated.
- `pnpm test:db` — 15 files, 221 PostgreSQL/RLS tests passed after the canonical legacy-history fixture and forward migrations.
- `pnpm test:e2e` — all 35 browser workflows passed on a freshly reset and seeded local Supabase database.
- The `ReportPreviewFrame` iframe-root disappearance regression was reproduced RED, fixed with a minimal null guard, and retained as a passing unit regression test.

Release-candidate verification:
- Branch `codex/full-website-ux-redesign` was pushed at the same release SHA.
- Manually dispatched GitHub Redesign CI run `36282510382` completed successfully.
- Quality, Database/RLS, and E2E jobs all passed.

Production release:
- `main` was confirmed to be 66 commits behind the verified branch and 0 commits ahead, so release integration was a clean fast-forward with no merge commit or new code tree.
- `main` advanced from `c225afea11ad772c8e804ab3636523e616eec1ec` to `88c3429f8cf6e40fbfe8f5b90af4adbf545560a2`.
- Automatic GitHub Redesign CI run `36285427064` completed successfully on `main`; Quality, Database/RLS, and E2E jobs all passed.
- Vercel production deployment `dpl_5s7Dn5xeCRvLa3Rgp2CoPWUzYU3A` reached `READY` for the same release SHA with no alias error.
- Production aliases include `weekend-school-nine.vercel.app`, `weekend-school-mce-school.vercel.app`, and `weekend-school-git-main-mce-school.vercel.app`.
- A live production fetch returned HTTP 200 and rendered the MCE Weekend School English login page with the Arabic language switch available.

Task 16 release verification is complete.

## 2026-09-29 — Full-site UI refactor: Task 2 shared foundation

- Consolidated shared color, surface, spacing, control, radius, and focus tokens in `globals.css`; kept component styles in `design-system.css`.
- Tightened the protected shell, sidebar hierarchy, page headings, table rows, and empty states. Updated the UI reference to show a compact management page without nested action/status cards.
- Field errors now mark the associated control with `aria-invalid`. A focused test failed before the change and passed after it.
- Focused foundation/navigation tests passed. `pnpm test` passed 91 files and 399 tests; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed.
- The standard focused Playwright command passed all 8 shell/UI-reference cases across English and Arabic desktop and narrow layouts. Screenshots were inspected for navigation, RTL placement, overflow, form controls, actions, and dialog focus.
- A first cold browser run timed out while the login action was pending; the shared E2E login wait now allows cold compilation. A later post-build dev-server run returned transient 404s for protected routes; after restarting that temporary app server, protected routes responded and the standard 8-case Playwright command passed. Generated `next-env.d.ts` changes were restored.
- No schema, RLS, or persistence code changed, so the database gate was not applicable to this task.

## 2026-09-29 — Full-site UI refactor: Task 3 Dashboard and People

- Replaced Dashboard metric/week tiles with Needs attention, In progress, and Quick actions. Current open Teaching Update requests and unfinished Report Cycles are shown with contextual links; future requests do not appear as urgent work. Decision D-027 records that interpretation.
- Aligned Student, Guardian, Teacher, and Administrator lists and view-only details around record identity, compact sections, and contextual edit, enrollment, login, assignment, and lifecycle actions. Existing permission and persistence behavior stayed in place.
- Repaired misplaced Student CSV import translations in both locale catalogs. Updated Dashboard and Student/Guardian browser contracts to the current UI labels and confirmation flow. Increased Playwright waits for observed cold Next route compilation.
- Dashboard-work test was observed failing before implementation, then passed. The full unit/contract gate passed 92 files and 401 tests. `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed.
- On a reset and E2E-seeded local Supabase database, Dashboard and Teacher browser flows passed together (2/2), then the Student/Guardian flow passed (1/1) after the test fixture was restored. English and Arabic desktop/narrow screenshots were inspected for Dashboard, People details, list actions, RTL ordering, and overflow.
- No migrations, RLS, or repository persistence code changed in this task, so a separate database gate was not required.

## 2026-09-29 — Full-site UI refactor: Task 4 School and assignments

- Changed Class detail from boxed Subject cards to divided Subject rows with optional Group rows and contextual actions. The Teaching Assignments index now uses the shared compact table and puts Teacher identity first.
- New assignment creation remains Class Subject-scoped with no Group input. Existing Group-scoped assignment rows now display the recorded Group name, including an archived Group, while explaining that access covers the whole Subject. D-028 records the presentation rule; the effective-context service still excludes inactive Groups.
- Assignment dates now display in the active locale. Narrow RTL date ranges wrap between complete dates. Focused tests were observed failing before the Subject-row, provenance, and localized-date changes, then passed.
- `pnpm test` passed 92 files and 405 tests. `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed.
- On local E2E fixtures, Class/Subject/Group and Teaching Assignment browser flows passed together (2/2) against the final production build. English and Arabic desktop/narrow screenshots were inspected, including Class actions, assignment menus, and RTL dates. The assignment E2E setup preserves immutable submitted history and cleans up its temporary future assignment.
- No migration or RLS policy changed; the browser tests exercised the assignment repository against local Supabase.

