# Administrator assignments and access implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make teacher and student assignments reliable and visible, let assigned admins teach, and restore account access without duplicate invitations.

**Architecture:** Keep the existing Next.js App Router application. Server Actions authorize and validate, feature repositories perform school-scoped reads, and forward-only PostgreSQL migrations own transactional assignment rules. Supabase Auth and its configured SMTP service own invitations and password recovery.

**Tech Stack:** Next.js 16.3.5, React 19.2.0, TypeScript 5.9.3, Zod 4.1.11, Supabase JS 2.116.0, PostgreSQL/RLS, Vitest, pgTAP, Playwright, next-intl.

**Spec:** `docs/SPEC.md` section 57 and `docs/superpowers/specs/2026-09-22-admin-workflows-and-reports-design.md` phase 1.

## Global constraints

- Work only on extension phase 1; CSV and report-template work follow in separate plans.
- Keep one Auth user and one active school profile per person; do not add a new role or a second profile for an admin who teaches.
- Preserve one primary teacher per group and at most one current student group; never hard-delete historical school records.
- Every mutation needs server-side Zod validation, school-scoped authorization, and PostgreSQL/RLS enforcement.
- Keep English and Arabic copy in `messages/en.json` and `messages/ar.json`; check mobile teacher views at 360px and RTL.
- Existing twelve migrations are immutable. Teacher assignment changes belong in `supabase/migrations/202609220013_teacher_assignment.sql`; student transfer changes belong in `supabase/migrations/202609220014_student_transfer.sql`. Never edit migration 13 after it has been applied at Task 1's test gate.
- Local database and browser tests must reject hosted Supabase URLs. Production migration precedes code deployment; do not run the development seed in production.
- Before calling the phase complete, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:db`, and focused Playwright tests; record observed outcomes in `docs/PROGRESS.md`.

## Review focus

1. Two admins race to assign the same occupied group: one succeeds and the other receives a conflict; neither sees a false success. Task 1 tests this.
2. A student move crosses a submitted session date: the old roster and snapshot stay intact, and an unsafe same-day correction fails. Task 3 tests this.
3. An unassigned admin opens a weekly-update URL directly: both the action and the database reject the write. Task 2 tests this.
4. An unknown email requests recovery: the response is indistinguishable from a known email, with no user enumeration. Task 4 tests this.
5. A teacher invite succeeds at Auth but profile persistence fails: the UI reports failure and the account can be reconciled or reinvited without silently creating a duplicate. Task 4 tests this.

## File map

- `supabase/migrations/202609220013_teacher_assignment.sql`: replace affected assignment RPCs; keep explicit grants and security-definer search paths.
- `supabase/migrations/202609220014_student_transfer.sql`: add student membership overlap protection and atomic transfer RPC.
- `supabase/tests/rls.test.sql`: admin-as-teacher, exact assignment, transfer, conflict, and cross-school SQL tests.
- `src/features/teachers/{teacher.schemas,teacher.repository,teacher.service,teacher.actions,teacher-form,teacher.types}.ts(x)`: explicit reassignment, access state, resend action, and safe failures.
- `src/features/groups/{group.schemas,group.repository,group.actions,group-form,membership.schemas,membership-form}.ts(x)`: current assignee, reassignment, and membership rules.
- `src/features/students/{student.schemas,student.repository,student.actions,student-form,student.types}.ts(x)`: current-group calculation and transfer.
- `src/features/weekly-updates/{weekly-update.repository,weekly-update.actions}.ts`: scope admin teaching views and writes to exact assigned groups.
- `src/lib/auth/{navigation,require-profile}.ts`, `src/app/[locale]/(protected)/(teacher)/layout.tsx`, existing teacher pages: make teaching routes available to assigned admins while keeping admin permissions.
- `src/features/auth/{auth.schemas,auth.types}.ts`, login and set-password route files, and a new `forgot-password` route: recovery request and invalid-link navigation.
- Existing admin pages under `teachers`, `groups`, `students`, `dashboard`, and `reports`: visible links, assignment/access state, search, readiness, and delivery details.
- `messages/{en,ar}.json`: all new visible text.
- `tests/unit/*`, `supabase/tests/rls.test.sql`, and focused `tests/e2e/*`: tests described below.

---

### Task 1: Atomic primary-teacher assignment

**Files:** `supabase/migrations/202609220013_teacher_assignment.sql`, `supabase/tests/rls.test.sql`, `src/features/teachers/teacher.schemas.ts`, `src/features/teachers/teacher.repository.ts`, `src/features/groups/group.repository.ts`, `tests/unit/administration-schemas.test.ts`.

**Interfaces:** New `update_teacher_administration_confirmed(profile_id uuid, display_name text, preferred_language language_code, group_ids uuid[], allow_reassignment boolean)` applies all requested assignments or raises a conflict. Existing `update_teacher_administration` remains callable but becomes strict about occupied groups. Existing `create_group_with_teacher` and `update_group_with_teacher` accept active same-school `ADMIN` and `TEACHER` profiles.

- [ ] **Step 1: Write failing tests.** Extend `tests/unit/administration-schemas.test.ts` with valid/invalid `allowReassignment` input, and `supabase/tests/rls.test.sql` with an assigned admin, an unassigned admin, a cross-school profile, an occupied group without confirmation, and two conflicting assignment attempts. Assert the failed attempt leaves prior assignments intact and that the successful one has exactly one primary teacher.
- [ ] **Step 2: Observe failures.** Run `pnpm test tests/unit/administration-schemas.test.ts` and `pnpm test:db`; record the missing schema or RPC behavior, not only an unrelated test failure.
- [ ] **Step 3: Implement the migration.** `CREATE OR REPLACE FUNCTION` for existing RPC signatures and add the clearly named five-argument confirmed RPC; avoid ambiguous PostgREST overloads. Lock requested `groups` rows in stable ID order, reject inactive/cross-school target profiles, reject occupied groups unless `allow_reassignment = true`, remove prior primary rows as needed, insert the requested rows, and verify final assignment counts. Use `RAISE ... ERRCODE` for a distinguishable conflict. Preserve grants and `SET search_path = ''`.
- [ ] **Step 4: Wire server validation/repository.** Extend `teacherUpdateSchema` with `allowReassignment: z.boolean()` using an explicit form value; pass it to the RPC. Keep `school_id` derived from the authenticated profile, never from the form. Group create/edit options include active admins and teachers. Map conflict errors to a specific safe action state.
- [ ] **Step 5: Verify and commit.** Rerun the two focused suites and commit migration, schema, repository, and tests as `fix: make primary teacher assignment atomic`.

### Task 2: Assigned administrators can use teacher workflows

**Files:** `src/lib/auth/navigation.ts`, `src/lib/auth/require-profile.ts`, `src/app/[locale]/(protected)/(teacher)/layout.tsx`, `src/features/weekly-updates/weekly-update.repository.ts`, `src/features/weekly-updates/weekly-update.actions.ts`, existing teacher pages, `messages/{en,ar}.json`, `tests/unit/{authorization,app-navigation,weekly-update}.test.ts(x)`, `supabase/tests/rls.test.sql`.

**Interfaces:** `requireTeachingProfile(locale)` returns an active profile whose `id` is still checked against the requested group; `listTeacherHistory(schoolId, profileId)` lists submitted sessions for that profile's currently assigned groups only.

- [ ] **Step 1: Write failing tests.** Assert admin navigation includes My Groups and History; admin teaching layout permits active admins; history for an admin assigned to group A excludes group B; direct save for an unassigned admin fails; RLS permits assigned-admin writes and denies unassigned-admin writes and cross-school access.
- [ ] **Step 2: Observe failures.** Run `pnpm test tests/unit/authorization.test.ts tests/unit/app-navigation.test.tsx tests/unit/weekly-update.test.ts` and `pnpm test:db`.
- [ ] **Step 3: Implement authorization and scoping.** Add an active-profile teaching helper without broadening `requireProfile(locale, 'ADMIN')` checks on admin pages. Pass `profile.id` into history queries, use the same group-assignment predicate as My Groups, and keep the weekly-update RPC's exact assignment and draft-ownership checks. Add the two teacher navigation links for admins with localized labels already used by teacher navigation.
- [ ] **Step 4: Verify and commit.** Rerun the focused tests and commit as `feat: let assigned administrators teach`.

### Task 3: One effective student group and safe transfer

**Files:** `supabase/migrations/202609220014_student_transfer.sql`, `supabase/tests/rls.test.sql`, `src/features/groups/{membership.schemas,group.actions,group.repository,membership-form}.ts(x)`, `src/features/students/{student.schemas,student.repository,student.actions,student-form,student.types}.ts(x)`, student and group admin pages, `messages/{en,ar}.json`, `tests/unit/administration-schemas.test.ts`.

**Interfaces:** `move_student_group(p_student_id uuid, p_target_group_id uuid, p_starts_on date)` atomically closes the prior effective membership on the day before `p_starts_on` and inserts the new membership; `currentGroupForDate(memberships, today)` selects the unique effective membership for display.

- [ ] **Step 1: Write failing tests.** Add schema tests for invalid dates and same-group moves; pgTAP tests for overlapping intervals, successful move, future-dated move, cross-school ID denial, and attempted same-day correction that would alter a submitted roster. Test that an old submitted session and generated report remain readable after a move.
- [ ] **Step 2: Observe failures.** Run `pnpm test tests/unit/administration-schemas.test.ts` and `pnpm test:db`.
- [ ] **Step 3: Implement database invariants.** Use a forward-only exclusion or equivalent constraint on `(school_id, student_id, daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]'))`; inspect existing production data for overlap before applying it. The transfer RPC locks the student row, validates active same-school student/group, closes the old membership, inserts the new one, and rejects changes to dates used by submitted sessions. Its transaction rolls back on any error. Preserve past memberships.
- [ ] **Step 4: Implement current-group and transfer UI.** Fetch `starts_on` and `ends_on` in the student repository; compute effective membership for the school's current date, never use the first open row. Add current-group display and Move group action to Edit Student, plus an equivalent link on Edit Group. Give overlap and submitted-session conflicts localized, actionable feedback.
- [ ] **Step 5: Verify and commit.** Rerun focused tests and commit as `feat: transfer students with membership history`.

### Task 4: Password recovery and existing-invite access

**Files:** `src/features/auth/{auth.schemas,auth.types}.ts`, `src/app/[locale]/(auth)/login/{login-form,page}.tsx`, new `src/app/[locale]/(auth)/forgot-password/{page,actions,forgot-password-form}.ts(x)`, `src/app/[locale]/(auth)/set-password/{page,set-password-form}.tsx`, `src/features/teachers/{teacher.service,teacher.actions,teacher.repository,teacher.types}.ts`, teacher admin pages, `messages/{en,ar}.json`, `tests/unit/{teacher-invitation,set-password-routing}.test.ts(x)`, focused Playwright coverage.

**Interfaces:** `requestPasswordRecovery(email, locale)` calls `supabase.auth.resetPasswordForEmail(normalizedEmail, {redirectTo})` and returns the same public confirmation for existing/unknown addresses. `resendTeacherAccess(profileId, schoolId)` uses the existing Auth identity, sends one recovery/access link, and never inserts a profile.

- [ ] **Step 1: Write failing tests.** Validate normalized email and bad-input rejection. With a fake Auth adapter, assert known and unknown recovery requests return identical public text. Assert resend targets the existing Auth user and does not call profile creation. Cover provider failure and invite-accepted/profile-failed cleanup or reconciliation, including duplicate-user retry.
- [ ] **Step 2: Observe failures.** Run `pnpm test tests/unit/teacher-invitation.test.ts tests/unit/set-password-routing.test.tsx`.
- [ ] **Step 3: Implement recovery.** Add a localized Forgot password link and form. Use a server action with Zod validation, trusted application origin construction, and Supabase Auth's reset method. Do not reveal account existence. Link invalid/expired set-password state to the recovery page. Preserve disabled public signup and the existing password-setting form.
- [ ] **Step 4: Implement existing-invite access.** Read access state from Supabase Auth Admin data only on the server; avoid claiming acceptance when evidence is unavailable. Add a resend action for a school-scoped existing teacher profile. Handle duplicate Auth identity from an uncertain prior invite as a recoverable existing-account case after verifying school ownership, not a new user creation. Log provider details server-side and return safe localized UI feedback.
- [ ] **Step 5: Verify and commit.** Rerun focused unit tests and a local Mailpit browser recovery flow. Commit as `feat: restore teacher account access`.

### Task 5: Make assignments and report status discoverable

**Files:** teacher/group/student admin list and edit pages, `src/features/teachers/teacher-form.tsx`, `src/features/groups/group-form.tsx`, `src/features/students/student-form.tsx`, `src/features/dashboard/{dashboard.repository,dashboard.model}.ts`, report admin pages and repository, `messages/{en,ar}.json`, `tests/unit/{dashboard,administration-schemas}.test.ts`, focused Playwright coverage.

**Interfaces:** Admin pages consume school-scoped teacher/group/current-membership state from Tasks 1–4; `getDashboardSummary(schoolId)` adds report-ready and failed-delivery counts; report detail fetches recipient delivery status without rendering provider secrets.

- [ ] **Step 1: Write failing tests.** Add UI tests for occupied-group confirmation, no-group create link, teacher assigned-group/access display, student search by English and Arabic name, and visible move action. Add dashboard count tests for READY reports and FAILED deliveries, including an empty school. Test that admin report detail shows recipient delivery status but no internal error or API key.
- [ ] **Step 2: Observe failures.** Run `pnpm test tests/unit/dashboard.test.ts tests/unit/administration-schemas.test.ts` and the focused component tests added in this step.
- [ ] **Step 3: Implement the UI and queries.** Display current assignee in Edit Teacher and Edit Group, require an explicit reassignment control when occupied, and use the conflict state from Task 1. Add direct assignment links and local student search. Expose school-scoped readiness/failure counts in Dashboard and Reports and recipient-level delivery history on the admin report detail page. Keep all new copy in both message catalogs.
- [ ] **Step 4: Verify and commit.** Rerun focused tests and commit as `feat: surface admin assignment and delivery controls`.

### Task 6: Phase gate and GitHub preview

**Files:** `docs/PROGRESS.md`, `docs/DECISIONS.md` if implementation resolves an ambiguity, focused `tests/e2e/*`.

- [ ] **Step 1: Verify from a fresh local database.** Confirm the test runner points only to local Supabase, run `pnpm db:reset`, `pnpm test:db`, and the four existing `pnpm test:e2e` workflows plus focused English/Arabic assignment, transfer, and recovery paths. Do not allow any test to mutate hosted Supabase.
- [ ] **Step 2: Run the required project gate.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; capture actual results. Verify 360px teacher views in English and Arabic, including assigned-admin My Groups.
- [ ] **Step 3: Record observed results.** Update `docs/PROGRESS.md` with passed/failed commands, migration status, remaining limitations, and the next phase. Never describe a Vercel preview or production email as verified from a local build alone.
- [ ] **Step 4: Publish for review.** Commit the tested Phase 1 branch, push to GitHub, open a pull request, and inspect its Vercel preview. Apply the new migration to hosted Supabase only during the approved release sequence before merging code that relies on it; verify production after Vercel deploys the merged `main` branch.

## Self-review

- **Spec coverage:** Phase 1 admin teaching, teacher reassignment, student transfer, recovery/invite access, search, report status, recipient delivery, bilingual copy, RLS, and release gates each map to a task. CSV and report-template requirements are deliberately reserved for later plans.
- **Type consistency:** `schoolId` is always derived from the authenticated profile; teaching access always uses that profile's ID for exact assignment. The transfer RPC uses UUID IDs and a canonical date string at the repository edge.
- **Review-focus coverage:** The five failure modes above are explicitly exercised in Tasks 1–4.
