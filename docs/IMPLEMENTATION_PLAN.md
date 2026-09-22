# Weekend School MVP Implementation Plan

> Implement this plan one phase at a time. Use test-first changes for domain rules, authorization, validation, and regressions. Do not start a later phase until the current phase's completion gate is recorded in `docs/PROGRESS.md`.

**Goal:** Deliver the exact English/Arabic weekend-school workflow in `docs/SPEC.md` as a secure, maintainable modular monolith.

**Architecture:** One Next.js App Router application owns the UI and server entry points. Feature modules hold schemas, domain services, repositories, and feature UI; Supabase PostgreSQL and RLS enforce durable data and tenant boundaries; report rendering and email providers are replaceable services.

**Primary constraints:** mobile-first teacher workflow at 360px+, `en`/`ar` with document-level direction, server and RLS authorization, immutable report snapshots, sparse student exceptions, no feature additions from the non-goal or optional lists.

## 1. Exact target file structure

Files are introduced in their owning phase; empty placeholder modules are not created early.

```text
.
├── AGENTS.md
├── README.md
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── messages/
│   ├── en.json
│   └── ar.json
├── docs/
│   ├── SPEC.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── DECISIONS.md
│   └── PROGRESS.md
├── public/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── [locale]/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── (auth)/login/
│   │       │   ├── actions.ts
│   │       │   └── page.tsx
│   │       └── (protected)/
│   │           ├── layout.tsx
│   │           ├── dashboard/page.tsx
│   │           ├── groups/
│   │           ├── students/
│   │           ├── teachers/
│   │           ├── reports/
│   │           ├── settings/
│   │           ├── my-groups/
│   │           └── history/
│   ├── components/
│   │   ├── layout/{app-header,app-navigation,language-switcher}.tsx
│   │   └── ui/{button,field,status-badge}.tsx
│   ├── features/
│   │   ├── auth/{auth.schemas,auth.service,auth.types}.ts
│   │   ├── profiles/{profile.repository,profile.types}.ts
│   │   ├── students/{student.actions,student.repository,student.schemas,student.types}.ts
│   │   ├── guardians/{guardian.repository,guardian.schemas,guardian.types}.ts
│   │   ├── teachers/{teacher.actions,teacher.repository,teacher.schemas,teacher.types}.ts
│   │   ├── groups/{group.actions,group.repository,group.schemas,group.types}.ts
│   │   ├── sessions/{session.actions,session.repository,session.schemas,session.service,session.types}.ts
│   │   ├── attendance/{attendance.schemas,attendance.service,attendance.types}.ts
│   │   ├── progress/{progress.schemas,progress.service,progress.types}.ts
│   │   ├── reports/{report.actions,report.repository,report.schemas,report.service,report.renderer,report.types}.ts
│   │   └── email/{email.actions,email.provider,email.service,email.types,brevo.provider}.ts
│   ├── i18n/{config,navigation,request,routing}.ts
│   └── lib/
│       ├── auth/{authorization,require-profile}.ts
│       ├── dates/{format-date,period}.ts
│       ├── supabase/{browser,server,service-role}.ts
│       └── validation/{email,form-result}.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 202609200001_extensions_and_enums.sql
│   │   ├── 202609200002_identity_and_school.sql
│   │   ├── 202609200003_administration.sql
│   │   ├── 202609200004_weekly_updates.sql
│   │   ├── 202609200005_reports_and_delivery.sql
│   │   ├── 202609200006_integrity_functions_and_indexes.sql
│   │   └── 202609200007_row_level_security.sql
│   └── seed.sql
└── tests/
    ├── unit/{auth,i18n,attendance,progress,reports,email}/
    ├── integration/{database,rls,authorization}/
    └── e2e/{english-flow,arabic-flow,student-exception,authorization}.spec.ts
```

Component subfolders are added inside each feature only when UI arrives. Route folders listed without filenames above are populated in their phase.

## 2. Database migration sequence

Migrations are forward-only and safe to replay from an empty Supabase project.

1. **`202609200001_extensions_and_enums.sql`** — enable `pgcrypto`; create `app_role`, `language_code`, `report_language`, `assignment_type`, `session_status`, `performance_level`, `attendance_status`, `report_status`, and `delivery_status`; create the shared `set_updated_at()` trigger function.
2. **`202609200002_identity_and_school.sql`** — create `schools` and `profiles`; enforce unique `auth_user_id`, valid timezone/default language, one profile per auth user, and profile-school indexes; attach update triggers.
3. **`202609200003_administration.sql`** — create `students`, `guardians`, `student_guardians`, `groups`, `group_teachers`, and `group_memberships`; add same-school composite foreign keys, active-record indexes, group hierarchy protection against self-parenting, non-overlapping current membership constraint strategy, and update triggers.
4. **`202609200004_weekly_updates.sql`** — create `sessions`, `group_progress`, `attendance`, and sparse `student_progress`; enforce unique session dates, one child row per session/student as applicable, same-school references, submission timestamps, and comment/progress non-empty checks.
5. **`202609200005_reports_and_delivery.sql`** — create `reports` and `email_deliveries`; enforce valid periods, immutable snapshot inputs, unique student/period/language reports, one logical report/guardian delivery, and provider status fields.
6. **`202609200006_integrity_functions_and_indexes.sql`** — add cross-table integrity functions that cannot be represented by ordinary foreign keys, immutable-submitted-session/report guards, reporting and dashboard indexes, and transactional helpers required by later services. Keep functions narrow and documented.
7. **`202609200007_row_level_security.sql`** — enable and force RLS on every public table; add helper functions for current profile/school/role and exact-group teacher access; grant admins school-scoped access; grant teachers least-privilege reads and own-draft mutations only; withhold report sending and unrelated student access.

`supabase/seed.sql` is development-only and idempotently creates the specified bilingual sample data after matching Auth users are supplied by local setup. It is introduced in Phase 6 because safe Auth seeding depends on the local Supabase runtime.

## 3. Dependency list

Use pnpm and commit the lockfile. Production dependencies are intentionally small:

| Dependency | Purpose | Introduced |
|---|---|---|
| `next` | App Router web application | Phase 1 |
| `react`, `react-dom` | UI runtime | Phase 1 |
| `next-intl` | locale routing, messages, date/number formatting | Phase 1 |
| `@supabase/supabase-js`, `@supabase/ssr` | browser/server Auth and database clients | Phase 1 |
| `zod` | authoritative input and environment validation | Phase 1 |
| `server-only` | guard privileged modules from client bundles | Phase 1 |
| `@react-email/body`, `container`, `head`, `html`, `preview`, `section` | email-safe report markup without the unused renderer toolchain | Phase 5 |
| Native `fetch` | Brevo transactional-email adapter without an extra SDK | Phase 5 |

Development dependencies:

| Dependency | Purpose | Introduced |
|---|---|---|
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | strict typing | Phase 1 |
| `tailwindcss`, `@tailwindcss/postcss` | styling | Phase 1 |
| `eslint`, `eslint-config-next` | static analysis | Phase 1 |
| `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths` | unit/component runner | Phase 1 |
| `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` | accessible component tests | Phase 1 |
| `supabase` | local migrations and database/RLS integration tests | Phase 2 when the runtime is available |
| `@playwright/test` | browser workflows at desktop/mobile and LTR/RTL | Phase 3 |

Do not add a state-management library, ORM, date library, form library, icon pack, or component catalog until an implemented requirement demonstrates the need. Native React, Supabase, `Intl`, semantic HTML, and small local components are sufficient initially.

## 4. Test strategy

### Test pyramid

- **Unit:** pure fallback, performance, attendance, snapshot, validation, and idempotency rules. Fast and deterministic on every change.
- **Component:** login, navigation by role, locale switching, direction, form states, and later the weekly-update interaction. Query by role/name rather than implementation details.
- **Database integration:** apply all migrations to a fresh local Supabase instance, exercise constraints, then impersonate admin/teacher users to prove RLS. These tests are mandatory before MVP completion.
- **Server authorization integration:** verify every mutation rejects unauthenticated, inactive, wrong-role, wrong-school, and unrelated-group callers even if called directly.
- **End to end:** implement exactly the four flows in section 44 of the spec. Run teacher flows at 360px in both locales; run admin flow at desktop width.
- **Build gate:** every phase ends with lint, strict type-check, all available tests, and `next build` with safe placeholder public environment values.

### Risk cases that must be pinned by tests

1. Authenticated user without an active profile is denied rather than treated as a teacher.
2. An Arabic route sets both `lang="ar"` and `dir="rtl"`; unsupported locales return not found.
3. Same-day duplicate sessions cannot be created under concurrent requests.
4. A teacher cannot infer or mutate another group's students through direct identifiers.
5. A retry after an uncertain email-provider response does not create a second logical delivery.

### Phase 1 verification without local Supabase

Until Docker or a local Supabase runtime is available, use unit tests for locale/auth helpers and a static migration contract test that asserts required tables, RLS activation, and critical constraints exist in ordered SQL files. Clearly label this as incomplete runtime coverage in `docs/PROGRESS.md`; Phase 6 may not complete without real database/RLS execution.

## 5. Six implementation phases

### Phase 1 — Foundation

**Outcome:** a production-buildable bilingual shell with Supabase SSR clients, secure login/logout, protected role-aware navigation, complete initial schema migrations, and foundational tests.

Work items:

1. Normalize documentation, establish repository instructions, initialize the TypeScript/Next.js/Tailwind/Vitest project, and commit the lockfile.
2. Add validated public environment access and separate browser/server Supabase factories; do not create a service-role client until a privileged workflow needs it.
3. Add the seven ordered migrations above, including constraints and initial RLS policies.
4. Add `next-intl` routing, English and Arabic message catalogs, locale-aware root metadata, `lang`, `dir`, locale switching, and unsupported-locale handling.
5. Add login validation and Server Action, logout, `requireProfile()`, inactive/missing-profile denial, protected layout, and exact admin/teacher navigation from the spec.
6. Add minimal accessible UI primitives and responsive shell styles without building feature screens.
7. Tests first for environment parsing, locale direction, role navigation, auth schema behavior, and SQL migration contracts.

Phase gate:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manual smoke checks: `/en/login` is LTR; `/ar/login` is RTL; protected routes redirect when logged out; secrets are absent from client output. Live authentication and migration execution remain environment-dependent and must be listed clearly if Supabase credentials/runtime are unavailable.

### Phase 2 — School Administration

**Outcome:** admins can create/edit/deactivate teachers, students, guardians, and groups, and manage exact-group memberships and assignments.

Work items:

1. Implement Zod schemas and repositories for students, guardians, teachers, groups, memberships, and assignments.
2. Implement admin-only Server Actions with school scoping, email normalization, structured form results, and revalidation.
3. Build responsive list, empty, create, and edit states for the six admin navigation sections without adding top-level items.
4. Use Supabase Admin invitation only from a server-only privileged service; never expose the service key.
5. Add database and authorization integration tests for cross-school references, deactivation, teacher assignment, membership history, and direct-action denial.

Phase gate: standard four commands plus fresh-database migration execution and Phase 2 integration tests.

### Phase 3 — Teacher Workflow

**Outcome:** an assigned teacher can efficiently draft and submit a weekly update on a 360px screen in English or Arabic.

Work items:

1. Build `My Groups` and history from exact teacher assignments.
2. Implement idempotent session creation, draft ownership, submitted-session immutability, and student roster resolution as of the session date.
3. Build attendance with “Mark All Present” and exception editing.
4. Build shared bilingual progress, default performance, and sparse inline student exceptions.
5. Implement visible debounced autosave states plus reliable manual Save Draft; warn before navigating away with unsaved changes.
6. Implement submission validation and timestamps; submitted updates remain readable and no longer teacher-editable.
7. Add unit, authorization, component, and Playwright coverage for default/override behavior, duplicate sessions, unrelated groups, mobile layout, keyboard access, and RTL.

Phase gate: standard commands plus English/Arabic mobile Playwright tests and real RLS tests for teacher access.

### Phase 4 — Reports

**Outcome:** admins generate immutable reports from submitted sessions, see readiness/missing-data states, and preview English, Arabic, or bilingual HTML.

Work items:

1. Implement attendance aggregation, language fallback, latest effective non-null performance, and report snapshot types as pure services.
2. Query only submitted sessions within inclusive validated periods and capture group/student names as historical snapshot data.
3. Generate reports transactionally with unique student/period/language identity; never mutate a generated snapshot's source fields.
4. Implement one renderer service for responsive HTML and email-compatible content across all language modes.
5. Build report list, readiness counts, generation action, and individual preview.
6. Test empty periods, missing guardian email, missing performance, moved students, fallback content, snapshot immutability, and exclusion of drafts.

Phase gate: standard commands plus report unit/integration tests and English/Arabic/bilingual preview checks.

### Phase 5 — Email

**Outcome:** admins safely send one or all ready reports through a provider abstraction with visible delivery state and duplicate prevention.

Work items:

1. Define `EmailProvider`, input/result types, and a fake provider for tests.
2. Build React Email output from the same snapshot/renderer rules and a Brevo adapter isolated to server-only configuration.
3. Transactionally create/reuse pending deliveries before provider calls; persist provider result, message ID, timestamps, and safe error text.
4. Add admin-only single and bulk send actions with bounded batches and resumable failures; do not add a queue or scheduler.
5. Display pending/sent/failed state without leaking provider internals.
6. Test unauthorized send, missing email, provider rejection, partial bulk failure, and concurrent/retried duplicate prevention.

Phase gate: standard commands plus fake-provider integration tests and an explicitly authorized Brevo smoke test when credentials exist.

### Phase 6 — Hardening

**Outcome:** the complete specified workflow is reproducible, secure, accessible, responsive, documented, and ready for deployment.

Work items:

1. Run the complete real RLS matrix for admins, assigned teachers, unrelated teachers, inactive profiles, and cross-school identifiers.
2. Audit every Server Action for authentication, role, school, validation, safe errors, and cache revalidation.
3. Finish keyboard, focus, labels, contrast, no-color-only status, logical spacing, direction-aware icons, and 360px checks.
4. Complete useful loading, error, success, and empty states for every major screen.
5. Add idempotent bilingual seed data matching the quantities in the spec.
6. Complete `.env.example` and README setup, migration, seed, testing, build, and deployment instructions.
7. Run exactly the four required end-to-end workflows, the complete suite, a fresh migration/seed, and the production build.

Phase gate: all unit/component/integration/RLS/E2E tests pass; migrations reproduce from zero; production build passes; documentation matches commands; no untranslated UI strings or real secrets exist.

## 6. Planning audit

### Contradictions or ambiguities resolved

- Root `SPECs.md` versus required `docs/SPEC.md`: normalized without content changes.
- Missing `school_id` in abbreviated child/join examples versus “every school-owned entity”: include it everywhere and enforce same-school relations.
- Automatic emailing goal versus manual-first reliability gate: implement reusable services and idempotency in MVP, but do not activate scheduling in these six phases.
- Phase 6 RLS testing versus security required throughout: implement least privilege with each table, then perform the exhaustive adversarial matrix in Phase 6.
- Report language versus guardians with different preferences: one immutable report per student/period/language and one delivery per report/guardian.
- “One update normally” versus duplicate prevention: make the uniqueness absolute at database level for a group/date.

### Unnecessary complexity removed

- Optional PWA, PDF, delivered/bounced webhook handling, and scheduler activation are omitted.
- No ORM, generic CRUD engine, permission matrix, reporting-period entity, client state library, date library, or full UI kit.
- No recursive subgroup permission inheritance and no automatic translation.
- Autosave is a small debounced draft save with a manual fallback, not offline synchronization.

### Security concerns carried into implementation

- Service-role usage is server-only and delayed until required.
- Authenticated but unprovisioned/inactive users receive no school access.
- RLS uses school and assignment predicates; UI hiding never grants security.
- Database constraints prevent cross-school relation injection and duplicate sessions/deliveries.
- Provider/database errors are logged server-side and mapped to generic user messages.
- Teacher-authored content is rendered as escaped text, not trusted HTML.
- Historical reports/deliveries are protected from cascade deletion and source-data edits.

## 7. Phase completion rule

A phase is complete only when its listed behavior exists, its required automated and manual checks have observed evidence, the standard four commands pass, migrations remain forward-only, and `docs/PROGRESS.md` records completed work, limitations, and the next phase. A build that passes with placeholder environment values does not prove live Supabase or email connectivity; those checks must be reported separately and never implied.
