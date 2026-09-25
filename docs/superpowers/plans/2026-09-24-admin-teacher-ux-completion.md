# Administrator and Teacher UX Completion Implementation Plan

**Date:** 2026-09-24
**Branch:** `codex/admin-teacher-ux-completion`
**Base:** `4892f0e26e81d468fdf10a9c00565298affbf1ef`
**Design:** `docs/superpowers/specs/2026-09-24-admin-teacher-ux-completion-design.md`

## Goal

Complete the administrator and teacher product surfaces in one coordinated implementation pass. Do not deploy partial work to production. Keep CSV roster import out of scope.

## Task 1 — Lock the regression contract and isolated CI

**Tests/files**
- Update `tests/unit/app-navigation.test.tsx` for the approved sidebar destinations and dual-capability sectioning.
- Add `tests/unit/admin-teacher-ux-contract.test.ts` for first-class routes, dashboard shortcuts, assignment separation, Administrator editing, and the My Teaching date regression.
- Extend `tests/unit/teaching-assignments.test.ts` with Current/Upcoming/Past classification and assignment date validation.
- Add `supabase/tests/admin_ux_lifecycle.test.sql` for Teacher, Guardian, Class, Subject, and Group archive/restore/delete safety.
- Temporarily add this feature branch to `.github/workflows/redesign-ci.yml`; remove that trigger before merge.

**Gate:** commit tests before production implementation and observe the expected RED quality/database jobs.

## Task 2 — Application shell, navigation, and visual foundation

**Files**
- `src/lib/auth/navigation.ts`
- `src/components/layout/app-navigation.tsx`
- `src/components/layout/app-header.tsx`
- `src/app/[locale]/(protected)/layout.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/globals.css`
- `messages/en.json`
- `messages/ar.json`

**Implementation**
- Introduce grouped navigation metadata for Administration and My Teaching while retaining capability-derived authorization.
- Build desktop sidebar + mobile collapsed navigation.
- Add first-class links for Guardians, Administrators, Teaching Assignments, Export Data, Archives, and My Profile.
- Standardize button/action sizing, page spacing, cards, tables, danger actions, breadcrumbs, focus states, and RTL logical properties.
- Load bundled Arabic font; avoid remote font dependencies.

**Tests:** make navigation contract green; preserve authorization tests.

## Task 3 — Fix teaching resolution and build assignment workspace

**Files**
- `src/features/teaching-assignments/teaching-assignment.types.ts`
- `src/features/teaching-assignments/teaching-assignment.schemas.ts`
- `src/features/teaching-assignments/teaching-assignment.service.ts`
- `src/features/teaching-assignments/teaching-assignment.repository.ts`
- `src/features/teachers/teacher.actions.ts`
- replace/refactor `TeachingAssignmentEditor` in `src/features/teachers/teacher-form.tsx`
- add focused assignment workspace component under `src/features/teaching-assignments/`
- `src/app/[locale]/(protected)/(admin)/teachers/[id]/assignments/page.tsx`
- new `src/app/[locale]/(protected)/(admin)/teaching-assignments/page.tsx`
- `src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx`
- `src/features/weekly-updates/weekly-update.repository.ts`
- new forward migration only if an atomic date-edit RPC is required.

**Implementation**
- Add pure date validation and Current/Upcoming/Past classification.
- Add atomic admin update of assignment start/end dates, preserving overlap constraints and submitted-history safeguards.
- Current assignment checks use today; weekly submission identity continues to use week start.
- Teacher edit page stops embedding a second assignment editor.
- Assignment UI clearly shows Current, Upcoming, Past and Add Assignment, Edit Dates, End Assignment.
- Surface “assigned but no login access” state.

**Tests:** focused unit tests + database tests for date mutation safeguards; add/update E2E scenario.

## Task 4 — Complete People management

**Files**
- Teacher pages/repository/components/actions
- Administrator pages/repository/service/actions
- Student pages/components/actions
- Guardian pages/components/actions
- new first-class routes under `(admin)/administrators`
- new teacher-only `(teacher)/profile` page
- messages EN/AR

**Implementation**
- Teacher list summarizes status, login access, current teaching; normal actions separated from access/lifecycle actions.
- Administrator list moves to first-class route; add Edit Administrator without changing account/Teacher relationships.
- Student list removes duplicate links and uses clear Manage/Edit/Archive affordances.
- Guardian lifecycle controls become consistent.

**Tests:** Administrator last-admin safeguards, shared-login invariants, first-class routes, and action discoverability stay green.

## Task 5 — Complete school structure lifecycle

**Files**
- `src/features/classes/class.schemas.ts`
- `src/features/classes/class.service.ts`
- `src/features/classes/class.repository.ts`
- `src/features/classes/class.actions.ts`
- Class/Subject/Group components/pages
- migration `supabase/migrations/2026092423xx_admin_ux_lifecycle.sql` (actual version must sort after `20260924222147`)
- archive feature types/repository/actions/panels
- PostgreSQL/RLS tests

**Implementation**
- Add rename/edit and active/archive/restore controls for Class, Subject, and Subject Group.
- Extend `archive_entity`, `restore_entity`, and delete-impact support to TEACHER, GUARDIAN, CLASS, SUBJECT, GROUP.
- Non-Student permanent deletion requires archived target, exact confirmation, and zero protected dependencies. Return/show dependency impact; reject unsafe deletion transactionally.
- Student deletion retains its existing transactional history-removal behavior.
- Direct Class detail links into teaching assignment management.

**Tests:** real PostgreSQL tests for same-school lifecycle operations, cross-school isolation, archived prerequisite, dependency blocker, and safe empty-record deletion.

## Task 6 — Operational dashboard, reports, and data tools

**Files**
- dashboard model/repository/page
- report page/components
- new `(admin)/exports/page.tsx`
- new `(admin)/archives/page.tsx`
- old Settings archive route becomes a compatibility redirect
- Settings page becomes school settings only

**Implementation**
- Add quick actions: Add Student, Add Teacher, Assign Teacher, Add Class, Reports.
- Add actionable attention states without inventing new business data.
- Stage report UI as Prepare / Review / Finalize / Send and make bulk Send Ready prominent.
- Split Archives and Export Data into first-class destinations while preserving existing protected export behavior.

## Task 7 — Teacher usability polish

**Files**
- My Teaching page/cards
- Weekly Update form/styles/messages
- History page
- My Profile page

**Implementation**
- This Week page has clear current period, context, student count, status, and one next action.
- Explain no-current-assignment state.
- Keep Mark All Present and sparse exceptions; strengthen sticky Save Draft / Submit hierarchy and mobile spacing.
- Submitted History remains read-only.

## Task 8 — Integrated verification and release preparation

1. Add/adjust E2E coverage for admin sidebar, Administrator discovery, Teacher assignment/edit dates, midweek My Teaching, Data Tools, lifecycle controls, dual-capability navigation, and Arabic RTL at mobile width.
2. Run through branch CI until all quality/database/e2e jobs are green.
3. Inspect exact diff against `main`; no CSV import and no unrelated production changes.
4. Remove the temporary feature-branch CI trigger so workflow remains `main`-based after merge.
5. Update `docs/DECISIONS.md` and `docs/PROGRESS.md` from observed results.
6. Final branch CI must be green after the trigger cleanup using an explicit workflow dispatch if needed, or verify the cleanup-only diff separately before merge.
7. Merge once, then apply any new forward Supabase migration to production in migration order and verify Vercel production.
8. Run live authenticated smoke tests for Administrator, Teacher, dual-capability, EN/AR, and mobile.

## Release constraints

- No production schema mutation before the branch passes all gates.
- Never edit applied migrations 1-28.
- No authorization/RLS weakening.
- No CSV roster import in this pass.
- Preserve independent Administrator/Teacher records and shared-login password behavior.
- One feature branch only; no task branches.
