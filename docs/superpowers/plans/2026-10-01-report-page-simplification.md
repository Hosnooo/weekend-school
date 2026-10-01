# Report Page Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the active Class Report Cycle so Admin edits reports directly, enters per-subject attendance as `attended out of total`, reviews one exact parent email selected from a student dropdown, then finalizes and sends.

**Architecture:** Extend the existing Class Report Cycle review path only. Store optional attendance overrides on `report_student_overrides`, use one shared attendance resolver for both the editor and finalizer, keep the existing V2 snapshot shape for backward compatibility (`present = attended`, `sessions = total`, `absent = total - attended`), and keep the same report/email renderer for preview and delivery.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres, next-intl, React Email, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-report-review-redesign-design.md`

## Global Constraints

- Keep the current Report Cycle workspace; no wizard, new page, or broad CSS redesign.
- Normal Admin report fields are visible; only per-student full-report overrides stay collapsed.
- Active Class Report Cycle has one preview only: read-only Parent Email Review.
- Student email selection uses one dropdown, not one button per student.
- Attendance is editable per student + subject/context as `attended / total sessions`.
- Teacher attendance history is never rewritten by report edits.
- Historical sent/finalized reports are never rewritten.
- Existing DRAFT/REVIEW cycles must adopt the new attendance UI from their existing source data without requiring re-entry.
- Before applying production DDL, re-check report/delivery statuses; do not silently mutate protected finalized/sent data if production state has changed.
- GitHub Actions remain manual-only and `gh` CLI is not used.

## Review Focus

- Current live DRAFT cycles must show the same source-derived attendance that finalization would use.
- `attended > total`, partial pairs, negative values, or non-integers must be rejected.
- An explicit Admin attendance pair must override unresolved source attendance for report finalization without changing source records.
- Reopening a finalized-unsent cycle must return directly to the visible editor.
- Email Review must remain exactly the same render path used by delivery.

---

### Task 1: Add safe per-subject attendance overrides and one shared resolver

**Files:**
- Create: `supabase/migrations/20261001_report_attendance_overrides.sql`
- Create: `src/features/reports/report-attendance.ts`
- Modify: `src/features/reports/class-report-review.repository.ts`
- Modify: `src/features/reports/admin-report-workflow.actions.ts`
- Test: `tests/unit/report-attendance.test.ts`
- Test: `tests/unit/admin-report-workflow-actions.test.ts`

**Interfaces:**
- Produces nullable `attendance_attended` and `attendance_total` on `report_student_overrides`.
- Produces `resolveReportAttendance(...) -> {attended: number; total: number; unresolvedConflicts: number}` for included source observations/resolutions.
- Produces review students with effective `attendanceAttended` / `attendanceTotal`, source-derived when no override exists.
- `saveClassReportReviewContext()` accepts validated integer attendance values for each student.

- [ ] Add failing resolver tests for unique weeks, duplicate/conflicting observations, resolved conflicts, and valid explicit overrides.
- [ ] Add failing action/contracts for attendance pair parsing and persistence names.
- [ ] Run targeted tests and confirm RED.
- [ ] Add the two nullable integer columns with DB checks: both null or both non-null, each >= 0, and attended <= total. Do not backfill or rewrite report rows.
- [ ] Implement the pure shared resolver so source-derived attendance is calculated once and reused by review/finalization.
- [ ] Extend review loading to use the shared resolver and stored override values when present.
- [ ] Parse attendance with Zod in `classReviewPayloadFrom`; reject partial/negative/non-integer/attended-greater-than-total pairs.
- [ ] Persist only report override values; never update `weekly_submission_students` or attendance resolutions.
- [ ] Re-run targeted tests and typecheck; expect PASS.
- [ ] Commit as `feat: add report attendance overrides`.

### Task 2: Simplify the Admin editor and Email Review

**Files:**
- Modify: `src/features/reports/class-report-cycle-review.tsx`
- Modify: `src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx` only if query handling/copy needs a small change
- Test: `tests/unit/report-workflow-ux-contract.test.ts`

**Interfaces:**
- Consumes Task 1 effective attendance values.
- Produces a fully visible Teacher-style Admin editor and one read-only Parent Email Review selected by `?student=<id>`.

- [ ] Update the UX contract test to require visible report cards, attendance inputs, one student `<select>`, no row of student preview buttons, and no standalone Student Report preview.
- [ ] Run the targeted test and confirm RED.
- [ ] Replace each outer `Open report` `<details>` with a normal visible report card/form; keep only `Customize report text` collapsed.
- [ ] Add `Attended [number] out of [number] sessions` inputs to each student row using Task 1 values.
- [ ] Replace student preview links with one compact GET dropdown/form that selects the student email.
- [ ] Remove the standalone `renderStudentReportV2` preview from the active Class Report Cycle; keep `renderReportEmail`, recipients, subject, and `ReportPreviewFrame` as read-only Email Review.
- [ ] Rename the finalized action to `Reopen & edit`; after reopen the same visible editor renders immediately.
- [ ] Re-run targeted tests and typecheck; expect PASS.
- [ ] Commit as `refactor: simplify report review workspace`.

### Task 3: Freeze approved attendance into the exact email and roll out live drafts safely

**Files:**
- Modify: `src/features/reports/class-report-finalization.repository.ts`
- Modify: `src/features/reports/report.renderer.ts`
- Test: `tests/unit/report-service.test.ts`
- Test: `tests/unit/report-template-snapshot.test.ts`
- Test: `tests/unit/admin-report-delivery-action.test.ts`

**Interfaces:**
- Consumes Task 1 attendance resolver and override columns.
- Produces V2 sections where effective attendance remains backward-compatible internally as `{present: attended, absent: total - attended, sessions: total}`.
- Parent-facing V2 rendering shows only `Attendance: X of Y sessions` (with bilingual label behavior preserved).

- [ ] Add failing tests for source fallback, explicit override precedence, conflict bypass when an explicit valid aggregate is supplied, and `X of Y sessions` rendering without Present/Absent/Sessions chips.
- [ ] Run targeted tests and confirm RED.
- [ ] Replace the finalizer's duplicated week/conflict counting with the shared Task 1 resolver.
- [ ] Use explicit attendance when present; otherwise use the exact same source-derived result shown in the editor.
- [ ] If a valid explicit pair exists, do not block that student/subject solely because underlying source statuses conflict; keep source records unchanged.
- [ ] Render V2 attendance as one approved metric (`X of Y sessions`) while leaving historical V1 rendering unchanged.
- [ ] Before production migration, re-query batch/report/delivery statuses. Current observed production state is one CLASS DRAFT batch, two DRAFT V2 report rows, and no deliveries; if protected delivery appears, preserve it and do not rewrite snapshots.
- [ ] Apply the additive migration only. Do not modify existing report rows. Verify the current DRAFT cycle immediately shows source-derived attendance in the editor; its live email preview should also use the new effective attendance before finalization.
- [ ] Finalize only through the normal application path so the current draft's immutable snapshot freezes the reviewed attendance. Do not perform a direct snapshot backfill.
- [ ] Run available unit/type/lint/build verification plus Vercel preview; do not run GitHub Actions.
- [ ] Review diff for unrelated UI/CSS churn and remove any.
- [ ] Commit as `feat: finalize approved report attendance`.
