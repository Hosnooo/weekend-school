# Architecture and Product Decisions

This log records interpretations of `docs/SPEC.md`. It does not replace the specification. A later change to an accepted decision requires a new dated entry rather than silently rewriting history.

## D-001 — Modular monolith and feature boundaries

**Status:** Accepted — 2026-09-20

Use one Next.js App Router deployment. React pages and layouts compose feature APIs; domain services own business rules; repositories own Supabase access; external providers sit behind interfaces. This is the smallest architecture that preserves the report renderer and email provider extension points required by the spec.

Rejected: microservices, separate frontend/backend repositories, GraphQL, queues, and a generic clean-architecture framework. They add deployment and indirection without helping the MVP.

## D-002 — Normalize the specification path

**Status:** Accepted — 2026-09-20

The supplied repository contained only `SPECs.md` at its root, while the user and the document itself require `docs/SPEC.md`. Move the unchanged specification to `docs/SPEC.md`; that path is authoritative from now on.

## D-003 — School scoping is explicit on every owned table

**Status:** Accepted — 2026-09-20

Add `school_id` to all school-owned entities, including join and child tables whose abbreviated examples omit it: `student_guardians`, `group_teachers`, `group_memberships`, `group_progress`, `attendance`, and `student_progress`. Composite foreign keys and constraints ensure referenced rows belong to the same school. The small storage duplication materially simplifies RLS and cross-school safety.

## D-004 — Profiles retain both identifiers

**Status:** Accepted — 2026-09-20

Keep `profiles.id` as the application UUID primary key and `profiles.auth_user_id` as a unique foreign key to `auth.users(id)`, matching the specified schema. Application relations use `profiles.id`; authentication resolves the profile through `auth_user_id`. This is marginally more complex than making both identifiers equal, but it avoids silently changing the data contract.

## D-005 — No public sign-up; admins provision teachers

**Status:** Accepted — 2026-09-20

Phase 1 provides email/password login and protected routes, not self-registration. Admin-created invitations arrive in Phase 2 through Supabase Auth. The initial admin is provisioned through controlled setup/seed instructions. This prevents unassigned authenticated users from acquiring school access.

## D-006 — RLS and server authorization are defense in depth

**Status:** Accepted — 2026-09-20

User-session clients remain subject to RLS. Server Actions also call explicit authorization helpers before mutations. A service-role client is allowed only in server-only administrative/report/email infrastructure and is never imported by client modules. Phase 1 establishes least-privilege foundational policies; feature policies and tests are added with each owning phase and comprehensively exercised in Phase 6.

## D-007 — Hierarchies are deliberately shallow in behavior

**Status:** Accepted — 2026-09-20

Keep the specified self-referencing `groups.parent_group_id`, but do not implement recursive inheritance of teachers, memberships, or permissions. Assignments apply to the exact group. This preserves the future subgroup shape without inventing complex semantics.

## D-008 — Session and sparse-progress invariants live in PostgreSQL

**Status:** Accepted — 2026-09-20

Enforce one session per `(school_id, group_id, session_date)`, one `group_progress` row per session, one attendance row per student/session, and one student-progress row per student/session. Student progress remains sparse; no row is created when there is no override or comment.

## D-009 — Locale routing and preference

**Status:** Accepted — 2026-09-20

Use `next-intl` with locale-prefixed routes. Only `en` and `ar` are supported. The locale route controls `lang` and `dir`; authenticated preference persistence is stored in `profiles.preferred_language` once a profile exists. English is the request fallback, while language switching remains explicit and preserves the current path.

## D-010 — Lightweight accessible primitives, not a component framework

**Status:** Accepted — 2026-09-20

Use Tailwind and small local components. Do not install the full shadcn/ui catalog in Phase 1. Add a Radix primitive only when a feature actually needs a dialog, dropdown, or similar behavior. This avoids unused dependencies while retaining accessible composition.

## D-011 — Reports are per student, period, and language

**Status:** Accepted — 2026-09-20

Generate immutable report rows uniquely by `(school_id, student_id, period_start, period_end, language)`. Guardians with the same language preference may receive the same snapshot; bilingual content uses `both`. A separate delivery row tracks every report/guardian recipient. Report `SENT` means all intended deliveries for that snapshot were sent; any terminal failure makes the aggregate `FAILED` until retried.

This resolves an underspecified interaction between the singular report `language` field and guardians who may request different languages.

## D-012 — Manual delivery precedes scheduling

**Status:** Accepted — 2026-09-20

Phase 5 implements and verifies manual single and bulk sending. It exposes reusable generator and sender services plus database idempotency. It does not enable a scheduler. Schedule settings and a protected trigger can be added only after the manual path is reliable, as directed by the spec. `CRON_SECRET` remains documented for that extension point.

## D-013 — Duplicate delivery prevention is a database invariant

**Status:** Accepted — 2026-09-20

Use a unique delivery key for `(student, reporting period, guardian)` represented by the resolved `report_id` plus `guardian_id`, and create pending deliveries transactionally. Provider retries reuse the stored delivery; they do not create another logical send. Application checks improve messages, but the database constraint is authoritative.

## D-014 — Optional MVP-adjacent work is excluded

**Status:** Accepted — 2026-09-20

Do not implement PWA metadata/service workers, PDF export, email delivered/bounced webhooks, automatic scheduling, or automatic translation unless a later approved spec change makes them required. The MVP keeps clean seams for them without unused abstractions.

## D-015 — Testing layers match risk

**Status:** Accepted — 2026-09-20

Use Vitest and Testing Library for unit/component tests, real local Supabase/PostgreSQL tests for constraints and RLS, and Playwright for the four named end-to-end flows. Because this workstation currently has neither Docker nor the Supabase CLI, Phase 1 also includes deterministic SQL contract tests; these are scaffolding checks, not a substitute for the real RLS suite required in Phase 6.

## D-016 — Security and consistency concerns found in the specification

**Status:** Accepted — 2026-09-20

The following are not product contradictions but require explicit handling:

- Join-table examples omit `school_id` while the school model requires it; D-003 resolves this in favor of stronger tenant isolation.
- “Automatic scheduled report emailing” is a goal, while manual-first wording says to enable it only after reliability is proven; D-012 defers activation and preserves the service boundary.
- Phase 6 lists RLS testing, but postponing security implementation would be unsafe; policies ship with their tables and Phase 6 performs the comprehensive adversarial pass.
- `SUPABASE_SERVICE_ROLE_KEY` is listed in environment configuration but must not be used for ordinary authenticated requests. It is restricted to server-only privileged workflows.
- Report status and per-recipient delivery status can diverge; D-011 defines the aggregate meaning.
- Deactivating guardians requires report history to remain readable; foreign keys use restrictive deletion, not cascading deletion of historical reports or deliveries.
- HTML email content must be escaped by React rendering, and teacher-authored text is treated as text rather than injected HTML.
- Login errors must not disclose whether an email address exists.

## D-017 — Deliberate simplifications

**Status:** Accepted — 2026-09-20

- No repository-wide generic CRUD framework; each feature has focused schemas, actions, services, and repositories.
- No separate “reporting period” table; a validated start/end range is stored in each immutable report.
- No translated database enum labels; stable keys are translated at the UI/rendering edge.
- No role-permission matrix table for two fixed roles; typed role checks plus RLS are easier to audit.
- No autosave synchronization engine; debounced draft persistence plus visible state and manual save is sufficient.
- No averages over performance labels; latest effective non-null performance is a direct query rule.

## D-018 — Email rendering excludes the unused React Email toolchain

**Status:** Accepted — 2026-09-20

Use the focused React Email layout packages and React's browser-compatible static renderer to produce the delivery HTML. Keep pnpm peer auto-installation disabled and explicitly declare required test peers. Resend receives HTML, so its optional `@react-email/render` peer is intentionally absent.

The umbrella React Email package pulled its optional renderer and build-time Prettier dependency into the Next.js production graph. On this Windows/OneDrive workspace, Turbopack then attempted to create a junction for Prettier and failed with access denied. The focused packages preserve the specified React Email template behavior without shipping an unused formatting toolchain or changing the provider interface.

## D-019 — Release verification is executable but cannot be simulated

**Status:** Accepted — 2026-09-20

Pin the Supabase CLI and Playwright in development dependencies, keep the real pgTAP RLS matrix in `supabase/tests/`, and keep exactly the four required workflows in `tests/e2e/`. The browser suite runs serially against one reset seed and uses separate future reporting periods so immutable report identities cannot collide across workflows.

Do not replace unavailable PostgreSQL, RLS, Auth, or browser execution with mocks at the Phase 6 gate. A missing container runtime or local credentials is reported as a release blocker. Static contracts and test discovery remain useful, but they are not evidence that migrations, RLS, Auth, or end-to-end behavior passed.
