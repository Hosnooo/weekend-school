# Weekend School Full-Site UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Weekend School into one compact, coherent bilingual school-operations interface while preserving all completed Administrator, Teacher, Teaching Update, Report Cycle, authorization, RLS, and historical behavior.

**Architecture:** Keep the existing Next.js modular monolith and completed domain/repository boundaries. Refactor the UI system first, then migrate coherent product areas onto shared list/detail/workflow patterns, and modernize Playwright only after the interaction model settles. Backend/domain changes are prohibited unless a genuine functional defect is discovered.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl, Supabase/PostgreSQL/RLS, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-full-site-ui-refactor.md`

## Global Constraints

- Baseline before redesign implementation: `8fba5d9952fa3d3947aee9a8efe8c75ca999aaab`.
- Work directly on local `main`; do not create unnecessary branches.
- Never stage or commit `supabase/config.toml`.
- No production deployment during this refactor.
- Do not touch hosted/production Supabase without explicit authorization.
- Preserve English and Arabic, RTL, mobile usability, school scoping, RLS, immutable/finalized historical records, and effective-dated records.
- Preserve Administrator and Teacher as independent capabilities.
- Preserve Class → Subject → optional Group.
- Preserve Subject-scoped new Teacher assignments and historical Group-scoped assignment provenance.
- Preserve flexible Teaching Updates and Report Cycles exactly as implemented through Task 4.
- Do not create migrations for visual changes.
- Do not add decorative counters merely because data is countable.
- Temporary operational problems remain inside the workflow that produced them.
- Administrator screens are compact and operational; Teacher screens remain simpler and task-focused.
- Prefer typography, whitespace, subtle surfaces, and dividers over nested cards.
- Use logical CSS properties for directional styling.
- No automatic GitHub Actions during active refactor work.
- Focused local browser verification is required throughout.
- Full local DB, application, build, and Playwright gates are mandatory before re-enabling automatic CI.

## Review Focus

1. **Dual-capability account:** Admin + Teacher must retain full Admin navigation plus a distinct My Teaching section; Teacher-only accounts must not inherit Admin complexity.
2. **RTL and narrow layouts:** English/Arabic desktop and approximately 360px layouts must preserve actions, hierarchy, menus, forms, and workflow state without horizontal breakage.
3. **Operational state vs decorative statistics:** Dashboard/list/detail pages must not reintroduce repeated totals or permanent counters that do not change the next action.
4. **Historical compatibility:** old Group-scoped assignments and historical Subject/Group reports remain readable even after the current UI is simplified around Subject assignments and Class Report Cycles.
5. **Contextual failures:** send/delivery failures and other temporary exceptions stay attached to their Report Cycle/workspace and disappear from active attention state when resolved while history remains available.

---

## Planned File Structure

### Shared UI and shell

- `src/app/globals.css`
- `src/app/[locale]/(protected)/layout.tsx`
- `src/app/[locale]/(protected)/protected-layout.module.css`
- `src/components/layout/app-header*`
- `src/components/layout/app-navigation.tsx`
- `src/components/layout/app-navigation.module.css`
- existing primitives under `src/components/ui/`
- `messages/en.json`
- `messages/ar.json`

### Admin product areas

- `src/app/[locale]/(protected)/(admin)/dashboard/**`
- `students/**`
- `guardians/**`
- `teachers/**`
- `administrators/**`
- `classes/**`
- `groups/**`
- `reports/**`
- `exports/**`
- `archives/**`
- `settings/**`
- corresponding feature components under `src/features/**`

### Teacher product areas

- `src/app/[locale]/(protected)/(teacher)/my-teaching/**`
- `history/**`
- `profile/**`
- `my-groups/**`
- Teaching Update components under `src/features/weekly-updates/**`

### Verification

- existing unit/contract tests under `tests/unit/**`
- existing DB/RLS tests under `supabase/tests/**`
- Playwright specs under `tests/e2e/**`
- `.github/workflows/*.yml`

---

## Task 1: Pause Automatic GitHub Actions

**Files:**
- Modify: `.github/workflows/redesign-ci.yml`
- Verify: `.github/workflows/ux-redesign-targeted.yml`
- Verify: `.github/workflows/ux-reference-visual.yml`

**Interfaces:**
- Produces: manual-only GitHub Actions throughout active redesign work.

- [x] **Step 1: Remove the `push` trigger from `redesign-ci.yml`.**
- [x] **Step 2: Keep all existing quality/database/E2E jobs intact for manual execution.**
- [x] **Step 3: Confirm the two UX workflows are already `workflow_dispatch` only.**
- [x] **Step 4: Commit on `main` as `chore: pause automatic CI for UI refactor`.**

Automatic GitHub Actions stay disabled until Task 8.

---

## Task 2: Refactor Shared Visual Foundation and Application Shell

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/[locale]/(protected)/layout.tsx`
- Modify: `src/app/[locale]/(protected)/protected-layout.module.css`
- Modify: `src/components/layout/app-navigation.tsx`
- Modify: `src/components/layout/app-navigation.module.css`
- Modify: current `src/components/layout/app-header*`
- Modify: `src/components/ui/page-header.tsx`
- Modify: `src/components/ui/section-header.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/data-table.tsx`
- Modify: `src/components/ui/form-field.tsx`
- Modify: `src/components/ui/alert.tsx`
- Modify: `src/components/ui/empty-state.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/ui-reference.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Test: `tests/unit/design-system-foundation.test.tsx`
- Test: `tests/unit/app-navigation.test.tsx`
- E2E: `tests/e2e/ui-reference-visual.spec.ts`
- E2E: `tests/e2e/app-shell-visual.spec.ts`

**Interfaces:**
- Consumes: existing shared UI primitives and capability-sensitive navigation.
- Produces: the visual language used by all later tasks without breaking current feature call sites.

- [ ] **Step 1: Extend design-system tests for approved hierarchy, compact density, accessible controls, narrow-list actions, and RTL-safe layout.**
- [ ] **Step 2: Run those tests and observe failures before changing implementation.**
- [ ] **Step 3: Consolidate semantic tokens, typography, spacing, surfaces, borders, radii, control heights, and focus states in `globals.css`.**
- [ ] **Step 4: Refine shared primitives so pages can rely on typography/whitespace/dividers instead of nested cards.**
- [ ] **Step 5: Refine the desktop sidebar and mobile drawer while preserving capability-sensitive navigation and dual Admin/Teacher behavior.**
- [ ] **Step 6: Update the internal UI reference to show the finished shared patterns.**
- [ ] **Step 7: Verify English desktop, Arabic desktop, English narrow, and Arabic narrow locally.**
- [ ] **Step 8: Run focused unit tests, typecheck, lint, and focused shell/reference Playwright smoke.**
- [ ] **Step 9: Commit as `refactor: establish compact UI foundation`.**

---

## Task 3: Refactor Dashboard and People Management

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/dashboard/**`
- Modify: `students/**`
- Modify: `guardians/**`
- Modify: `teachers/**`
- Modify: `administrators/**`
- Modify: corresponding components under `src/features/students/**`, `guardians/**`, `teachers/**`, `administrators/**`
- Modify: `messages/en.json`, `messages/ar.json`
- Test: `tests/unit/student-guardian-ux-contract.test.ts`
- Test: `tests/unit/admin-teacher-ux-contract.test.ts`
- E2E: `tests/e2e/student-guardian-management.spec.ts`
- E2E: `tests/e2e/teacher-management.spec.ts`

**Interfaces:**
- Consumes: Task 2 list/detail/form patterns.
- Produces: one consistent People-management interaction language.

- [ ] **Step 1: Update People UX contract tests to require record identity first, one primary create action, no decorative counters, read-only detail by default, and progressive disclosure for secondary actions.**
- [ ] **Step 2: Refactor Dashboard from statistics-first to Needs attention / In progress / Quick actions. Do not manufacture empty-state metrics.**
- [ ] **Step 3: Refactor Students + Guardians together while preserving enrollment, Guardian linking, lifecycle, import/export, and history.**
- [ ] **Step 4: Refactor Teachers + Administrators together while preserving login/account separation, assignment links, lifecycle, and last-active-Administrator protections.**
- [ ] **Step 5: Verify representative EN/AR desktop/narrow pages manually.**
- [ ] **Step 6: Run focused unit and People browser tests.**
- [ ] **Step 7: Commit as `refactor: unify dashboard and people workflows`.**

---

## Task 4: Refactor Classes, Subjects, Groups, and Teaching Assignments

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/classes/**`
- Modify: `src/app/[locale]/(protected)/(admin)/groups/**`
- Modify: current Teaching Assignment routes under `src/app/[locale]/(protected)/(admin)/teachers/**`
- Modify: `src/features/teaching-assignments/**`
- Modify: class/subject/group presentation components under `src/features/**`
- Modify: `messages/en.json`, `messages/ar.json`
- Test: `tests/unit/teaching-assignments.test.ts`
- Test: `tests/unit/teaching-assignment-mutations.test.ts`
- Test: `tests/unit/teaching-assignment-workspace.test.tsx`
- E2E: `tests/e2e/teaching-assignment-workspace.spec.ts`

**Interfaces:**
- Preserves Subject-scoped authorization and historical Group-scoped provenance.
- Produces final School-management UI used by Admin and linked Teacher workflows.

- [ ] **Step 1: Update tests so new assignment creation never requires Group selection.**
- [ ] **Step 2: Add regression coverage that historical Group-scoped assignments remain visible/readable.**
- [ ] **Step 3: Refactor Classes around Class → Subjects → optional Groups using structured rows/contextual management instead of nested cards.**
- [ ] **Step 4: Refactor Teaching Assignments to explicit view/edit/action states: Add assignment, Edit dates, End assignment, Delete where allowed, and clear blocked-history explanation.**
- [ ] **Step 5: Verify Teacher Group-management entry points remain discoverable without turning Groups into permission boundaries.**
- [ ] **Step 6: Run focused unit and browser tests.**
- [ ] **Step 7: Commit as `refactor: simplify school and assignment management`.**

---

## Task 5: Refactor Teacher Experience and Teaching Updates

**Files:**
- Modify: `src/app/[locale]/(protected)/(teacher)/my-teaching/**`
- Modify: `src/app/[locale]/(protected)/(teacher)/history/**`
- Modify: `src/app/[locale]/(protected)/(teacher)/profile/**`
- Modify: `src/app/[locale]/(protected)/(teacher)/my-groups/**`
- Modify: `src/features/weekly-updates/**`
- Modify: Teaching Update presentation data shaping only where needed
- Modify: `messages/en.json`, `messages/ar.json`
- Test: existing Teaching Update unit/contract tests
- E2E: Teacher workflow specs under `tests/e2e/**`

**Interfaces:**
- Preserves flexible RANGE/DATES Teaching Updates and OPEN/SUBMITTED/DISMISSED behavior.
- Produces a task-focused Teacher experience.

- [ ] **Step 1: Replace stale fixed “This week” UI assumptions in tests with flexible Teaching Update semantics.**
- [ ] **Step 2: Refactor My Teaching around current/open/requested work rather than administrative statistics.**
- [ ] **Step 3: Refactor Teaching Update editor while preserving coverage kind, dates, EN/AR progress, attendance, default performance, overrides/comments, overlap warnings, future OPEN behavior, and submission timing rules.**
- [ ] **Step 4: Refactor History and Profile so completed/history information is visually quieter.**
- [ ] **Step 5: Verify approximately 360px English and Arabic Teacher workflows.**
- [ ] **Step 6: Run focused unit and Teacher browser tests.**
- [ ] **Step 7: Commit as `refactor: streamline teacher teaching updates`.**

---

## Task 6: Refactor Admin Teaching Updates and Report Cycles

**Files:**
- Modify: current Admin Teaching Updates route/components
- Modify: `src/app/[locale]/(protected)/(admin)/reports/page.tsx`
- Modify: `src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx`
- Modify: `src/features/reports/report-cycle-sources.tsx`
- Modify: presentation portions of `src/features/reports/**`
- Modify: `messages/en.json`, `messages/ar.json`
- Test: `tests/unit/report-cycle-contract.test.ts`
- E2E: `tests/e2e/report-cycle-workflow.spec.ts`
- E2E: existing report-delivery workflow spec

**Interfaces:**
- Preserves Admin Teaching Update behavior and Class Report Cycle behavior.
- Produces staged workflow presentation: Sources → Student Reports → Preview → Send → Delivery.

- [ ] **Step 1: Update tests for staged workflow presentation without changing domain state.**
- [ ] **Step 2: Refactor Admin Teaching Updates so current OPEN/requested work leads, with concise history and contextual actions.**
- [ ] **Step 3: Refactor Report Cycle list page around current cycles, class, period, meaningful state, and Create Report Cycle; keep historical Subject/Group reports secondary.**
- [ ] **Step 4: Refactor Report Cycle workspace so Sources clearly show include/exclude, Subject/Group, Teacher/completer, coverage, partial overlap, missing contexts, and Request update.**
- [ ] **Step 5: Keep send results contextual, e.g. `18 sent · 2 failed`, rather than introducing a global failed-delivery counter.**
- [ ] **Step 6: Verify resolved delivery issues disappear from active attention state while history remains.**
- [ ] **Step 7: Run focused report unit and E2E tests.**
- [ ] **Step 8: Commit as `refactor: clarify teaching update and report workflows`.**

---

## Task 7: Refactor Data, Archives, Settings, and Remaining Shared Surfaces

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/exports/**`
- Modify: `src/app/[locale]/(protected)/(admin)/archives/**`
- Modify: `src/app/[locale]/(protected)/(admin)/settings/**`
- Modify: `src/app/[locale]/(protected)/loading.tsx`
- Modify: `src/app/[locale]/(protected)/error.tsx`
- Modify: affected shared lifecycle/export components
- Modify: `messages/en.json`, `messages/ar.json`
- Test: relevant archive/export/settings unit tests
- E2E: relevant existing browser specs

**Interfaces:**
- Consumes all shared UI patterns.
- Completes page-pattern migration for the protected application.

- [ ] **Step 1: Refactor Export around direct task completion rather than explanatory cards.**
- [ ] **Step 2: Refactor Archives around record identity, lifecycle state, restore, and permanent-delete impact.**
- [ ] **Step 3: Refactor School Settings into compact form sections.**
- [ ] **Step 4: Align protected loading/error states with the shared system.**
- [ ] **Step 5: Search the protected application for remaining oversized/nested cards, repeated counters, permanently open creation forms, physical left/right CSS, and stale fixed-week copy.**
- [ ] **Step 6: Run focused tests and representative browser smoke.**
- [ ] **Step 7: Commit as `refactor: finish protected app UI migration`.**

---

## Task 8: Modernize Full E2E Suite, Run Release Gates, and Restore CI

**Files:**
- Modify: shared Playwright helpers under `tests/e2e/**`
- Modify: all stale E2E specs affected by Tasks 2–7
- Modify: `.github/workflows/redesign-ci.yml`
- Modify if needed: `.github/workflows/ux-redesign-targeted.yml`
- Modify if needed: `.github/workflows/ux-reference-visual.yml`
- Modify: `docs/PROGRESS.md` only with observed verification results

**Interfaces:**
- Consumes: final interaction model from all previous tasks.
- Produces: current browser contracts and re-enabled CI commands that match local verified reality.

- [ ] **Step 1: Fix shared E2E helpers first.**

  Remove obsolete assumptions about:
  - fixed “This week” links;
  - Group-scoped new assignments;
  - old report Prepare/Review/Finalize tabs;
  - outdated selectors tied to pre-refactor page structure.

- [ ] **Step 2: Update stale browser specs by product area, testing behavior rather than incidental DOM structure.**
- [ ] **Step 3: Reset local Supabase through the required legacy fixture path and run the complete DB/RLS suite.**
- [ ] **Step 4: Run the complete application gate: all unit/contract tests, typecheck, lint, production build, and `git diff --check`.**
- [ ] **Step 5: Run the complete Playwright suite against a clean local E2E seed.**
- [ ] **Step 6: Manually verify representative EN/AR desktop/narrow Admin and Teacher flows, including Report Cycle send/delivery state.**
- [ ] **Step 7: Restore intended automatic GitHub triggers only after all local gates are green. Keep commands identical to the verified local commands wherever practical.**
- [ ] **Step 8: Commit E2E/CI restoration as a coherent final verification patch.**
- [ ] **Step 9: Push and allow GitHub CI to validate the final state. Do not poll endlessly; inspect once results are available.**
- [ ] **Step 10: Production deployment remains a separate explicit decision after CI is green.**

---

## Final Acceptance Checklist

Before the refactor is considered complete, verify all of the following with fresh evidence:

- Admin shell/navigation coherent and compact.
- Dual Admin/Teacher account retains separate My Teaching area.
- Teacher-only account does not see Admin complexity.
- Dashboard contains actionable work instead of decorative metric tiles.
- Students, Guardians, Teachers, Administrators use one management language.
- Classes/Subjects/Groups use the established domain hierarchy.
- New Teacher assignments remain Subject-scoped.
- Historical Group assignments remain readable.
- Teacher Teaching Updates remain flexible RANGE/DATES workflows.
- Admin Teaching Updates retain request/shared completion behavior.
- Report Cycles preserve source selection and historical compatibility.
- Delivery problems are contextual and temporary rather than global permanent counters.
- English desktop verified.
- Arabic desktop verified.
- English narrow verified.
- Arabic narrow verified.
- Full unit/contract suite green.
- Full PostgreSQL/RLS suite green.
- Typecheck green.
- Lint green.
- Production build green.
- Full Playwright suite green.
- `git diff --check` green.
- `supabase/config.toml` remains uncommitted.
- Automatic CI is re-enabled only after the above local evidence exists.
- Production deployment has not occurred without explicit approval.
