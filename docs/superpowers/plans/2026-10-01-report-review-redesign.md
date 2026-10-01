# Report Review Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Class Report Cycle review editable, bilingual by available content, preview the exact parent email, preserve line breaks, and keep Performance off by default without redesigning the existing UI.

**Architecture:** Extend the existing report/template/repository paths instead of adding a new workflow. Reuse the Teacher editor structure and current Admin Class Report Cycle page, keep one V2 report per student, and use the same report/email renderers for preview and delivery.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres, next-intl, React Email, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-report-review-redesign-design.md`

## Global Constraints

- Keep the Class Report Cycle on the current workspace page; no wizard or new navigation.
- Reuse existing Teacher/Admin form, table, button, badge, spacing, and preview patterns.
- Keep source details and per-student full-report overrides collapsed by default.
- Do not broadly rewrite CSS or unrelated Admin/Teacher/guardian screens.
- Historical sent/finalized reports remain unchanged.
- `guardian.report_language` remains in the database but is ignored for new Class Report Cycle generation/delivery.
- GitHub Actions remain manual-only; do not trigger CI unless explicitly requested.

## Review Focus

- Arabic-only content/template must render and send without requiring fake English content.
- Changing included sources after Admin edits must not overwrite Admin report text.
- Previewed parent email must use the same renderer/data as actual delivery.
- One student with multiple receiving guardians must produce one report and deliver it to all active receiving guardians.
- Reopening is allowed only before protected delivery history exists.

---

### Task 1: Template defaults and language inputs

**Files:**
- Modify: `src/features/reports/report-template.types.ts`
- Modify: `src/features/reports/report-template.schemas.ts`
- Modify: `src/features/reports/report-template.actions.ts`
- Modify: `src/features/reports/report-template.repository.ts`
- Modify: `src/features/reports/report-template-form.tsx`
- Modify: `src/features/reports/report-email-template-editor.tsx`
- Modify: `src/features/guardians/guardian-form.tsx`
- Modify: `src/features/guardians/student-guardian-manager.tsx`
- Modify: `src/features/guardians/guardian-management-list.tsx`
- Modify: `src/features/students/student-form.tsx`
- Create: `supabase/migrations/20261001_report_template_bilingual_defaults.sql`
- Test: `tests/unit/report-template.test.ts`

**Interfaces:**
- Produces: template config where paired EN/AR required fields accept either language and `performanceEnabled` defaults to `false`.

- [ ] Write failing tests proving Performance defaults false and Arabic-only required template pairs validate.
- [ ] Run `pnpm test -- tests/unit/report-template.test.ts` and confirm failure.
- [ ] Update template types/schema/repository/forms and add the migration: paired required fields are symmetric, DB Performance default is false, current active template is set false, existing data preserved.
- [ ] Remove visible guardian report-language controls; preserve existing stored values on edits and use `both` only as the hidden compatibility value for newly created guardians.
- [ ] Re-run the targeted test and `pnpm typecheck`; expect PASS.
- [ ] Commit as `feat: align report template language defaults`.

### Task 2: Bilingual/newline renderer and email renderer

**Files:**
- Modify: `src/features/reports/report.renderer.ts`
- Modify: `src/features/reports/report.service.ts`
- Modify: `src/features/email/report-email.tsx`
- Modify: `src/features/reports/report-email-template-preview.ts`
- Test: `tests/unit/report-template-snapshot.test.ts`
- Test: `tests/unit/report-service.test.ts`
- Test: `tests/unit/email-template.test.tsx`

**Interfaces:**
- Produces: content-driven V2 rendering that emits only available languages as separate LTR/RTL blocks and preserves multiline text safely.
- Produces: `renderReportEmail()` / `renderReportEmailSubject()` as the single preview-and-send rendering path.

- [ ] Write failing tests for EN+AR, EN-only, AR-only, newline preservation, RTL/LTR direction, and no narrative `English / العربية` joining.
- [ ] Run the three targeted unit test files and confirm failure.
- [ ] Implement one escaped multiline helper and use it for report/email narrative fields; new content-driven Class Cycle V2 snapshots render by available content while historical snapshots retain their stored behavior.
- [ ] Update email subject/body/template preview to omit empty language blocks and use matching localized placeholders.
- [ ] Re-run targeted tests and `pnpm typecheck`; expect PASS.
- [ ] Commit as `fix: render bilingual reports by available content`.

### Task 3: One report per student, all receiving guardians

**Files:**
- Modify: `src/features/reports/report-batch.repository.ts`
- Modify: `src/features/email/email.repository.ts`
- Modify: `src/features/email/email.types.ts`
- Test: `tests/unit/report-service.test.ts`
- Test: `tests/unit/admin-report-delivery-action.test.ts`

**Interfaces:**
- Produces: new Class Report Cycle finalization with exactly one `language='both'` V2 report per student.
- Produces: delivery recipients = all active linked guardians with `receives_reports=true`, independent of `report_language`.

- [ ] Add failing regression tests/contracts for one report per student and recipient selection ignoring guardian language preference.
- [ ] Run those targeted tests and confirm failure.
- [ ] Change Class Cycle finalization to build one content-driven snapshot per student; change deliverable preparation to select every active receiving guardian.
- [ ] Re-run targeted tests and `pnpm typecheck`; expect PASS.
- [ ] Commit as `feat: simplify bilingual report delivery`.

### Task 4: Admin review/edit and exact preview on the existing page

**Files:**
- Modify: `src/features/reports/report-cycle-sources.tsx`
- Modify: `src/features/reports/report-batch.repository.ts`
- Modify: `src/features/reports/admin-report-workflow.actions.ts`
- Modify: `src/features/reports/admin-report-workspace.repository.ts`
- Modify: `src/features/reports/admin-report-workspace.model.ts`
- Modify: `src/features/reports/report-composer.tsx`
- Modify: `src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx`
- Modify: `src/features/reports/report-preview-frame.tsx` only if the existing frame needs a small extension
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Test: `tests/unit/admin-report-workspace.test.ts`
- Test: `tests/unit/admin-report-workflow-actions.test.ts`
- Test: `tests/unit/report-workflow-ux-contract.test.ts`

**Interfaces:**
- Produces: Admin can open each report context, edit shared EN/AR text, comments, optional performance, and collapsed per-student EN/AR progress overrides.
- Produces: selected-student Report + Parent Email previews on the same page, live before finalization and frozen after finalization.

- [ ] Write failing tests/contracts for `Open report`, Teacher-like shared/student fields, collapsed student full-report override, Performance hidden by default, and same-page Report/Parent Email preview.
- [ ] Run targeted tests and confirm failure.
- [ ] Extend the existing Class Cycle workspace data/actions so each approval context saves shared text plus per-student `progress_en/progress_ar` and comments; do not create a parallel editor architecture.
- [ ] Make submitted source details expandable; source include/exclude changes must not overwrite Admin text. Keep `Rebuild from selected sources` as a secondary confirmed action only.
- [ ] Render the editor in the current page using existing Teacher/Admin form and table styles; keep full student overrides collapsed and email preview read-only.
- [ ] Preserve current finalize/reopen/send safeguards and keep those controls beside the preview on the same workspace.
- [ ] Re-run targeted tests, `pnpm typecheck`, and `pnpm lint`; expect PASS.
- [ ] Commit as `feat: add class report review workspace`.

### Task 5: Focused regression verification

**Files:**
- Create or modify: `tests/e2e/admin-report-workflow.spec.ts`

**Interfaces:**
- Consumes all prior tasks; produces no new application API.

- [ ] Add one focused E2E path: open Class Report Cycle → inspect source → edit shared report → customize one student → preview parent email → finalize → verify frozen preview/send controls.
- [ ] Include EN+AR multiline content and verify Performance is absent by default.
- [ ] Run targeted E2E if the local environment is available; otherwise record that limitation and use unit/type/lint/build plus Vercel preview verification.
- [ ] Run final local verification: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [ ] Review the diff for unrelated UI/CSS churn and remove anything not needed for this feature.
- [ ] Commit as `test: verify report review flow`.
