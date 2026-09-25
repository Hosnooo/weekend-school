# Weekend School Full Website UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Weekend School interface around one coherent bilingual design and interaction system while preserving the established Administrator/Teacher business architecture, making every shipped capability discoverable, usable, responsive, and visually verified.

**Architecture:** Keep the existing Next.js modular monolith and domain/repository boundaries. Add a small internal UI system under `src/components/ui/`, keep feature-specific composition inside `src/features/`, and migrate route surfaces incrementally to shared page/list/detail/form patterns. Introduce only the minimal accessible headless interaction primitives required for menus, dialogs, sheets, tabs, and transient feedback; do not import a dashboard template or generic CRUD framework.

**Tech Stack:** Next.js 16.3.5, React 19.2.0, TypeScript 5.9.3 strict mode, Tailwind CSS 4.1.13, next-intl 4.13.7, Noto Sans Arabic 5.3.0, Supabase/PostgreSQL/RLS, Vitest + Testing Library, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-09-24-full-website-ux-redesign.md`

## Global Constraints

- Work only on `codex/full-website-ux-redesign`; do not create per-page branches.
- Do not deploy incomplete redesign work to production.
- Preserve Profiles as authentication/audit identities and Administrators/Teachers as independent business records linked by `administrator_accounts` / `teacher_accounts`.
- Preserve `Class → Subject → optional Subject Group`, effective-dated enrollment, weekly-history attribution, immutable finalized reports, archive/restore lifecycle, school scoping, server authorization, and PostgreSQL RLS.
- Do not alter applied migrations; any genuinely required schema change must be a forward-only migration.
- Do not create migrations for visual-only changes.
- All visible application copy belongs in `messages/en.json` and `messages/ar.json`; do not hardcode parallel English/Arabic labels inside feature components.
- English uses LTR; Arabic uses RTL with logical CSS properties and direction-aware icons.
- Teacher workflows must remain usable at approximately 360px.
- Do not import a full component framework or dashboard template. Add only interaction dependencies actually required by the implemented primitives.
- Keep page/layout components thin; business rules stay in feature services, repositories, schemas, and actions.
- Use TDD for business rules, authorization helpers, validation, and regressions: observe the relevant failure before production behavior is changed.
- During iteration, run targeted checks only; full lint/typecheck/unit/build/DB/E2E is mandatory at the final release gate.
- Visual inspection is part of verification. Passing tests alone is not sufficient evidence of UX quality.

## Review Focus

1. **Dual-capability login:** an active Administrator + Teacher login must see both navigation surfaces without role switching, while Teacher-only users must never see Administrator complexity. Pin this in the application-shell task with component/browser coverage in both `en` and `ar`.
2. **RTL layered UI:** menus, dialogs/sheets, breadcrumbs, tabs, and row actions must position and navigate correctly under `dir="rtl"`. Pin this in the design-system/reference task and repeat a browser smoke in the final visual gate.
3. **Assignment mutation conflicts:** invalid ranges, overlapping assignments, protected submitted history, missing records/authorization, and unexpected persistence failures must remain distinguishable and must not collapse to `protected-history`. Pin this in the Teaching Assignments domain/action tests and targeted browser flow.
4. **Narrow list management:** management lists must remain usable near 360px without disappearing actions or forcing the user to interpret a compressed desktop table. Pin this in the shared DataTable/list-pattern task and at least one People page Playwright check.
5. **Blocked destructive actions:** Archive/Restore/Permanent Delete/Delete Assignment must remain discoverable when blocked and explain the exact dependency/history reason instead of silently disappearing. Pin this in the lifecycle/archives task and assignment workflow tests.

---

## Planned File Structure

### Shared UI foundation

**Create**
- `src/components/ui/alert.tsx` — semantic information/warning/error surfaces.
- `src/components/ui/breadcrumbs.tsx` — locale-aware nested navigation.
- `src/components/ui/card.tsx` — restrained reusable content container.
- `src/components/ui/confirmation-dialog.tsx` — destructive/consequential confirmation composition.
- `src/components/ui/data-table.tsx` — lightweight management-list shell with desktop rows and intentional narrow fallback.
- `src/components/ui/date-field.tsx` — standard date field composition.
- `src/components/ui/dialog.tsx` — accessible dialog wrapper around the chosen minimal headless primitive.
- `src/components/ui/dropdown-menu.tsx` — accessible overflow menu wrapper.
- `src/components/ui/empty-state.tsx` — concise no-data/no-work state.
- `src/components/ui/icon-button.tsx` — accessible compact button.
- `src/components/ui/input.tsx` — shared input control.
- `src/components/ui/page-header.tsx` — page title/description/action composition.
- `src/components/ui/search-input.tsx` — management-list search field.
- `src/components/ui/section-header.tsx` — section heading/action composition.
- `src/components/ui/sheet.tsx` — narrow/mobile drawer composition.
- `src/components/ui/tabs.tsx` — workspace tabs.
- `src/components/ui/toast.tsx` — transient success notification composition if no existing suitable feedback primitive can satisfy the use case.
- `src/components/ui/ui-reference.tsx` — internal component demonstration used by the reference route.
- `src/app/[locale]/(protected)/ui-reference/page.tsx` — non-navigation internal visual reference route, Administrator-only.
- focused component tests under `src/components/ui/*.test.tsx` for behavior with interaction or responsive state.

**Modify**
- `src/components/ui/button.tsx` — add complete variant/size contract while preserving existing call sites during migration.
- `src/components/ui/form-field.tsx` — standard label/hint/error composition.
- `src/components/ui/select-field.tsx` / `src/components/ui/text-input.tsx` — migrate or delegate to shared primitives without breaking callers.
- `src/components/ui/status-badge.tsx` — align with common `Badge` semantics or replace with a compatible `Badge` export.
- `src/components/ui/admin-page.tsx` — either reduce to compatibility wrapper around `PageHeader`/page layout or retire after all call sites migrate.
- `src/app/globals.css` — replace page-specific styling as the primary design mechanism with tokens/base utilities and shared component classes only where Tailwind composition is insufficient.
- `package.json` / `pnpm-lock.yaml` — add only the minimal accessible headless packages selected for Dialog/Menu/Sheet/Tabs/Tooltip behavior.
- `messages/en.json`, `messages/ar.json` — shared component, status, action, error, and navigation copy.

### Application shell

**Modify/Create as discovered in current shell structure**
- `src/app/[locale]/(protected)/layout.tsx` — capability-aware shell entry.
- `src/app/[locale]/(protected)/protected-layout.module.css` — remove legacy shell-only layout rules that conflict with shared shell primitives.
- current navigation/shell components under `src/components/` or `src/features/` discovered from the protected layout — replace with grouped navigation data and responsive sidebar/drawer composition.
- `messages/en.json`, `messages/ar.json` — Overview/People/School/Reports/Data/Settings/My Teaching labels.
- relevant navigation tests and existing E2E coverage for Administrator-only, Teacher-only, and dual-capability accounts.

### Teaching Assignments

**Modify**
- `src/features/teaching-assignments/teaching-assignment-workspace.tsx` — replace permanently open forms with page header action, Tabs, row display, explicit edit state, overflow actions, and Add dialog/sheet.
- `src/features/teaching-assignments/teaching-assignment.actions.ts` — typed mutation outcomes; add delete action.
- `src/features/teaching-assignments/teaching-assignment.service.ts` — mutation-error classification helpers and deletion/history business rules as needed.
- `src/features/teaching-assignments/teaching-assignment.repository.ts` — school-scoped delete plus precise persistence result/error mapping.
- `src/features/teaching-assignments/teaching-assignment.schemas.ts` — include optional end date for creation/edit paths where the current schema does not already support it.
- `src/features/teaching-assignments/teaching-assignment.types.ts` — typed UI/domain mutation outcome contract.
- `src/app/[locale]/(protected)/(admin)/teachers/[id]/assignments/page.tsx` and/or canonical assignment pages discovered in the current route tree — use new page composition and surface translated errors.
- `messages/en.json`, `messages/ar.json` — Current/Upcoming/Past, edit/end/delete, confirmation, and precise error copy.
- existing Teaching Assignment unit tests, DB/RLS tests, and Playwright specs — extend rather than duplicate.

### People surfaces

**Modify**
- Administrator routes under `src/app/[locale]/(protected)/(admin)/students/**`, `guardians/**`, `teachers/**`, `administrators/**`.
- feature components under `src/features/students/`, `src/features/guardians/`, `src/features/teachers/`, and `src/features/administrators/` that currently own list/forms/lifecycle/access/enrollment composition.
- relevant feature tests and targeted People E2E coverage.
- `messages/en.json`, `messages/ar.json`.

### School structure

**Modify**
- `src/app/[locale]/(protected)/(admin)/classes/**`.
- legacy `groups/**` routes to canonical redirects or compatibility surfaces.
- feature components/services under class/subject/group features discovered during implementation.
- Teaching Assignment links/coverage summaries from class detail.
- relevant tests and translations.

### Teacher surfaces

**Modify**
- `src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx`.
- `src/app/[locale]/(protected)/(teacher)/my-teaching/update/page.tsx`.
- `src/app/[locale]/(protected)/(teacher)/history/page.tsx`.
- `src/app/[locale]/(protected)/(teacher)/history/[id]/page.tsx`.
- `src/app/[locale]/(protected)/(teacher)/profile/page.tsx`.
- legacy `my-groups/page.tsx` → canonical redirect.
- weekly-update feature components and tests discovered from these routes.
- translations and targeted 360px Playwright coverage.

### Reports/Data/Settings

**Modify/Create**
- `src/app/[locale]/(protected)/(admin)/reports/page.tsx` and report detail routes — staged Prepare → Review → Finalize → Send presentation.
- create or expose a canonical Delivery Status route using existing delivery data/components rather than duplicating delivery logic.
- `src/app/[locale]/(protected)/(admin)/exports/page.tsx` — first-class Data page using shared controls.
- `src/app/[locale]/(protected)/(admin)/archives/page.tsx` — standard lifecycle/deletion-impact interaction.
- `src/app/[locale]/(protected)/(admin)/settings/page.tsx` — school settings only.
- legacy `settings/administrators` and `settings/archives` routes → canonical redirects.
- associated feature components/tests/translations.

### Verification/docs

**Create/Modify**
- `docs/PROGRESS.md` — record only observed milestone verification.
- relevant existing Playwright specs under `tests/e2e/` — targeted during milestones, full run before release.
- relevant pgTAP tests under `supabase/tests/` only if assignment deletion or other backend behavior changes need DB/RLS coverage.
- screenshot/visual-verification artifacts or an existing approved documentation location if the repository already tracks them; do not commit large browser artifacts unless project conventions support it.

---

### Task 1: Establish the Design-System Foundation and Visual Reference

**Files:**
- Create the shared primitives listed under **Shared UI foundation** above.
- Create: `src/app/[locale]/(protected)/ui-reference/page.tsx`.
- Modify: `src/components/ui/button.tsx`.
- Modify: `src/components/ui/form-field.tsx`.
- Modify: `src/components/ui/select-field.tsx`.
- Modify: `src/components/ui/text-input.tsx`.
- Modify: `src/components/ui/status-badge.tsx`.
- Modify: `src/app/globals.css`.
- Modify: `messages/en.json`.
- Modify: `messages/ar.json`.
- Modify: `package.json`, `pnpm-lock.yaml` only for the minimal interaction primitives actually selected.
- Test: co-located UI component tests for dialog/menu/tabs/sheet/table behavior.

**Interfaces:**
- Consumes: existing locale routing, existing `Button`, form controls, `next-intl`, Tailwind tokens, Noto Sans Arabic.
- Produces: stable shared exports for `PageHeader`, `SectionHeader`, `Button`, `IconButton`, `Input`, `DateField`, `Select`, `SearchInput`, `Badge`, `Alert`, `EmptyState`, `DataTable`, `DropdownMenu`, `Dialog`, `Sheet`, `Tabs`, `ConfirmationDialog`, `Breadcrumbs`, and optional `Toast`.

- [ ] **Step 1: Inspect existing `src/components/ui`, `globals.css`, protected layout, Next.js local docs, and current dependency graph before choosing headless packages.**

  Read the relevant Next.js 16 documentation from `node_modules/next/dist/docs/` before writing client/server component boundaries. Select only the primitives required to provide accessible focus management, menus, overlays, and tabs. Do not install a full shadcn catalog.

- [ ] **Step 2: Write failing component tests for the behavioral primitives.**

  Cover at minimum:

  ```tsx
  it('opens and closes the dialog and restores focus to its trigger', async () => {
    // render Dialog with a trigger and cancel action
    // open it, assert dialog role, close it, assert trigger regains focus
  });

  it('supports keyboard activation of an overflow menu', async () => {
    // focus menu trigger, press Enter, assert menu items are reachable
  });

  it('switches tabs without rendering all panels simultaneously', async () => {
    // assert only active tabpanel is shown
  });

  it('preserves actions in the narrow DataTable fallback', () => {
    // render narrow/mobile representation and assert row action control remains present
  });

  it('renders RTL-safe breadcrumb ordering without hardcoded left/right classes', () => {
    // render inside dir="rtl" and assert semantic sequence + direction-aware separator
  });
  ```

- [ ] **Step 3: Run only the new UI tests and confirm RED.**

  Run the targeted Vitest files directly, for example:

  ```bash
  pnpm vitest run src/components/ui/dialog.test.tsx src/components/ui/dropdown-menu.test.tsx src/components/ui/tabs.test.tsx src/components/ui/data-table.test.tsx
  ```

  Expected: failures because the new primitives/behavior do not yet exist.

- [ ] **Step 4: Implement the minimal shared primitives and token system.**

  Requirements:

  - preserve existing `Button` call sites during migration;
  - move global colors/spacing/typography toward semantic tokens;
  - use logical CSS properties;
  - ensure all icon-only buttons require an accessible label;
  - keep `DataTable` lightweight and composition-based rather than a generic grid engine;
  - ensure overlay components manage focus correctly;
  - expose destructive variants distinctly from primary/secondary actions.

- [ ] **Step 5: Build the internal `ui-reference` route.**

  The page must render the same component set in the active locale and include examples of:

  - page/section headers;
  - Buttons and IconButton;
  - Input/Select/DateField/SearchInput;
  - active/warning/error statuses;
  - Alert and EmptyState;
  - DataTable with overflow menu;
  - Dialog and Sheet;
  - Tabs;
  - ConfirmationDialog;
  - Breadcrumbs.

  The route must not appear in normal navigation and must require Administrator capability through the existing protected/admin authorization pattern.

- [ ] **Step 6: Move all reference-page copy to translations and verify EN/AR parity.**

  Add stable semantic keys to both `messages/en.json` and `messages/ar.json`. Do not embed parallel locale literals in the reference components.

- [ ] **Step 7: Run targeted tests plus lint/typecheck for the changed surface.**

  ```bash
  pnpm test -- --run <targeted UI test paths if supported by current Vitest config>
  pnpm lint
  pnpm typecheck
  ```

  If the repository wrapper does not forward targeted arguments, call the local Vitest CLI directly with the project config rather than running every DB/E2E gate.

- [ ] **Step 8: Visually inspect the reference page in four states.**

  Use a local/Preview environment with representative auth and inspect/screenshoot:

  - English desktop;
  - Arabic desktop;
  - English ~360px;
  - Arabic ~360px.

  Specifically check RTL overlay placement, tab order, menu alignment, focus rings, clipping, and minimum hit targets.

- [ ] **Step 9: Commit the foundation.**

  ```bash
  git add package.json pnpm-lock.yaml src/components/ui src/app/globals.css 'src/app/[locale]/(protected)/ui-reference/page.tsx' messages/en.json messages/ar.json
  git commit -m "feat: establish website UI system"
  ```

---

### Task 2: Replace the Application Shell and Navigation

**Files:**
- Modify: `src/app/[locale]/(protected)/layout.tsx`.
- Modify: `src/app/[locale]/(protected)/protected-layout.module.css` or retire it if the shared shell makes it unnecessary.
- Modify/create the current shell/navigation components discovered from the protected layout.
- Modify: `messages/en.json`, `messages/ar.json`.
- Test: navigation/shell component tests and targeted browser specs.

**Interfaces:**
- Consumes: Task 1 `Sheet`, `IconButton`, shared Button/typography/tokens; existing explicit capability resolution from authenticated Profile.
- Produces: `AppShell` and grouped navigation contract used by all later route migrations.

- [ ] **Step 1: Write failing tests for Administrator-only, Teacher-only, and dual-capability navigation.**

  Pin the following behaviors:

  ```tsx
  expect(adminNav).toContain('Dashboard');
  expect(adminNav).toContain('Administrators');
  expect(adminNav).toContain('Export');
  expect(adminNav).not.toContain('This Week');

  expect(teacherNav).toContain('This Week');
  expect(teacherNav).toContain('History');
  expect(teacherNav).not.toContain('Students');

  expect(dualNav).toContain('Dashboard');
  expect(dualNav).toContain('This Week');
  ```

  Add equivalent Arabic assertions using translation keys or rendered labels.

- [ ] **Step 2: Run the shell tests and confirm RED.**

- [ ] **Step 3: Implement grouped navigation data and `AppShell`.**

  Exact Administrator groups:

  - Overview → Dashboard
  - People → Students, Guardians, Teachers, Administrators
  - School → Classes, Teaching Assignments
  - Reports → Reports, Delivery status
  - Data → Export, Archives
  - Settings → School settings

  Teacher capability adds:

  - My Teaching → This Week, History, My Profile

  Teacher-only receives only My Teaching.

- [ ] **Step 4: Implement responsive behavior.**

  Desktop: persistent sidebar.

  Narrow: sidebar content moves into `Sheet`; no destination disappears. Language/account/sign-out controls remain reachable.

- [ ] **Step 5: Add a targeted Playwright navigation smoke.**

  Verify at least:

  - Administrator discovers Administrators, Export, Archives without going through Settings;
  - Teacher-only does not see Administrator navigation;
  - dual-capability sees both sections;
  - Arabic shell keeps the same hierarchy under RTL;
  - mobile menu exposes the same destinations.

- [ ] **Step 6: Run targeted component/browser checks and visually inspect the shell.**

- [ ] **Step 7: Commit.**

  ```bash
  git add 'src/app/[locale]/(protected)' src/components messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: redesign application navigation shell"
  ```

---

### Task 3: Rebuild Teaching Assignment Domain Mutations and Error Classification

**Files:**
- Modify: `src/features/teaching-assignments/teaching-assignment.actions.ts`.
- Modify: `src/features/teaching-assignments/teaching-assignment.service.ts`.
- Modify: `src/features/teaching-assignments/teaching-assignment.repository.ts`.
- Modify: `src/features/teaching-assignments/teaching-assignment.schemas.ts`.
- Modify: `src/features/teaching-assignments/teaching-assignment.types.ts`.
- Test: existing Teaching Assignment unit tests.
- Test: relevant `supabase/tests/*` assignment/RLS tests.

**Interfaces:**
- Consumes: existing assignment classifications and DB overlap constraint.
- Produces: typed mutation results consumed by Task 4, including a stable error code union and an Administrator-only delete operation.

- [ ] **Step 1: Define the mutation result contract in tests first.**

  Use a stable outcome such as:

  ```ts
  export type TeachingAssignmentMutationCode =
    | 'INVALID_DATE_RANGE'
    | 'ASSIGNMENT_OVERLAP'
    | 'PROTECTED_HISTORY'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'UNEXPECTED';

  export type TeachingAssignmentMutationResult =
    | {ok: true}
    | {ok: false; code: TeachingAssignmentMutationCode};
  ```

  If current server-action conventions require field errors in `ActionState`, preserve that structure but include an equivalent typed code rather than query-string collapsing.

- [ ] **Step 2: Write failing service/action tests for every required failure class.**

  Cover:

  - end before start → `INVALID_DATE_RANGE`;
  - DB exclusion/overlap → `ASSIGNMENT_OVERLAP`;
  - protected submitted weekly dependency → `PROTECTED_HISTORY`;
  - missing same-school target → `NOT_FOUND`;
  - authorization remains handled by `requireAdministrator` and is never mapped to protected history;
  - unknown repository failure → `UNEXPECTED`.

- [ ] **Step 3: Write failing repository/service tests for deletion.**

  Required cases:

  - unused assignment with no protected history deletes successfully;
  - assignment with protected submitted work does not delete;
  - assignment from another school cannot be deleted;
  - missing assignment reports not found rather than success;
  - overlapping records remain a creation/update concern, not a deletion blocker unless protected history exists.

- [ ] **Step 4: Run only assignment unit tests and confirm RED.**

- [ ] **Step 5: Implement minimal typed classification and delete behavior.**

  Reuse existing service/repository boundaries. Do not introduce a generic error framework. Detect database overlap using the actual Supabase/PostgreSQL error shape or repository result that corresponds to the exclusion constraint; do not infer overlap from user-facing text.

- [ ] **Step 6: Add/extend real PostgreSQL/RLS coverage if deletion changes persistence behavior.**

  The database test must prove same-school Administrator access and cross-school denial. Do not weaken RLS or use service-role access for the normal action.

- [ ] **Step 7: Run targeted assignment unit + DB tests.**

  ```bash
  pnpm test -- <assignment unit targets>
  supabase test db <targeted assignment test if CLI supports file targeting>
  ```

  If pgTAP targeting is not supported by the project command, run the smallest existing DB suite that covers Teaching Assignments rather than the browser suite.

- [ ] **Step 8: Commit.**

  ```bash
  git add src/features/teaching-assignments supabase/tests
  git commit -m "fix: make teaching assignment mutations precise"
  ```

---

### Task 4: Rebuild the Teaching Assignments Workspace as the Reference CRUD Flow

**Files:**
- Modify: `src/features/teaching-assignments/teaching-assignment-workspace.tsx`.
- Modify: canonical Administrator assignment route(s) under `src/app/[locale]/(protected)/(admin)/teachers/**/assignments` and `teaching-assignments/**` as discovered.
- Modify: `messages/en.json`, `messages/ar.json`.
- Test: component tests for workspace behavior.
- Test: targeted Teaching Assignment Playwright spec.

**Interfaces:**
- Consumes: Task 1 `PageHeader`, `Tabs`, `DropdownMenu`, `Dialog`/`Sheet`, `ConfirmationDialog`, form controls, Badge, Alert, EmptyState; Task 3 typed mutation results and delete action.
- Produces: canonical list/detail/edit/overflow/destructive interaction pattern reused conceptually by later People/School tasks.

- [ ] **Step 1: Write failing workspace tests.**

  Cover:

  ```tsx
  it('shows only the active Current tab panel initially', ...);
  it('does not render date inputs until Edit dates is chosen', ...);
  it('opens Add assignment in a focused dialog/sheet', ...);
  it('offers Edit dates, End assignment, and Delete assignment in the row menu', ...);
  it('cancels edit without mutating the rendered dates', ...);
  it('renders overlap and protected-history errors with different translated messages', ...);
  it('keeps Delete visible but blocked/explained when protected history exists', ...);
  ```

- [ ] **Step 2: Run targeted workspace tests and confirm RED.**

- [ ] **Step 3: Replace the permanently open Add form with a focused creation flow.**

  Required fields: Class → Subject → Group/Whole subject → Start date → optional End date.

  Preserve cascading selection and DB final guard.

- [ ] **Step 4: Replace three expanded sections with `Tabs`.**

  Default to Current. Each assignment row shows teaching context, scope, date range, status Badge, and one overflow menu.

- [ ] **Step 5: Implement explicit local Edit dates state.**

  Only the selected record reveals Start/End inputs plus Cancel/Save. Avoid showing unrelated row actions while editing.

- [ ] **Step 6: Implement End and Delete confirmation flows using Task 3 results.**

  Successful unused deletion removes the mistaken record after revalidation. Protected-history deletion displays the exact blocker without forcing date manipulation.

- [ ] **Step 7: Move all workspace copy to translation files.**

  Remove the current hardcoded locale object from the component.

- [ ] **Step 8: Run targeted unit/component/DB/browser checks.**

  Browser flow must include:

  - create assignment;
  - detect overlap distinctly;
  - edit dates;
  - delete an unused assignment;
  - confirm protected-history block on a fixture with submitted work;
  - repeat main navigation/interaction in Arabic RTL.

- [ ] **Step 9: Visually inspect desktop/narrow EN/AR.**

  Verify menu/dialog placement, no floating `record-card` presentation, no permanently exposed date controls, and no hidden destructive behavior.

- [ ] **Step 10: Commit.**

  ```bash
  git add src/features/teaching-assignments 'src/app/[locale]/(protected)/(admin)' messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: redesign teaching assignment workflow"
  ```

---

### Task 5: Standardize Teachers and Teacher Access Around the Reference Patterns

**Files:**
- Modify: Teacher list/detail/edit/access routes under `src/app/[locale]/(protected)/(admin)/teachers/**`.
- Modify: relevant `src/features/teachers/**` components/actions.
- Modify: `messages/en.json`, `messages/ar.json`.
- Test: Teacher component/unit tests and targeted browser flow.

**Interfaces:**
- Consumes: Task 1 shared list/detail/menu/form components; Task 4 canonical Teaching Assignments route/pattern.
- Produces: clear separation of Teacher record, optional login access, and assignment summary.

- [ ] **Step 1: Write failing list/detail tests for the three independent Teacher concepts.**

  Assert that the Teacher list exposes columns/fields for Teacher, Status, Login, Teaching coverage, and one overflow action control—not multiple inline buttons.

- [ ] **Step 2: Run targeted Teacher tests and confirm RED.**

- [ ] **Step 3: Rebuild Teacher list with shared management-list pattern.**

  Primary action: `Add teacher`.

  Overflow actions should route to View/Edit, Manage login access, Teaching assignments, and lifecycle action where permitted.

- [ ] **Step 4: Rebuild Teacher detail as read-only sections by default.**

  Sections: identity/contact, login access, teaching summary, lifecycle. `Edit` must not mutate login access or assignments.

- [ ] **Step 5: Standardize Teacher access management.**

  Make linked/unlinked login state explicit. Keep resend/recovery/access operations inside the access section or overflow workflow; do not conflate access with Teacher identity.

- [ ] **Step 6: Add targeted browser coverage.**

  Verify an Administrator can find a Teacher without login, manage access, navigate to assignments, and return without role/record confusion.

- [ ] **Step 7: Visual check EN/AR desktop/narrow and commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/teachers' src/features/teachers messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: clarify teacher record and access workflows"
  ```

---

### Task 6: Standardize Administrators as a First-Class People Surface

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/administrators/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(admin)/administrators/[id]/edit/page.tsx` and related detail components/routes.
- Modify: administrator feature components/actions.
- Modify: `messages/en.json`, `messages/ar.json`.
- Test: Administrator unit/component/browser tests.

**Interfaces:**
- Consumes: shared list/detail/menu/confirmation patterns.
- Produces: canonical Administrator management independent of Teacher capability.

- [ ] **Step 1: Write failing tests pinning first-class discoverability and last-active-Administrator safety.**

- [ ] **Step 2: Confirm RED.**

- [ ] **Step 3: Rebuild Administrator list/detail using shared patterns.**

  Clearly separate business record, login/access, active state, and overflow actions.

- [ ] **Step 4: Ensure edit/access/lifecycle operations cannot mutate Teacher capability as a side effect.**

  This should rely on existing domain rules; add regression tests only where the UI/action wiring could violate them.

- [ ] **Step 5: Preserve and clearly explain last-active-Administrator blocking.**

  Keep the action discoverable where appropriate and show the reason it cannot proceed.

- [ ] **Step 6: Run targeted tests/visual checks and commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/administrators' src/features/administrators messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: redesign administrator management"
  ```

---

### Task 7: Standardize Students, Enrollment, and Guardians

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/students/**`.
- Modify: `src/app/[locale]/(protected)/(admin)/guardians/**`.
- Modify: `src/features/students/student-enrollment-editor.tsx` and related Student/Guardian feature components.
- Modify: lifecycle components/actions for Students/Guardians.
- Modify: `messages/en.json`, `messages/ar.json`.
- Test: focused Student/Guardian/enrollment unit/component/browser tests.

**Interfaces:**
- Consumes: shared list/detail/form/menu/confirmation patterns and existing effective-dated enrollment domain rules.
- Produces: clear Student identity/enrollment/guardian/lifecycle separation and independent Guardian management.

- [ ] **Step 1: Write failing tests proving `Edit student` and `Manage enrollment` are distinct workflows.**

  `Edit student` changes identity/contact fields only. `Manage enrollment` exposes Class/Subject/Group effective-dated controls.

- [ ] **Step 2: Write failing narrow-list test for Students/Guardians.**

  At approximately 360px the record identity, state, and overflow action must remain reachable without depending on a compressed desktop table.

- [ ] **Step 3: Confirm RED.**

- [ ] **Step 4: Rebuild Student list/detail.**

  Detail sections: Identity, Enrollment, Guardians, Lifecycle. Use read-only state by default and explicit edit/manage actions.

- [ ] **Step 5: Recompose enrollment management around existing domain rules.**

  Show current Class, Subject participation, optional Group placement, and effective/history context required to understand a transfer. Do not move enrollment business rules into React.

- [ ] **Step 6: Rebuild Guardians list/detail using the same management language.**

  Expose contact info, linked Students, preferred language where applicable, lifecycle, and overflow actions.

- [ ] **Step 7: Run targeted Student/Guardian browser workflows in desktop/narrow EN/AR.**

- [ ] **Step 8: Commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/students' 'src/app/[locale]/(protected)/(admin)/guardians' src/features/students src/features/guardians messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: redesign student enrollment and guardian workflows"
  ```

---

### Task 8: Redesign Classes, Subjects, and Groups as One School-Structure Workflow

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/classes/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(admin)/classes/[classId]/page.tsx`.
- Modify: class creation/edit components and subject/group feature components discovered from these routes.
- Modify: legacy `src/app/[locale]/(protected)/(admin)/groups/**` routes to redirects/canonical compatibility behavior.
- Modify: translations and relevant tests.

**Interfaces:**
- Consumes: shared list/detail/menu/dialog/confirmation patterns; existing Class → Subject → optional Group repositories/services; canonical Teaching Assignment route from Task 4.
- Produces: one understandable Class-centered structure-management surface.

- [ ] **Step 1: Write failing tests for the Class-centered hierarchy.**

  Assert a Class detail can show Subject rows, Group counts/names where present, and teacher coverage/link to Teaching Assignments without permanently open create/edit forms.

- [ ] **Step 2: Confirm RED.**

- [ ] **Step 3: Rebuild Classes list with one primary `Create class` action.**

- [ ] **Step 4: Rebuild Class detail around Subjects and optional Groups.**

  Subject-level overflow actions own edit/archive operations. Focused add/edit dialogs may be used for short Subject/Group relationships.

- [ ] **Step 5: Surface teaching coverage and direct assignment-management navigation.**

- [ ] **Step 6: Convert legacy Groups routes to canonical redirects where safe.**

  The redirect target must preserve locale and land on the relevant canonical School surface. Do not leave duplicate editable workflows alive.

- [ ] **Step 7: Run targeted structure tests and visual checks EN/AR, desktop/narrow.**

- [ ] **Step 8: Commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/classes' 'src/app/[locale]/(protected)/(admin)/groups' src/features messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: unify class subject and group management"
  ```

---

### Task 9: Rebuild the Administrator Dashboard Around Actionable Attention

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/dashboard/page.tsx`.
- Modify/create dashboard feature query/service components if current page code is doing composition/data derivation directly.
- Modify: `messages/en.json`, `messages/ar.json`.
- Test: dashboard service/component tests and targeted browser smoke.

**Interfaces:**
- Consumes: existing school-scoped metrics/attention data, shared Card/Alert/EmptyState/Button/links.
- Produces: operational Administrator home linking into resolution workflows.

- [ ] **Step 1: Write failing tests that prioritize actionable attention over raw counts.**

  Cover available conditions such as teachers without login, teachers without assignments, students needing Group placement, missing weekly updates, attendance conflicts, reports ready, and delivery failures. Only include conditions already derivable from current repositories or inexpensive focused queries; do not create speculative analytics.

- [ ] **Step 2: Confirm RED.**

- [ ] **Step 3: Move any substantial attention derivation out of the route component into focused service/repository helpers.**

- [ ] **Step 4: Rebuild the page with primary shortcuts plus an Attention section.**

  Every attention item must navigate directly to the resolution surface.

- [ ] **Step 5: Run targeted dashboard checks and visual inspection.**

- [ ] **Step 6: Commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/dashboard' src/features messages/en.json messages/ar.json
  git commit -m "feat: make dashboard operational"
  ```

---

### Task 10: Redesign Teacher This Week and Weekly Update for Mobile-First Work

**Files:**
- Modify: `src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(teacher)/my-teaching/update/page.tsx`.
- Modify: weekly-update feature components under the owning feature directory.
- Modify: `messages/en.json`, `messages/ar.json`.
- Test: weekly-update component/unit tests and targeted mobile Playwright spec.

**Interfaces:**
- Consumes: existing school-local current-date assignment logic and weekly-submission domain rules; shared Badge, Card/structured row, EmptyState, form controls, Alert, Button.
- Produces: concise This Week work queue and clearer mobile weekly-update interaction.

- [ ] **Step 1: Write failing This Week tests.**

  Each active context must show Class, Subject, Group/Whole subject, student count, `Not started | Draft | Submitted`, and exactly one primary next action (`Start update | Continue draft | View submitted update`).

- [ ] **Step 2: Write failing ~360px weekly-update interaction tests.**

  Cover Mark all present, Present/Absent controls, shared performance, sparse exception expansion, draft saving, submission, sticky actions not obscuring the last student controls, and Arabic RTL.

- [ ] **Step 3: Confirm RED.**

- [ ] **Step 4: Rebuild This Week around one work queue.**

  Empty state must explain whether the Teacher has no current assignment rather than showing a blank screen.

- [ ] **Step 5: Recompose the weekly form using shared form/section primitives.**

  Preserve all existing domain behavior; do not introduce autosave engines or alter sparse-progress rules.

- [ ] **Step 6: Run targeted weekly tests and Playwright at desktop plus ~360px EN/AR.**

- [ ] **Step 7: Commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(teacher)/my-teaching' src/features messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: simplify weekly teacher workflow"
  ```

---

### Task 11: Redesign Teacher History and Profile; Retire My Groups Navigation

**Files:**
- Modify: `src/app/[locale]/(protected)/(teacher)/history/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(teacher)/history/[id]/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(teacher)/profile/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(teacher)/my-groups/page.tsx` to canonical redirect.
- Modify: translations/tests.

**Interfaces:**
- Consumes: shared list/detail/breadcrumb/status primitives and existing submitted-history repositories.
- Produces: read-only scan-friendly History plus simple Profile surface.

- [ ] **Step 1: Write failing tests that submitted History has no editing controls.**

- [ ] **Step 2: Confirm RED.**

- [ ] **Step 3: Rebuild History list/detail with week/date + Class + Subject + Group + Submitted status.**

- [ ] **Step 4: Rebuild My Profile as a focused read-only/personal surface consistent with available product capabilities.**

  Do not invent Teacher self-service fields that the domain does not support.

- [ ] **Step 5: Redirect legacy `my-groups` to `my-teaching` while preserving locale.**

- [ ] **Step 6: Run targeted tests/visual checks and commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(teacher)' messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: clarify teacher history and profile"
  ```

---

### Task 12: Stage the Reports Workflow and Add First-Class Delivery Status

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/reports/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(admin)/reports/[id]/page.tsx`.
- Create or expose: canonical Administrator delivery-status route under the Reports navigation group, using the existing report-delivery repository/service data.
- Modify: report feature components/actions only where composition/result messaging needs it.
- Modify: translations and tests.

**Interfaces:**
- Consumes: immutable report/finalization/delivery services, shared Tabs/Badge/DataTable/Alert/PageHeader.
- Produces: visible Prepare → Review → Finalize → Send workflow and direct delivery-failure management surface.

- [ ] **Step 1: Write failing tests for the four report stages and bulk-send discoverability.**

  Verify `Send ready reports` is visible when ready reports exist and its result distinguishes sent/skipped/failed outcomes supported by current action results.

- [ ] **Step 2: Write failing tests for Delivery Status grouping/filtering by pending/sent/failed state.**

- [ ] **Step 3: Confirm RED.**

- [ ] **Step 4: Recompose Reports without changing immutable report rules.**

  The stage presentation may use Tabs/step indicators, but must not permit illegal transitions that the backend forbids.

- [ ] **Step 5: Implement the first-class Delivery Status route using existing data access.**

  Do not duplicate provider logic. Expose enough context to resolve a failure without surfacing secrets or raw provider payloads.

- [ ] **Step 6: Run targeted report/delivery unit/browser tests and visual checks.**

- [ ] **Step 7: Commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/reports' src/features/reports messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: stage report and delivery workflows"
  ```

---

### Task 13: Standardize Export, Archives, and Destructive Lifecycle Workflows

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/exports/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(admin)/archives/page.tsx`.
- Modify: lifecycle/deletion-impact feature components/actions for Teacher, Guardian, Class, Subject, Group, and Student where they surface here.
- Modify: translations/tests.

**Interfaces:**
- Consumes: shared PageHeader/DataTable/ConfirmationDialog/Alert/Badge; existing export and archive/delete services.
- Produces: first-class Data tools with predictable restore/permanent-delete interaction.

- [ ] **Step 1: Write failing lifecycle tests.**

  Cover:

  - archived safe target → Restore + Delete permanently available;
  - protected/dependent target → Delete remains discoverable but blocked with exact impact reason;
  - Student existing transactional deletion flow remains intact;
  - non-Administrator never receives export/deletion UI or action access.

- [ ] **Step 2: Confirm RED.**

- [ ] **Step 3: Rebuild Export as a focused Data page.**

  Preserve existing period, scope, dataset, CSV/PDF, and protected-download behavior. Do not move business rules into UI.

- [ ] **Step 4: Rebuild Archives around record type, state, Restore, and explicit deletion-impact review.**

- [ ] **Step 5: Standardize destructive confirmation copy and blocked states across archive-supported record types.**

- [ ] **Step 6: Run targeted tests and visually inspect a safe delete plus blocked delete in EN/AR.**

- [ ] **Step 7: Commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/exports' 'src/app/[locale]/(protected)/(admin)/archives' src/features messages/en.json messages/ar.json tests/e2e
  git commit -m "feat: standardize data and archive workflows"
  ```

---

### Task 14: Reduce School Settings and Canonicalize Legacy Routes

**Files:**
- Modify: `src/app/[locale]/(protected)/(admin)/settings/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(admin)/settings/administrators/page.tsx`.
- Modify: `src/app/[locale]/(protected)/(admin)/settings/archives/page.tsx`.
- Modify any remaining duplicate legacy routes discovered during previous tasks.
- Modify: translations/tests.

**Interfaces:**
- Consumes: existing school-settings actions; canonical Administrator/Archives/Classes/My Teaching routes established by previous tasks.
- Produces: Settings limited to school configuration plus compatibility redirects for old URLs.

- [ ] **Step 1: Write failing route/component tests proving Settings contains only school configuration.**

  School configuration remains bilingual school names, timezone, and default language according to existing scope.

- [ ] **Step 2: Confirm RED.**

- [ ] **Step 3: Rebuild Settings with standard form pattern and explicit Save/Cancel behavior where supported.**

- [ ] **Step 4: Redirect legacy Settings/Admin, Settings/Archives, old Groups, and old My Groups routes to their canonical destinations.**

  Preserve locale. Do not retain duplicate editable flows behind redirects.

- [ ] **Step 5: Run targeted route/navigation tests and commit.**

  ```bash
  git add 'src/app/[locale]/(protected)/(admin)/settings' 'src/app/[locale]/(protected)/(admin)/groups' 'src/app/[locale]/(protected)/(teacher)/my-groups' messages/en.json messages/ar.json
  git commit -m "refactor: canonicalize school administration routes"
  ```

---

### Task 15: Whole-Product Copy, RTL, Accessibility, and Reachability Audit

**Files:**
- Modify: any redesigned route/component that fails the audit.
- Modify: `messages/en.json`, `messages/ar.json`.
- Modify/add targeted tests where an audit finding reveals a regression.
- Modify: `docs/PROGRESS.md` only with observed results.

**Interfaces:**
- Consumes: all prior redesigned surfaces.
- Produces: coherent end-to-end product ready for final release verification.

- [ ] **Step 1: Audit visible copy for hardcoded bilingual literals and duplicate/help-heavy text.**

  Search for feature components that still contain parallel English/Arabic label objects or user-facing English literals outside translation resources. Do not change teacher-authored content or server logs.

- [ ] **Step 2: Audit every required capability for navigation reachability.**

  Walk through:

  - Students
  - Guardians
  - Teachers
  - Administrators
  - Teacher access
  - Teaching Assignments
  - Classes
  - Subjects
  - Groups
  - enrollment
  - weekly updates
  - teacher history
  - reports
  - bulk report sending
  - delivery status
  - exports
  - archives
  - restore
  - permanent deletion
  - School Settings

  Record any capability that requires knowledge of an unlinked URL as a failure and fix it before proceeding.

- [ ] **Step 3: Audit interaction consistency.**

  Check that list pages use one primary action + overflow menus, record pages default to view state, short creation uses focused overlays, destructive actions are separated, and status vocabulary is consistent.

- [ ] **Step 4: Audit accessibility.**

  Keyboard-walk all menus/dialogs/forms in representative Administrator and Teacher workflows. Confirm focus visibility, dialog focus restoration, accessible names, labels, no color-only status, and comfortable hit targets.

- [ ] **Step 5: Audit RTL and 360px behavior visually.**

  At minimum inspect Dashboard, Students, Teachers, Teaching Assignments, Classes, Reports, Archives, This Week, and Weekly Update in:

  - English desktop;
  - Arabic desktop;
  - English ~360px;
  - Arabic ~360px.

  Fix clipping, ordering, overflow, hidden actions, mirrored-direction mistakes, or overlong copy before moving on.

- [ ] **Step 6: Run milestone verification.**

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

  Run the relevant DB and browser suites for any behavior changed during this audit.

- [ ] **Step 7: Update `docs/PROGRESS.md` with observed milestone results only.**

- [ ] **Step 8: Commit.**

  ```bash
  git add src messages docs/PROGRESS.md tests supabase/tests
  git commit -m "fix: complete whole-product UX audit"
  ```

---

### Task 16: Final Full Release Verification and Preview Review

**Files:**
- Modify only files required to fix failures found by the release gate.
- Modify: `docs/PROGRESS.md` with exact observed results.
- Do not merge or deploy production from this task without explicit user authorization.

**Interfaces:**
- Consumes: complete branch.
- Produces: release-candidate branch with verified CI/database/browser/visual evidence.

- [ ] **Step 1: Verify the branch is clean and based on the intended UX branch lineage.**

  ```bash
  git status --short
  git log --oneline --decorate -n 20
  ```

  Expected: no unexplained working-tree changes; logical milestone commits on `codex/full-website-ux-redesign`.

- [ ] **Step 2: Run the complete quality gate.**

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

  All must pass.

- [ ] **Step 3: Run the complete real PostgreSQL/RLS suite.**

  ```bash
  pnpm test:db
  ```

  All tests must pass. Static SQL contracts are not a substitute.

- [ ] **Step 4: Run the complete browser E2E suite.**

  ```bash
  pnpm test:e2e
  ```

  All workflows must pass.

- [ ] **Step 5: Push the release candidate and verify GitHub CI.**

  Use the existing repository CI workflow. Do not infer success from local checks; record actual quality/database/e2e statuses.

- [ ] **Step 6: Verify the Vercel Preview deployment for the branch.**

  Inspect actual Preview pages rather than build status alone. Review the representative Administrator and Teacher routes in English/Arabic and desktop/narrow modes.

- [ ] **Step 7: Perform final visual smoke against the Preview.**

  Required pages:

  - Dashboard
  - Students
  - Teachers
  - Teaching Assignments
  - Classes
  - Reports
  - Delivery status
  - Export
  - Archives
  - This Week
  - Weekly Update
  - History

  Required modes:

  - English desktop
  - Arabic desktop RTL
  - English narrow/mobile
  - Arabic narrow/mobile RTL

- [ ] **Step 8: Record exact verification evidence in `docs/PROGRESS.md`.**

  Include commit SHA, CI run/check results, database suite result, E2E result, Preview status, and visual-smoke coverage. Do not write “passed” unless observed.

- [ ] **Step 9: Commit verification documentation if changed.**

  ```bash
  git add docs/PROGRESS.md
  git commit -m "docs: record UX redesign release verification"
  ```

- [ ] **Step 10: Stop before merge/production.**

  Present the verified release candidate to the user. Do not merge to `main`, apply production database changes, or deploy production until explicit authorization is given.

---

## Self-Review Results

- **Spec coverage:** All 43 design-spec sections map to at least one task: foundation and interaction primitives (Task 1), information architecture/shell (Task 2), assignment backend and reference workflow (Tasks 3–4), People (Tasks 5–7), School structure (Task 8), Dashboard (Task 9), Teacher workflows (Tasks 10–11), Reports/Data (Tasks 12–13), Settings/legacy routes (Task 14), whole-product accessibility/RTL/reachability (Task 15), and final verification/release safety (Task 16).
- **Placeholder scan:** No `TBD`, `TODO`, “implement later”, or unspecific “write tests for the above” steps remain. Where exact current file names depend on route-owned feature composition, the plan directs the implementer to discover the owning file before the task and names the route/domain boundary that must own the change rather than inventing a path.
- **Type consistency:** The Teaching Assignment mutation contract is defined in Task 3 and explicitly consumed in Task 4. Shared component contracts are produced in Task 1 and consumed by all later tasks. Canonical routes established in Tasks 2/4/8/11/14 are used by later navigation and redirect steps.
- **Review Focus coverage:** dual-capability navigation is pinned in Task 2; RTL overlays in Tasks 1 and 15; assignment mutation conflict classes in Task 3 and browser behavior in Task 4; narrow management lists in Tasks 1 and 7; blocked destructive operations in Tasks 4 and 13.
