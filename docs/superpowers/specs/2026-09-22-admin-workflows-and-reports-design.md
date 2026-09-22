# Administrator workflows and parent reports: design review

**Status:** Approved by the user, 2026-09-22. Implementation has not begun. Incorporate the product changes into `docs/SPEC.md`, record interpretations in `docs/DECISIONS.md`, and plan one implementation phase at a time.

## Intent and success criteria

An administrator can operate the school without switching accounts or relying on hidden database steps. They can assign teachers and students, teach their own assigned groups, recover access, import an initial roster, control reusable parent-facing report wording, and inspect report readiness and delivery. Teachers keep a focused workflow: they submit educational updates and can preview generated parent reports for students they currently teach. Only administrators generate and send reports.

The existing English/Arabic application, one-school-per-profile model, server authorization, PostgreSQL RLS, and immutable submitted sessions and report snapshots remain required. New screens use the existing six admin navigation sections and two teacher sections.

## Current code-based status

This is an audit of the local `main` commit `f51e9dd`, not a claim that each signed-in production path was exercised.

| Area | Present | Confirmed gap |
| --- | --- | --- |
| Teacher management | Invitation, edit form, group checkboxes, activation | An administrator cannot be selected as a teacher. The teacher edit form offers occupied groups; the assignment RPC uses `ON CONFLICT DO NOTHING`, so an attempted assignment can appear successful without taking effect. Invitation state and a resend/access-link action are absent. |
| Student management | Single-student creation with guardian and initial group; group membership history | Edit Student changes names only. Transfers require the group membership screen. The student list displays only the first open membership although the schema permits more than one current group. Search from the original specification is absent. |
| Bulk entry | Individual forms | No CSV upload, validation preview, or import. |
| Authentication | Login and invitation/password-setting screen | No self-service Forgot password entry point. |
| Reports | Submitted-session aggregation, immutable snapshots, admin preview/send | Report headings are fixed in code; reusable school wording cannot be edited. Teachers cannot preview generated parent reports. Admin readiness and recipient delivery details are not prominent. |

These gaps are to be addressed through three sequential phases. A passing local build does not establish the outcome of a production email or a signed-in screen.

## Phase 1: assignments and account access

### Admins who teach

Keep one Auth user and one school profile per person. An active `ADMIN` profile can be assigned as a group's primary teacher, while retaining admin capabilities. The group assignment, not the admin role by itself, grants weekly-update write access. The admin navigation includes My Groups and History; these views list only assigned groups and their relevant sessions. An unassigned admin cannot submit a weekly update. Teacher-only profiles retain their existing restricted navigation and permissions.

The group creation/update and teacher-assignment database functions must accept an active same-school admin profile as a teaching assignee. Existing migrations stay immutable; a new forward-only migration changes the functions and tests. The weekly-update RPC continues to require exact group assignment and draft ownership.

### Teacher assignment

Keep a single primary teacher per group. Both Edit Teacher and Edit Group show the current primary assignment clearly. Add Teacher may assign unoccupied groups during invitation. When an admin selects a group already assigned to someone else, the interface presents an explicit reassignment action and its effect before saving. A requested save either performs the intended assignment atomically or returns a visible conflict; it never silently drops a selected group. With no groups, teacher management offers a path to create one.

The teacher list shows assigned groups, invitation/access state, and a route to manage assignments. Changing assignments preserves submitted sessions and report history. Deactivating a teacher prevents new weekly updates but does not erase their previous work.

### Student assignment and transfer

One student has at most one current group. Edit Student shows the current group and a Move group action; Edit Group still offers roster management. Moving a student ends the old membership immediately before the effective start of the new one and inserts the new membership in one transaction. Past memberships and submitted sessions remain intact. The displayed current group is calculated from effective dates, rather than by selecting the first row with `ends_on IS NULL`.

The database enforces non-overlapping current memberships for a student across groups. The UI rejects invalid dates and explains conflicts. A same-day correction to an erroneous new assignment may update that membership only when no submitted session depends on it; otherwise the admin must choose a later effective date. No historical school record is hard-deleted.

### Password recovery and invitation access

Login offers Forgot password in both locales. Supabase Auth sends a recovery link through the configured Auth SMTP service; the confirmation message is identical whether the email exists or not. The recovery link establishes the session and leads to the existing password-setting form. Expired or invalid links show a route to request another. Public signup stays disabled, and recovery does not grant an unprovisioned user school access.

Teacher management distinguishes an invited account from one that has completed access setup where Supabase Auth provides evidence for that distinction. For an existing invited account, an admin can send a new access/recovery link without creating a duplicate Auth user or profile. The server logs provider failure details; the interface shows a safe, useful outcome. Sending an access link is separate from changing a teacher's role or assignments.

### Admin visibility

Within existing navigation, add the missing student search and concise links to assignment actions. The dashboard and Reports pages expose the readiness and failed-delivery counts already tracked by the report workflow. Recipient-level delivery history appears on the report detail view for admins only. These additions must use school-scoped queries and avoid exposing provider secrets or internal error text.

## Phase 2: student CSV import

The first import supports students, one primary guardian per student, and one initial group assignment. It does not create teacher or admin Auth accounts. An admin downloads a UTF-8 CSV template with documented English column names and optional Arabic name fields. Required fields include student English name, guardian name/email, target group identifier, and membership start date; report language defaults only when the template explicitly documents that default.

Upload first parses and previews every row without writing. The preview shows normalized emails, resolved groups, likely duplicate students, reused guardians, and row-specific errors. Group resolution uses a stable group identifier exported by the app; a typed name is a convenience only when it matches one active school group unambiguously. The admin confirms an all-or-nothing import after resolving errors. Existing guardians are reused by normalized school-scoped email. Students are never automatically merged by name. A repeated identical import is detected and blocked, and likely duplicates from a modified file require explicit review before confirmation.

The import runs in a bounded, transactional server operation using the same validation and school rules as individual creation. It records an import summary for audit without storing the raw CSV long term. It creates no group assignment that violates the one-current-group rule. Preview and import failures disclose no other school's records.

## Phase 3: editable report wording and teacher preview

Each school has one reusable report template containing optional introduction and closing text in English and Arabic. Admins edit it from Reports and preview English, Arabic, and bilingual output before saving. The renderer uses the existing teacher-authored content fallback rules and never invents a translation. Blank template fields preserve today's report appearance. The template does not change attendance, performance, or submitted teacher content.

When an admin generates a report, the current template wording is copied into that immutable report snapshot. Later edits affect future snapshots only; already generated or sent reports do not change. The UI must make that timing visible. Email rendering and browser preview use the same snapshot content.

Teachers can open a read-only parent-report preview for a student currently in one of their assigned groups after an admin has generated the report. The preview excludes guardian email addresses, delivery diagnostics, admin controls, and send actions. Server authorization and a narrow RLS policy both enforce school and current assignment scope. Admins retain all report generation, preview, and send controls. No teacher approval gate or per-student report editing is added.

## Sequence, gates, and exclusions

1. Complete Phase 1 before CSV import, because import must rely on settled assignment and recovery rules.
2. Complete Phase 2 before report-template work, so roster data can be loaded and verified through the intended admin workflow.
3. Complete Phase 3 with the current report snapshot and email idempotency invariants intact.

Each phase updates `docs/SPEC.md`, `docs/DECISIONS.md`, and observed `docs/PROGRESS.md`, then passes `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Database changes receive real PostgreSQL/RLS integration tests; the four existing end-to-end workflows remain green, with focused new browser coverage for the changed paths. Production migrations are forward-only and are applied before code that depends on them. Local tests must continue to refuse hosted Supabase URLs.

This design excludes arbitrary report layouts, per-student admin text overrides, teacher report editing or sending, auto-translation, PDF export, scheduled email, and CSV creation of user accounts. Additional admin utilities discovered during implementation are assessed against this design and the product source of truth before they are added.
