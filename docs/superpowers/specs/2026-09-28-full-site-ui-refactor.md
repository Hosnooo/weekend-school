# Weekend School — Full-Site UI Refactor

**Date:** 2026-09-28
**Status:** Approved design
**Baseline:** `8fba5d9952fa3d3947aee9a8efe8c75ca999aaab`
**Repository:** `Hosnooo/weekend-school`

## 1. Purpose

Refactor the complete Weekend School interface into one coherent, compact, professional school-operations product while preserving the completed domain architecture and workflows.

This is a frontend interaction and presentation refactor. It is not a database redesign, authorization redesign, or rewrite of completed Admin, Teacher, Teaching Update, or Report Cycle behavior.

The finished product should let an Administrator reach useful operational content quickly, understand current state, and identify the next relevant action without navigating through excessive cards, counters, descriptions, or simultaneous controls.

Teacher workflows must remain simpler and more task-focused than Administrator workflows.

## 2. Existing Behavior That Remains Authoritative

The refactor must preserve:

- independent Administrator and Teacher capabilities;
- dual-capability accounts with full Admin navigation plus a clearly separate My Teaching area;
- Class → Subject → optional Group;
- Subject-scoped new Teacher assignments;
- historical Group-scoped assignment provenance;
- Groups as organizational, not new permission boundaries;
- flexible Teaching Updates using RANGE or DATES coverage;
- OPEN / SUBMITTED / DISMISSED Teaching Update lifecycle;
- shared Admin-requested Teaching Update behavior;
- protected submitted/finalized history;
- Class-scoped Report Cycles with custom date ranges;
- persisted source include/exclude state;
- report generation, preview, sending, delivery history, exports, archives, and historical reports;
- English and Arabic as first-class interfaces;
- RTL and narrow/mobile usability;
- school scoping, RLS, authorization, and historical records.

No schema, migration, RLS, route, or backend change is authorized solely for visual convenience. A backend change may occur only when the refactor exposes a genuine functional defect and must then be treated as a separate correctness change.

## 3. Product Direction

The interface should feel like a compact school-operations console.

It should not feel like:

- a collection of unrelated cards;
- a statistics dashboard;
- permanently open forms;
- long explanations before useful content;
- a collection of counters simply because counts are available.

The product hierarchy is:

1. current state;
2. next useful action;
3. main operational content;
4. secondary information;
5. history.

Statistics are secondary unless they directly change what the user should do.

## 4. Core Visual Principles

### 4.1 Compact and operational

Administrator pages should fit meaningful information on screen without becoming cramped. Teacher pages should remain somewhat more spacious and task-focused.

Desktop density may increase, but controls remain accessible, touch targets remain usable on narrow screens, and Arabic text must not be compressed unnaturally.

### 4.2 Restrained surfaces

Prefer, in order:

1. typography;
2. whitespace;
3. subtle surface contrast;
4. dividers;
5. bordered containers only where grouping is meaningful.

Do not wrap every section in a card. Avoid nested cards.

Cards remain appropriate for meaningful dashboard attention blocks, workflow groups, dialogs, grouped Teacher tasks, and genuinely self-contained content.

### 4.3 Clear hierarchy

Every screen should make the following immediately understandable:

- where the user is;
- the important current state;
- what needs attention;
- the next useful action.

Descriptions should be short and omitted when the interface already explains itself.

### 4.4 One primary action

A page should normally have one visually dominant primary action.

Examples:

- Students → Add student
- Teachers → Add teacher
- Classes → Create class
- Teaching Assignments → Add assignment
- Reports → Create Report Cycle

Other actions should use secondary, ghost, menu, or contextual treatment.

### 4.5 Progressive disclosure

Do not show every possible action simultaneously.

Common pattern:

- primary action visible;
- common secondary action visible when useful;
- uncommon actions under overflow;
- destructive actions separated;
- edit controls shown only during editing.

## 5. Counters and Statistics

Counters must not appear merely because data can be counted.

Remove or avoid repeated decorative totals such as:

- total students;
- total teachers;
- total classes;
- assignment counts repeated immediately above visible assignments;
- status totals repeated across multiple pages.

A count is justified only when it helps the user decide what to do. Even useful counts should appear near the workflow they describe rather than being repeated globally.

### Dashboard rule

The Dashboard is not a statistics page.

It should answer:

1. What needs attention now?
2. What is currently in progress?
3. What can I do next?

Do not default to large metric tiles such as 247 Students, 18 Teachers, or 12 Classes unless a future operational requirement demonstrates a specific need.

## 6. Temporary Operational States

Transient problems belong to the workflow that produced them.

Example after a report send:

`18 sent · 2 failed`

The result may remain visible on the relevant Report Cycle / Delivery Status surface while unresolved. It must not automatically become a permanent global dashboard counter.

If the Administrator leaves and returns, the relevant Report Cycle may show a subtle contextual state such as `Delivery issue`.

After the problem is resolved:

- the warning disappears from active workflow state;
- historical delivery information remains available for audit/history.

The same principle applies to other temporary operational warnings.

## 7. Shared Visual Foundation

The refactor begins with shared foundations before feature pages are migrated.

Standardize:

- application background;
- surfaces and subtle surfaces;
- borders;
- text and muted text;
- primary, success, warning, danger, informational states;
- focus ring;
- spacing scale;
- control heights;
- border radii;
- restrained elevation;
- typography hierarchy.

Typography hierarchy must include:

- page title;
- section title;
- subsection title;
- record/entity name;
- body;
- labels;
- metadata;
- table headings;
- statuses.

Record names lead visually. Email addresses, dates, groups, identifiers, and supporting details use quieter metadata styling.

Arabic continues to use Noto Sans Arabic. Directional CSS must use logical properties.

## 8. Shared Product Patterns

The product should rely on reusable patterns instead of feature-specific visual systems.

Required patterns include:

- App shell;
- desktop sidebar;
- mobile navigation drawer;
- PageHeader;
- SectionHeader;
- Button variants;
- form controls and FormField;
- Badge/status;
- Alert;
- EmptyState;
- management table/list;
- record row;
- detail section;
- Dialog/Drawer;
- ConfirmationDialog;
- overflow menu;
- workflow stage presentation;
- contextual result state.

Existing shared components should be improved and reused where appropriate. Do not introduce a large dashboard template or unnecessary UI framework.

## 9. Navigation

Retain the established capability-sensitive information architecture.

### Administrator

Overview
- Dashboard

People
- Students
- Guardians
- Teachers
- Administrators

School
- Classes
- Teaching Assignments

Reports
- Teaching Updates
- Reports
- Delivery Status

Data
- Export
- Archives

Settings
- School Settings

### Teacher capability

My Teaching
- Updates
- History
- My Profile

For dual-capability users, My Teaching remains clearly separate from Administrator functionality.

### Navigation visual behavior

Refine rather than redesign the hierarchy:

- quieter group labels;
- clearer active destination;
- reduced vertical padding;
- no counters beside every navigation item;
- no permanent warning badges throughout navigation;
- mobile drawer preserves the same hierarchy.

Operational exceptions should normally appear inside the destination where they can be acted upon.

## 10. Standard Page Patterns

### 10.1 Management list page

Applies to Students, Guardians, Teachers, Administrators, Classes, Archives, Delivery Status, and similar list surfaces.

Pattern:

1. page title;
2. one primary action;
3. search/filter toolbar only where useful;
4. main structured list/table;
5. name or record identity first;
6. supporting metadata second;
7. status only when relevant;
8. uncommon actions under overflow;
9. intentional empty state.

Do not place decorative summary counters above the list.

Desktop uses compact structured rows. Mobile uses an intentional responsive representation rather than a compressed desktop table.

### 10.2 Record/detail page

Applies to Student, Guardian, Teacher, Administrator, Class, and similar detail surfaces.

Pattern:

1. record name/title;
2. useful current state;
3. primary action;
4. two to four meaningful information sections;
5. secondary/history content later.

Record pages default to view mode. Editing begins only after an explicit Edit action. Save and Cancel appear only while editing.

### 10.3 Workspace page

Applies to Teaching Assignments, Class management, Report Cycles, and other multi-step operational surfaces.

Pattern:

1. workspace identity;
2. current state/stage;
3. actionable issue if one exists;
4. main current work;
5. next primary action;
6. secondary/history information.

Warnings remain local to the workspace.

### 10.4 Workflow/task page

Applies especially to Teaching Updates and Report Cycles.

The page should emphasize current stage, incomplete/current work, next action, and completion state. Reduce explanatory prose once component structure communicates the workflow. Completed/history items become visually quieter.

## 11. Dashboard

The Dashboard should prioritize current work rather than general totals.

Potential structure:

### Needs attention

Only actionable current items, such as Teaching Update requests still open or a Report Cycle waiting for a missing source.

### In progress

Current operational workflows, such as an active Report Cycle or Teaching Update being prepared.

### Quick actions

A small set of high-value entry points such as Add student, Add teacher, and Create Report Cycle.

The Dashboard should remain useful when there is nothing requiring attention. It must not manufacture counters or warnings to fill space.

## 12. People Surfaces

Refactor Students, Guardians, Teachers, and Administrators as one coherent family.

Goals:

- consistent list density;
- consistent view/edit behavior;
- record identity visually dominant;
- account/login state clearly distinguished from business identity;
- lifecycle state shown only when meaningful;
- destructive/lifecycle operations separated from ordinary editing.

Teacher records continue to distinguish Teacher identity, login access, and teaching assignments.

Administrator records continue to distinguish Administrator identity, login access, and lifecycle state.

## 13. School Surfaces

Refactor Classes, Subjects, Groups, and Teaching Assignments together.

Preserve the established Class → Subject → optional Group model.

Teaching Assignments should remain a reference workflow for progressive disclosure:

- view existing assignment normally;
- edit only after Edit;
- end deliberately;
- delete where allowed;
- protected historical records explain why destructive changes are blocked.

Do not reintroduce Group selection for new Subject-scoped Teacher assignments.

## 14. Teacher Surfaces

Teacher workflows should remain simpler than Administrator workflows.

My Teaching should emphasize current/open work, requested Teaching Updates, submitted/history work, and a clear next action.

Avoid administrative statistics and unnecessary surrounding controls. Mobile usability is especially important for Teacher workflows.

## 15. Teaching Updates

Teaching Updates are workflow records, not weekly dashboard cards.

Presentation should clearly communicate:

- OPEN / SUBMITTED / DISMISSED state;
- coverage dates;
- Class / Subject / Group context where applicable;
- whether Admin requested the update;
- who completed/submitted it where relevant;
- current action available.

OPEN work receives visual priority. SUBMITTED/history items become quieter. Overlap is informational, not automatically an error.

Do not revert to the obsolete fixed “This week” interaction model.

## 16. Report Cycles

Report Cycles should visually read as a staged workflow:

Sources → Student Reports → Preview → Send → Delivery

The UI should make the current stage and next useful action obvious without requiring large explanatory cards.

### Sources

Show:

- included/excluded submitted Teaching Updates;
- Subject/Group context;
- Teacher/completer;
- coverage;
- partial overlap where relevant;
- missing source contexts;
- Request update action where appropriate.

### Student Reports

Show generated student reports and readiness.

### Preview

Keep report preview accessible and focused.

### Send

Show sending action only when appropriate.

### Delivery

Show immediate send results contextually. Unresolved delivery problems remain attached to the relevant Report Cycle. Resolved issues become history rather than permanent warnings.

Historical Subject/Group reports remain accessible but visually secondary to the current Class Report Cycle model.

## 17. Forms

Forms should use hierarchy and whitespace rather than excessive bordered containers.

Rules:

- labels are clear but not oversized;
- hints are quiet;
- validation appears near the relevant field where practical;
- Save and Cancel remain obvious;
- unexpected errors use a clear Alert;
- field grouping follows user concepts;
- permanently open creation forms should be avoided where a dialog, drawer, or dedicated creation flow is clearer.

Do not alter business validation for presentation convenience.

## 18. Responsive and RTL Requirements

Every shared pattern must be designed for:

- English desktop;
- Arabic desktop;
- English narrow/mobile;
- Arabic narrow/mobile.

Requirements:

- logical CSS properties;
- direction-aware icons where relevant;
- no ad-hoc left/right patches;
- mobile navigation retains all capabilities;
- tables/lists have intentional narrow rendering;
- Teacher task flows remain usable around 360px width;
- Administrator pages remain operational on narrow screens.

## 19. Refactor Sequence

Implementation proceeds system-first.

### Phase 1 — Foundation

Refactor visual tokens, typography, spacing, surfaces, controls, shared status treatment, and shared density.

### Phase 2 — Shared product patterns

Refactor shell/navigation, page headers, management lists, record/detail patterns, forms, workflow stages, and contextual alerts/results.

### Phase 3 — Feature migration

Migrate coherent areas:

1. People — Students, Guardians, Teachers, Administrators
2. School — Classes, Subjects/Groups, Teaching Assignments
3. Teacher — My Teaching, Teaching Updates, History/Profile
4. Reports — Admin Teaching Updates, Report Cycles, Preview/Send/Delivery
5. Data/Settings — Export, Archives, School Settings

Avoid isolated visual patches where a shared pattern should solve the problem.

## 20. Testing Strategy

The redesign must not preserve obsolete UI merely because an old E2E assertion expects it. Tests should protect product behavior, not outdated page structure.

During feature work:

- maintain focused unit/contract tests;
- maintain DB/RLS tests;
- run typecheck;
- run lint;
- run focused browser smoke tests for the area being changed;
- verify representative EN/AR and narrow/desktop behavior.

After the UI stabilizes:

1. update shared E2E helpers first;
2. remove assumptions from the old weekly UI;
3. remove assumptions from old Group-scoped assignment creation;
4. update Report workflow expectations;
5. update remaining stale UI locators;
6. run the complete Playwright suite;
7. require all browser workflows to pass before production readiness.

## 21. GitHub Actions Policy During Refactor

No GitHub Action should run automatically while this refactor is in progress.

All workflow files remain in the repository for visibility and reuse.

During the refactor:

- `redesign-ci.yml` is `workflow_dispatch` only;
- `ux-redesign-targeted.yml` remains `workflow_dispatch` only;
- `ux-reference-visual.yml` remains `workflow_dispatch` only;
- pushes to `main` trigger zero GitHub Actions.

Verification is performed locally while the redesign is in progress.

At the end of the refactor:

1. finish E2E modernization;
2. run the complete local quality gate;
3. run the complete local database/RLS gate;
4. run the complete local Playwright gate;
5. update GitHub workflows to match the final verified commands;
6. re-enable the intended automatic checks only after local verification.

Do not permanently remove workflows merely to silence failures.

## 22. Development Workflow

Use the existing local `main` workflow requested for this project.

Rules:

- no unnecessary branches;
- no dozens of tiny commits;
- use meaningful coherent patches;
- no production deployment during the refactor;
- do not touch hosted Supabase without explicit authorization;
- never stage or commit the existing local `supabase/config.toml` modification;
- verify before every completion claim.

## 23. Out of Scope

Unless a real defect is discovered, do not redesign:

- database architecture;
- migrations;
- RLS model;
- authorization model;
- school scoping;
- Class/Subject/Group semantics;
- Teacher assignment semantics;
- Teaching Update semantics;
- Report Cycle source semantics;
- immutable reporting history;
- email delivery architecture;
- production infrastructure.

Do not introduce decorative analytics dashboards, counters everywhere, permanent global warning badges, a large UI framework, a generic data-grid system without product need, or page-specific visual systems that bypass shared components.

## 24. Success Criteria

The refactor is complete only when:

- the entire Admin interface follows one interaction language;
- Teacher workflows remain simpler and clearly separated;
- useful page content appears quickly;
- decorative counters are removed;
- temporary operational issues remain contextual;
- lists, detail pages, forms, and workflows use consistent patterns;
- cards are used selectively;
- typography clearly separates records from metadata;
- EN/AR and RTL share the same product system;
- mobile behavior is intentional;
- existing domain behavior remains intact;
- stale E2E tests are modernized;
- the complete local unit/contract suite passes;
- the complete local PostgreSQL/RLS suite passes;
- typecheck passes;
- lint passes;
- production build passes;
- the complete local Playwright suite passes;
- GitHub Actions are updated from the final locally verified commands before automatic CI is re-enabled;
- production deployment remains a separate explicit decision.

## 25. Governing Principle

**Show current state and the next useful action before statistics.**

The interface should expose what matters now, keep history available without letting it dominate, and place temporary problems where the user can actually resolve them.
