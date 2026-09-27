# Weekend School Visual System Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Weekend School UI calmer, more professional, more compact, and easier to scan without redesigning pages or changing behavior.

**Architecture:** Refine the existing visual foundation rather than creating a second design system. Concentrate changes in `globals.css` and `design-system.css`, explicitly load the existing Arabic browser font from the locale layout, and use the Add Student Guardian selector as the record/metadata reference example.

**Tech Stack:** Next.js 16.3.5, React 19.2, TypeScript, CSS, next-intl, existing `@fontsource/noto-sans-arabic`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-visual-system-polish.md`

## Global Constraints

- No database or migration changes.
- No Supabase, RLS, authorization, route, or business-rule changes.
- No navigation redesign.
- No new UI framework.
- No page-by-page redesign.
- Preserve English, Arabic, RTL, responsive behavior, and accessibility.
- Keep current Guardian section order: Student identity → Guardian → Enrollment.
- Use focused local checks while iterating.
- Do not push until the complete visual batch is accepted locally.

## Review Focus

1. Arabic must actually render with Noto Sans Arabic in the browser, not merely list it as an unavailable fallback.
2. Radio/checkbox controls must never inherit full-width text-input styling.
3. Metadata must remain readable without competing visually with record names.
4. Narrow/mobile management layouts must remain usable after density reductions.
5. RTL layout must rely on logical properties rather than left/right overrides.

---

### Task 1: Typography and Density Foundation

**Files:**
- Create: `tests/unit/visual-system-polish-contract.test.ts`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/design-system.css`

**Produces:**
- explicit browser loading of existing Noto Sans Arabic;
- system UI font stack for English;
- RTL Arabic font stack;
- shared typography hierarchy;
- shared record-name and metadata styles;
- slightly more compact control and spacing tokens.

- [ ] Write a failing source-contract test that asserts:
  - locale layout imports `@fontsource/noto-sans-arabic/400.css`;
  - radio inputs are excluded from generic text-input sizing;
  - page-title, section-title, record-name, and record-meta styles exist;
  - RTL Arabic font styling exists.

- [ ] Run:
  `pnpm exec vitest run tests/unit/visual-system-polish-contract.test.ts`
  and confirm RED.

- [ ] Import `@fontsource/noto-sans-arabic/400.css` in the locale layout before application CSS.

- [ ] Refine global typography:
  - English: system UI sans stack;
  - Arabic/RTL: Noto Sans Arabic first;
  - body line-height around 1.5;
  - page title approximately 1.75rem;
  - section title approximately 1.125rem;
  - record name approximately 0.95–1rem with clear emphasis;
  - metadata approximately 0.8125–0.875rem and muted.

- [ ] Refine density:
  - standard controls around 2.5rem high;
  - compact controls around 2.125–2.25rem;
  - labels medium weight rather than heavy;
  - quieter borders and metadata.

- [ ] Run the focused visual-system test and confirm GREEN.

---

### Task 2: Shared Surface and Management-List Polish

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/design-system.css`
- Test: `tests/unit/design-system-foundation.test.tsx`
- Test: `tests/unit/visual-system-polish-contract.test.ts`

**Produces:**
- calmer PageHeader hierarchy;
- lighter cards/surfaces;
- denser tables and management rows;
- smaller quieter badges;
- less nested-border appearance.

- [ ] Extend the contract test first for:
  - restrained card padding/borders;
  - compact badge typography;
  - table row density;
  - clear PageHeader title/description hierarchy.

- [ ] Run the focused tests and confirm RED.

- [ ] Adjust existing CSS only where possible:
  - PageHeader title leads, description is muted;
  - table headers remain readable but quiet;
  - table rows use less unnecessary vertical space;
  - badges become smaller and less dominant;
  - cards retain borders only where grouping is useful;
  - form fieldsets use quieter grouping;
  - major sections keep more separation than individual rows.

- [ ] Do not change React component APIs unless CSS cannot achieve the result.

- [ ] Run:
  `pnpm exec vitest run tests/unit/design-system-foundation.test.tsx tests/unit/visual-system-polish-contract.test.ts`
  and confirm GREEN.

---

### Task 3: Guardian Record Hierarchy Reference

**Files:**
- Modify: `src/features/students/student-form.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/student-guardian-ux-contract.test.ts`

**Consumes:** the current uncommitted compact Guardian-radio work.

**Produces:** a reference record layout where Guardian name leads and email/status are secondary.

- [ ] Preserve the existing compact Guardian mode controls.

- [ ] Keep each existing Guardian choice structurally simple:
  - small radio;
  - primary Guardian name;
  - secondary email;
  - archived state only when relevant.

- [ ] Align Guardian typography with shared record-name/metadata rules rather than inventing another local visual system.

- [ ] Keep the selector compact and avoid padded `record-card` presentation.

- [ ] Run:
  `pnpm exec vitest run tests/unit/student-guardian-ux-contract.test.ts tests/unit/visual-system-polish-contract.test.ts`
  and confirm GREEN.

---

### Task 4: Final Local Gate

- [ ] Run:
  `pnpm lint`

- [ ] Run:
  `pnpm typecheck`

- [ ] Run the full local unit suite once.

- [ ] Run:
  `git diff --check`

- [ ] Inspect locally:
  - Dashboard;
  - Students;
  - Add Student / Guardian selector;
  - one Student detail;
  - Classes;
  - one Arabic/RTL page.

- [ ] Confirm no workflow, navigation, data, or business behavior changed.

- [ ] Commit the complete implementation as a meaningful visual-system batch.

- [ ] Do not push until local visual review is accepted.
