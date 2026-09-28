# Flexible Teaching Updates and Class Report Cycles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed weekly Teacher submissions with flexible dated Teaching Updates, make Teacher assignments Subject-only with Teacher-managed Subject Groups, and convert Admin reporting into Class-level Report Cycles with source selection, preview, send, and delivery status.

**Architecture:** Evolve the existing `weekly_submissions`, Teaching Assignment, Subject Group, and report-batch foundations rather than replacing them. Preserve IDs and finalized history; add flexible date coverage and request metadata to the current submission model, change authorization to Class Subject scope, reuse `report_batches`/`report_section_sources` for Class cycles, and integrate existing report preview/delivery components into one Reports workflow.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase/PostgreSQL/RLS/RPC, next-intl EN/AR, Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-flexible-teaching-updates-and-report-cycles-design.md`

## Global Constraints

- Work on local `main`; do not create unnecessary branches or worktrees.
- Do not stage or commit the user-local `supabase/config.toml`.
- Do not touch hosted/production Supabase.
- Keep existing finalized reports, deliveries, Teacher IDs, submission IDs, and dated membership history valid.
- Teacher assignment authority is Class + Subject only; Groups are organizational, not permission boundaries.
- Overlapping Teaching Updates are allowed and only warned about.
- New Admin Report Cycles are Class-scoped and use automatic source selection with Admin include/exclude override.
- Guardian delivery remains inside Reports and must have a preview before first send.
- Preserve EN/AR, RTL, 360px usability, school scoping, and RLS.
- Prefer one coherent commit per task below; do not split into tiny mechanical commits.

## Review Focus

1. **Legacy Group-scoped assignments:** old rows must still grant the Teacher Subject-wide access without rewriting history; new assignment writes must not create Group-scoped assignments.
2. **Concurrent Admin request completion:** two co-Teachers submitting the same request must produce one winner and a clean already-completed result for the other.
3. **Date overlap semantics:** RANGE and DATES updates must both calculate eligibility correctly, including partial overlap at Report Cycle boundaries.
4. **Historical locking:** a source used by a finalized report must not be reopened/dismissed/changed, while an unsent/unfinalized source remains reversible.
5. **Roster correctness after Group moves:** current Group changes must not rewrite students/source membership that already fed historical finalized reports.

---

## File Structure

### Database

- Create: `supabase/migrations/20260927220000_subject_only_teacher_groups.sql`
  - Subject-only Teaching Assignment enforcement for new writes;
  - Subject-wide Teacher authorization;
  - Teacher Group-management RPC/RLS;
  - dated membership move operations.

- Create: `supabase/migrations/20260927221000_flexible_teaching_updates.sql`
  - Teaching Update coverage/request/dismissal fields;
  - specific-date child table;
  - legacy backfill;
  - removal of weekly uniqueness as business identity;
  - shared Admin-request authorization and atomic submit;
  - source-lock checks.

- Create/modify tests:
  - `supabase/tests/flexible_teaching_updates.test.sql`
  - `supabase/tests/teacher_subject_group_management.test.sql`
  - `supabase/tests/reopen_weekly_submission.test.sql`
  - `supabase/tests/class_subject_group_rls.test.sql`
  - `supabase/tests/subject_aware_reports.test.sql`
  - `tests/integration/database/migrations.test.ts`

### Teaching assignment and Group application layer

- Modify:
  - `src/features/teaching-assignments/teaching-assignment.types.ts`
  - `src/features/teaching-assignments/teaching-assignment.schemas.ts`
  - `src/features/teaching-assignments/teaching-assignment.repository.ts`
  - `src/features/teaching-assignments/teaching-assignment.service.ts`
  - `src/features/teaching-assignments/teaching-assignment.actions.ts`
  - `src/features/teachers/teacher-form.tsx`
  - `src/features/classes/class-subject-card.tsx`
  - `src/features/classes/subject-group-form.tsx`
  - `src/features/classes/class.actions.ts`
  - `src/features/classes/class.repository.ts`

- Create focused Teacher Group UI only if current Class components cannot be reused cleanly:
  - `src/features/classes/teacher-subject-group-manager.tsx`

### Teaching Updates application layer

Keep the current feature folder initially to avoid a mechanical repo-wide rename during the semantic migration.

- Modify:
  - `src/features/weekly-updates/weekly-update.types.ts`
  - `src/features/weekly-updates/weekly-update.schemas.ts`
  - `src/features/weekly-updates/weekly-update.model.ts`
  - `src/features/weekly-updates/weekly-update.repository.ts`
  - `src/features/weekly-updates/weekly-update.actions.ts`
  - `src/features/weekly-updates/weekly-update-form.tsx`
  - `src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx`
  - `src/app/[locale]/(protected)/(teacher)/my-teaching/update/page.tsx`
  - `src/app/[locale]/(protected)/(teacher)/history/page.tsx`

- Create:
  - `src/features/weekly-updates/teaching-update-create-form.tsx`
  - `src/features/weekly-updates/teaching-update-list.tsx`
  - `src/app/[locale]/(protected)/(admin)/teaching-updates/page.tsx`
  - `src/app/[locale]/(protected)/(admin)/teaching-updates/new/page.tsx`

### Report Cycles

- Modify:
  - `src/features/reports/admin-report-contexts.ts`
  - `src/features/reports/admin-report-contexts.repository.ts`
  - `src/features/reports/admin-report-workspace.model.ts`
  - `src/features/reports/admin-report-workspace.repository.ts`
  - `src/features/reports/admin-report-workflow.actions.ts`
  - `src/features/reports/report-batch.repository.ts`
  - `src/features/reports/report-composer.tsx`
  - `src/features/reports/report-preview-frame.tsx`
  - `src/features/reports/admin-report-delivery.actions.ts`
  - `src/app/[locale]/(protected)/(admin)/reports/page.tsx`
  - `src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx`
  - existing report delivery-status route as compatibility/deep link

- Create only where it keeps the existing workspace readable:
  - `src/features/reports/report-cycle-sources.tsx`
  - `src/features/reports/report-cycle-preview.tsx`
  - `src/features/reports/report-cycle-delivery.tsx`

### Copy/navigation/tests

- Modify:
  - `messages/en.json`
  - `messages/ar.json`
  - the existing protected navigation component that currently links Teacher/Admin reporting routes
  - `tests/unit/weekly-update.test.ts`
  - `tests/unit/weekly-update-form.test.tsx`
  - `tests/unit/teacher-weekly-ux-contract.test.ts`
  - `tests/unit/reversible-report-workflow-contract.test.ts`
  - relevant Admin report UX contract tests
  - `tests/e2e/flexible-teaching-updates.spec.ts`
  - `tests/e2e/report-cycle-workflow.spec.ts`
  - `tests/e2e/teaching-assignment-workspace.spec.ts`
  - `tests/e2e/class-structure-management.spec.ts`.

---

### Task 1: Establish the safe database contract

**Files:**
- Create: `supabase/migrations/20260927220000_subject_only_teacher_groups.sql`
- Create: `supabase/migrations/20260927221000_flexible_teaching_updates.sql`
- Create: `supabase/tests/flexible_teaching_updates.test.sql`
- Create: `supabase/tests/teacher_subject_group_management.test.sql`
- Modify: `supabase/tests/reopen_weekly_submission.test.sql`
- Modify: `supabase/tests/class_subject_group_rls.test.sql`
- Modify: `tests/integration/database/migrations.test.ts`

**Interfaces:**
- Produces: flexible coverage fields on existing `weekly_submissions`, specific-date rows, Admin-request OPEN rows, dismissal metadata, atomic submit/reopen rules, Subject-wide Teacher authorization, Teacher Group-management RPCs.
- Preserves: existing `weekly_submissions.id` and `report_section_sources.weekly_submission_id`.

- [ ] **Step 1: Add failing pgTAP cases for Subject-only authorization**

Pin:
- an effective legacy Group-scoped assignment grants access to all Groups of that Class Subject;
- a Teacher cannot access another Class Subject;
- new assignment creation with a non-null Group is rejected through the supported mutation path;
- effective contexts deduplicate the legacy Group rows to one Class Subject.

Run:
```bash
pnpm test:db
```
Expected: new assertions fail before migration implementation.

- [ ] **Step 2: Add failing pgTAP cases for flexible coverage**

Pin:
- legacy rows backfill to RANGE `week_start .. week_start + 6`;
- RANGE may be one day or arbitrary span;
- DATES stores exact non-consecutive dates;
- overlapping rows are allowed;
- overlap lookup detects overlap and does not block;
- future-covered OPEN rows can exist;
- submit fails while any covered date is in the future.

- [ ] **Step 3: Add failing pgTAP cases for Admin requests and lifecycle**

Pin:
- Admin can create an OPEN row/request set without a completing Teacher;
- Subject request creates one linked row per currently active Group or one null-Group row when no Groups exist;
- a later-created Group is not auto-added;
- all assigned Subject Teachers can read the open request;
- first atomic submit records the Teacher and succeeds;
- second racing submit returns already-completed behavior;
- Teacher dismissal of Admin request requires reason;
- SUBMITTED cannot be dismissed directly;
- reopening is blocked if the update is linked to a finalized report source.

- [ ] **Step 4: Implement the two forward-only migrations**

Use the existing physical `weekly_submissions` table.

Add:
```ts
coverageKind: 'RANGE' | 'DATES'
periodStart: string
periodEnd: string
requestSetId: string | null
createdByProfileId: string | null // null only for backfilled legacy rows
createdByKind: 'TEACHER' | 'ADMIN'
adminNote: string | null
dismissedAt: string | null
dismissedByProfileId: string | null
dismissalReason: string | null
```

Add a child date table for `DATES`.

Keep `week_start` populated for compatibility but remove it from uniqueness/business identity.

Allow `teacher_id` to be null only while an Admin-created item is OPEN; require it when SUBMITTED.

Do not drop old assignment Group data. Change authorization to test Teacher + Class Subject + effective date and ignore assignment Group. Add DB-enforced supported-write rules so new assignments are Subject-only.

- [ ] **Step 5: Implement Teacher Group-management RPCs**

Provide exact service-facing operations:

```ts
createSubjectGroupForTeacher(classSubjectId, nameEn, nameAr)
updateSubjectGroupForTeacher(subjectGroupId, nameEn, nameAr)
setSubjectGroupActiveForTeacher(subjectGroupId, isActive)
moveStudentSubjectGroupForTeacher(classSubjectId, studentId, targetGroupId | null, effectiveOn)
```

Database verifies current school + active Teacher + effective Class Subject assignment.

Membership moves end the previous active dated membership and insert the next one rather than rewriting history.

- [ ] **Step 6: Run database and migration-contract verification**

```bash
pnpm test:db
pnpm test -- tests/integration/database/migrations.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit one coherent database contract**

```bash
git add \
  supabase/migrations \
  supabase/tests \
  tests/integration/database/migrations.test.ts
git commit -m "feat: establish flexible teaching update contract"
```

Do not stage `supabase/config.toml`.

---

### Task 2: Simplify Teaching Assignments and add Teacher Group management

**Files:**
- Modify: `src/features/teaching-assignments/teaching-assignment.types.ts`
- Modify: `src/features/teaching-assignments/teaching-assignment.schemas.ts`
- Modify: `src/features/teaching-assignments/teaching-assignment.repository.ts`
- Modify: `src/features/teaching-assignments/teaching-assignment.service.ts`
- Modify: `src/features/teaching-assignments/teaching-assignment.actions.ts`
- Modify: `src/features/teachers/teacher-form.tsx`
- Modify: `src/features/classes/class-subject-card.tsx`
- Modify: `src/features/classes/subject-group-form.tsx`
- Modify: `src/features/classes/class.actions.ts`
- Modify: `src/features/classes/class.repository.ts`
- Create if needed: `src/features/classes/teacher-subject-group-manager.tsx`
- Test: existing teaching-assignment and class/group unit/E2E tests.

**Interfaces:**
- Consumes: Subject-only DB authorization/RPCs from Task 1.
- Produces: Admin assignment UI without Group targeting; Teacher Subject Group manager.

- [ ] **Step 1: Write failing unit/contract tests**

Assert:
- Teaching Assignment input contains Teacher + Class Subject + dates, not Group;
- Teacher form has no assignment Group selector;
- effective teaching list deduplicates by Teacher + Class Subject;
- assigned Teacher can see Group-management controls for their Subject;
- Teacher cannot mutate a different Subject.

Run targeted tests with:
```bash
pnpm test -- tests/unit/admin-teacher-ux-contract.test.ts
```
plus the exact existing teaching assignment tests found during implementation.

- [ ] **Step 2: Remove Group from new assignment application contracts**

Change:
```ts
TeachingAssignmentInput
TeachingAssignment
EffectiveTeachingContext
```
so application authorization/navigation is Class Subject based.

Repository writes `subject_group_id: null`.

Do not perform a mechanical database-column deletion.

- [ ] **Step 3: Reuse Class Subject Group components for Teacher management**

Prefer permission-aware reuse of existing `class-subject-card.tsx` / Group form rather than building a second Group system.

Expose create/rename/archive/restore/move-student actions through the Task 1 RPCs.

- [ ] **Step 4: Verify EN/AR and mobile markup contracts**

Add/update translation keys and ensure no Admin-only Class mutation controls leak into Teacher view.

- [ ] **Step 5: Run focused tests, typecheck, lint**

```bash
pnpm test -- tests/unit/admin-teacher-ux-contract.test.ts
pnpm typecheck
pnpm lint
pnpm test:e2e -- tests/e2e/teaching-assignment-workspace.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add src messages tests
git commit -m "feat: make teacher assignments subject scoped"
```

---

### Task 3: Replace the weekly Teacher UX with flexible Teaching Updates

**Files:**
- Modify: `src/features/weekly-updates/weekly-update.types.ts`
- Modify: `src/features/weekly-updates/weekly-update.schemas.ts`
- Modify: `src/features/weekly-updates/weekly-update.model.ts`
- Modify: `src/features/weekly-updates/weekly-update.repository.ts`
- Modify: `src/features/weekly-updates/weekly-update.actions.ts`
- Modify: `src/features/weekly-updates/weekly-update-form.tsx`
- Create: `src/features/weekly-updates/teaching-update-create-form.tsx`
- Create: `src/features/weekly-updates/teaching-update-list.tsx`
- Modify: Teacher My Teaching/update/history routes
- Create: Admin Teaching Updates routes
- Modify: `messages/en.json`, `messages/ar.json`
- Test: weekly-update unit/form/UX/reversible contract tests plus `tests/e2e/flexible-teaching-updates.spec.ts`.

**Interfaces:**
- Consumes: flexible DB update contract from Task 1 and Subject-only contexts from Task 2.
- Produces:
```ts
createTeachingUpdate(...)
createAdminTeachingUpdateRequest(...)
saveTeachingUpdate(...)
submitTeachingUpdate(...)
dismissTeachingUpdate(...)
reopenTeachingUpdate(...)
listTeachingUpdates(...)
findTeachingUpdateOverlaps(...)
```

- [ ] **Step 1: Rewrite tests around Teaching Update semantics before UI code**

Pin:
- Single day, RANGE, and DATES validation;
- future create allowed / future submit denied;
- overlap warning is non-blocking;
- Teacher can create multiple same-week updates;
- Admin request set expands by current Groups;
- first Teacher submission completes shared request;
- dismissal/reopen rules;
- submitted/finalized source lock;
- legacy weekly row renders as a Teaching Update.

Run:
```bash
pnpm test -- \
  tests/unit/weekly-update.test.ts \
  tests/unit/weekly-update-form.test.tsx \
  tests/unit/teacher-weekly-ux-contract.test.ts \
  tests/unit/reversible-report-workflow-contract.test.ts
```

Expected: FAIL on old weekly assumptions.

- [ ] **Step 2: Implement repository/model/action contract**

Keep internal compatibility where useful, but user-facing names/messages say Teaching Update.

Use school timezone for future-submit check.

Overlap query returns warnings; it never converts overlap into validation failure.

- [ ] **Step 3: Rebuild My Teaching as workload + creation**

The page must show:
- Needs attention;
- Recent;
- Add Teaching Update;
- Requested by Admin;
- Completed by Teacher X;
- Dismissed/history through filters.

Do not auto-create one submission per current week.

- [ ] **Step 4: Add Admin Teaching Updates page**

Admin can:
- filter;
- request Subject update;
- set flexible coverage;
- optionally prefill;
- add Admin note;
- see request-set progress;
- reopen/dismiss when allowed.

Do not duplicate backend creation logic between contextual and central entry points.

- [ ] **Step 5: Verify translations, RTL and responsive behavior**

Use existing form/table/card primitives. Avoid a custom calendar unless necessary; simple date inputs + add-specific-date controls are preferred.

- [ ] **Step 6: Run focused and full app tests**

```bash
pnpm test -- \
  tests/unit/weekly-update.test.ts \
  tests/unit/weekly-update-form.test.tsx \
  tests/unit/teacher-weekly-ux-contract.test.ts \
  tests/unit/reversible-report-workflow-contract.test.ts
pnpm typecheck
pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git add src messages tests
git commit -m "feat: add flexible teaching updates"
```

---

### Task 4: Convert Admin reporting to Class Report Cycles with source selection

**Files:**
- Modify: report context/workspace repositories, models and actions
- Modify: `src/features/reports/report-batch.repository.ts`
- Create: `src/features/reports/report-cycle-sources.tsx`
- Modify: Admin Reports page and workspace route
- Modify: `supabase/tests/subject_aware_reports.test.sql`
- Add/update unit contract tests for Admin reporting.
- Create: `tests/e2e/report-cycle-workflow.spec.ts`

**Interfaces:**
- Consumes: SUBMITTED Teaching Updates with flexible coverage.
- Produces:
```ts
createClassReportCycle(classId, periodStart, periodEnd, templateId)
listEligibleTeachingUpdateSources(batchId)
setReportCycleSourceIncluded(batchId, submissionId, included)
getClassReportCycleWorkspace(batchId)
```

- [ ] **Step 1: Add failing DB/unit tests for source eligibility**

Assert:
- new cycle is `scope_type = CLASS`;
- all submitted overlapping updates in Class are selected by default;
- OPEN/DISMISSED are excluded;
- RANGE boundary overlap works;
- DATES overlap uses exact selected dates;
- partial overlaps are flagged;
- Admin can exclude and re-include before finalization;
- finalization freezes source selection.

- [ ] **Step 2: Change Reports landing page from per-Subject contexts to Report Cycles**

Admin creates Class + custom period.

Keep historical SUBJECT/GROUP batches readable; do not migrate finalized history into fake Class cycles.

- [ ] **Step 3: Build Sources stage**

Group eligible sources by Subject and Group.

Show:
- selected state;
- Teacher/completer;
- coverage;
- partial-overlap warning;
- missing Admin-request items;
- Request another update action.

Auto-select first, Admin override second.

- [ ] **Step 4: Adapt report composition to Class scope**

Reuse existing approvals, student overrides, attendance conflict logic, `finalize_report_batch`, and immutable snapshots.

Do not create a second report-generation engine.

- [ ] **Step 5: Run report/database tests**

```bash
pnpm test:db
pnpm test -- tests/unit/reversible-report-workflow-contract.test.ts
pnpm typecheck
```

plus existing Admin report workflow tests discovered in the repo.

- [ ] **Step 6: Commit**

```bash
git add supabase src tests messages
git commit -m "feat: add class report cycles"
```

---

### Task 5: Integrate Preview, Send, and Delivery Status into the Report Cycle

**Files:**
- Modify: `src/features/reports/report-composer.tsx`
- Modify: `src/features/reports/report-preview-frame.tsx`
- Modify: `src/features/reports/admin-report-delivery.actions.ts`
- Create if useful: `src/features/reports/report-cycle-preview.tsx`
- Create if useful: `src/features/reports/report-cycle-delivery.tsx`
- Modify: Report workspace route
- Modify/redirect: existing `reports/delivery-status` route
- Modify: translations and report UX tests.

**Interfaces:**
- Consumes: finalized Class Report Cycle and existing generated report/delivery rows.
- Produces one workspace flow:
`Sources -> Student Reports -> Preview -> Send -> Delivery Status`.

- [ ] **Step 1: Write failing UI contract tests**

Assert:
- Preview exists before first Send action;
- Preview renders the same finalized/generated Student report data used for delivery;
- recipient warnings appear before sending;
- Delivery Status is inside the cycle;
- retry/resend does not mutate report snapshot;
- existing deep delivery-status route still resolves or redirects safely.

- [ ] **Step 2: Add workspace stage navigation**

Do not create a new top-level Delivery nav item.

Reports dashboard should expose lifecycle statuses:
- Collecting updates;
- In review;
- Ready to preview;
- Ready to send;
- Sent;
- Delivery issue.

- [ ] **Step 3: Integrate existing preview components**

Reuse `report-preview-frame.tsx` and email-template preview logic.

Provide Student preview and Guardian-recipient context.

- [ ] **Step 4: Integrate send/delivery controls**

Reuse existing send/retry actions and delivery records.

Ensure first send requires finalized content and the Preview stage is reachable/acknowledged by UI flow without inventing a fragile client-only security flag.

- [ ] **Step 5: Run focused tests**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add src messages tests
git commit -m "feat: integrate report preview and delivery"
```

---

### Task 6: Historical upgrade, E2E, and final verification

**Files:**
- Modify only files required by failures found in verification.
- Add/modify E2E specs for the final Admin/Teacher flow.
- Do not perform unrelated cleanup.

**Interfaces:**
- Validates all earlier task interfaces together.

- [ ] **Step 1: Prove historical upgrade path**

Use the same historical-reset strategy already used successfully on the project:

```bash
pnpm exec supabase db reset --version 202609230027
eval "$(pnpm exec supabase status -o env)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/fixtures/teacher_id_history_pre28.sql
pnpm exec supabase migration up --local
```

Verify all new migrations apply over the known historical baseline and preserve old submission/report references.

- [ ] **Step 2: Run complete database suite**

```bash
pnpm test:db
```

Expected: PASS.

- [ ] **Step 3: Run complete app suite**

```bash
pnpm test
pnpm typecheck
pnpm lint
git diff --check
pnpm build
```

Expected: all PASS.

- [ ] **Step 4: Run focused E2E flows**

At minimum prove:

1. Admin assigns Teacher to Class Subject without Group.
2. Teacher creates/manages Subject Groups and moves a student.
3. Teacher creates two overlapping/same-week Teaching Updates and receives only a warning.
4. Admin creates Subject request; N Group items appear.
5. Two co-Teachers see request; first submit completes it.
6. Admin creates Class Report Cycle; eligible sources are preselected.
7. Admin excludes/re-includes source.
8. Admin previews Student/Guardian output.
9. Admin finalizes/sends.
10. Delivery status is visible inside cycle.
11. Finalized source cannot reopen.
12. Historical sent report remains immutable after later Group move/update.

Run:
```bash
pnpm test:e2e --   tests/e2e/teaching-assignment-workspace.spec.ts   tests/e2e/class-structure-management.spec.ts   tests/e2e/flexible-teaching-updates.spec.ts   tests/e2e/report-cycle-workflow.spec.ts
```

- [ ] **Step 5: Inspect final diff for scope discipline**

Reject:
- unrelated refactors;
- mass renames of `weekly_*` database objects;
- new timetable subsystem;
- duplicate report engine;
- broad RLS grants not scoped by Class Subject;
- hard deletion of historical source data.

- [ ] **Step 6: Finish without a cleanup commit when green**

If every gate is green, do not create an empty cleanup commit.

If verification exposes a real defect, fix only that defect, stage the exact changed paths shown by `git diff --name-only`, rerun the complete gate, and create at most one coherent verification-fix commit:

```bash
git commit -m "fix: complete teaching report workflow verification"
```

---

## Execution order and stop gates

Implement Tasks 1 through 6 in order.

After each task:
1. run that task's focused tests;
2. commit one meaningful patch;
3. start the next task only if the focused gate is green.

Do **not** wait on or repeatedly poll remote CI during implementation. Local verification is the gate. When/if later pushed, stop and let the user report remote CI status.

The work is complete only after Task 6 full DB/app/build verification passes.
