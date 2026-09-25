# Weekend School — Full Website UX and Interaction Redesign

**Date:** 2026-09-24  
**Status:** Approved  
**Target repository:** `Hosnooo/weekend-school`  
**Verified baseline:** `main` at `c225afea11ad772c8e804ab3636523e616eec1ec`

## 1. Purpose

Redesign the Weekend School application as one coherent, professional school-administration product without rebuilding the completed domain architecture.

This is a website-wide UX and interaction redesign, not another isolated Teaching Assignment change.

The redesign must make the application understandable to two primary users:

1. An Administrator managing the school.
2. A Teacher completing weekly work with minimal friction.

The success criterion is:

> An Administrator opening the application for the first time should understand where the major capabilities are, what the important states mean, and how to perform common school-management tasks without needing an explanation of the underlying database architecture.

The Teacher experience must remain significantly simpler than the Administrator experience.

## 2. Existing Architecture That Must Be Preserved

This redesign does not change the established domain architecture.

The following remain authoritative:

- Profiles are authentication/audit identities.
- Administrators and Teachers are independent business records.
- `administrator_accounts` links Profiles to Administrators.
- `teacher_accounts` links Profiles to Teachers.
- One login may have Administrator capability, Teacher capability, both, or neither.
- Teaching assignments reference Teacher records, not Profiles.
- School structure is Class → Subject → optional Subject Group.
- Students have effective-dated enrollment.
- Teachers may have multiple teaching assignments.
- Weekly submissions and historical attribution must remain preserved.
- Reports are immutable once finalized.
- Archive/restore is the normal record lifecycle.
- Permanent deletion is an explicitly confirmed Administrator operation.
- Authorization remains enforced both server-side and through PostgreSQL RLS.
- English and Arabic remain first-class interfaces.
- Existing report generation, exports, archives, email delivery, weekly updates, and other completed backend features must be reused rather than rewritten.

No database redesign is authorized by this UX project unless an actual functional gap requires a forward-only migration.

Applied migrations must remain immutable.

## 3. Problems This Redesign Must Solve

### 3.1 Inconsistent interaction language

The current product mixes tables, cards, permanently open forms, inline editing, dedicated edit pages, underlined text actions, regular buttons, archive actions, deactivate actions, delete actions, explanatory text, and status text.

Users therefore cannot reliably predict how a page will behave.

The redesign establishes one interaction language for the entire application.

### 3.2 Excessive simultaneous controls

Many screens expose editing, lifecycle, access, assignment, and destructive controls at the same time.

This increases cognitive load and obscures the primary task.

The redesign uses progressive disclosure:

- one obvious primary action;
- common secondary actions when appropriate;
- uncommon actions in an overflow menu;
- destructive actions visually separated;
- edit controls shown only during editing.

### 3.3 Weak separation between viewing and editing

Record pages must not behave like permanently open forms.

A record normally appears in a read-only view state.

Editing starts only after an explicit `Edit` action.

Editing exposes editable fields, `Save changes`, and `Cancel`.

Successful saving returns the record to view state.

### 3.4 Hidden or poorly located capabilities

Important features must not be discoverable only through knowledge of the implementation.

Administrator capabilities such as Administrators, Teaching Assignments, Archives, Export, and delivery status must have clear locations in the information architecture.

### 3.5 Page-specific styling instead of a product system

The existing UI uses many feature-specific CSS concepts rather than a sufficiently mature reusable design system.

This redesign introduces a small internal component system and common page patterns before propagating visual changes throughout the application.

## 4. Design Principles

### 4.1 Operational clarity

The interface should answer:

- Where am I?
- What is the current state?
- What can I do next?
- What requires attention?
- What will happen if I choose this action?

### 4.2 Low clutter

Do not expose every possible action at once. Use progressive disclosure.

### 4.3 One obvious primary action

A page may contain many capabilities, but normally only one action should receive primary visual emphasis.

Examples:

- Students → `Add student`
- Teachers → `Add teacher`
- Teaching Assignments → `Add assignment`
- Classes → `Create class`
- Archives → usually no creation action

### 4.4 Consistency over local optimization

The same type of task should behave the same way everywhere.

Users should not need to learn a different CRUD model for Teachers, Guardians, Classes, and Students.

### 4.5 Business language rather than database language

Users should interact with concepts such as Login access, Teaching assignment, Current class, Archived, and Submitted rather than implementation terminology.

### 4.6 Restrained use of cards

Cards are appropriate for dashboard attention items, grouped summaries, teacher mobile workflows, and meaningful content units.

Tables or structured rows are preferred for management lists.

A page must not become a collection of unrelated floating cards.

### 4.7 Mobile is intentional, not compressed desktop

Teacher workflows must be designed deliberately for approximately 360px width.

Administrator pages must remain usable on narrow screens through responsive patterns rather than merely shrinking desktop tables.

### 4.8 English and Arabic use the same product system

English and Arabic must share components and information architecture.

Arabic must use `dir="rtl"`, logical CSS properties, direction-aware icons, appropriate alignment, and Noto Sans Arabic.

RTL must not be implemented merely by changing text alignment.

## 5. Design-System Strategy

Adopt a selective **shadcn-style internal component system**, not a full dashboard template or large component catalog.

The project retains React 19, Next.js 16, Tailwind 4, next-intl, and Noto Sans Arabic.

Accessible headless primitives may be introduced where they materially improve behavior, particularly for Dialog, Dropdown Menu, Drawer/Sheet, Tabs, Tooltip, and Toast.

Only required primitives should be installed.

Do not import an entire UI framework or template.

The application owns its visual design and composition.

## 6. Foundation Tokens

The visual system must standardize application background, elevated surface, subtle surface, border colors, primary action, primary hover, muted text, success, warning, danger, informational state, and focus ring.

Spacing should use a consistent scale rather than arbitrary per-page values.

Border radii should use a small consistent set.

Shadows should be restrained and primarily used for menus, dialogs, drawers, and sticky surfaces where elevation communicates layering.

Typography should establish consistent styles for page title, section title, subsection title, body, secondary text, labels, metadata, and table headings.

The application should feel like administrative software, not a marketing site.

## 7. Core Reusable Components

### Page structure

#### `AppShell`

Owns desktop sidebar, mobile navigation trigger/drawer, top utility area, content width, and capability-sensitive navigation.

#### `PageHeader`

Supports title, optional concise description, breadcrumbs when needed, one primary action, and optional secondary actions.

#### `SectionHeader`

Supports section title, optional short description, and optional localized action.

#### `Breadcrumbs`

Used on nested management pages.

Example: `Teachers / Ahmed Ali / Teaching assignments`

Breadcrumbs should not duplicate sidebar navigation unnecessarily.

### Actions

#### `Button`

Variants: primary, secondary, ghost, danger.

Sizes: default, compact, icon where appropriate.

#### `IconButton`

Used for compact controls only when meaning remains accessible through an accessible label and/or tooltip.

#### `DropdownMenu`

Used for less-common record actions.

Typical record menu:

- View;
- Edit;
- Manage access;
- Teaching assignments;
- Archive.

Destructive operations appear in a separated menu section.

### Data display

#### `DataTable`

Supports clear columns, row navigation or row action, status cells, overflow actions, responsive fallback, and empty state.

It does not need to become a generic data-grid framework.

Sorting, pagination, or filters should only be implemented where the product actually needs them.

#### `Badge`

Used for genuine state, for example Active, Archived, Current, Upcoming, Submitted, Draft, and Failed.

A Badge must not be used simply as decoration.

#### `EmptyState`

Contains a concise reason and optional next action.

Example:

> No current teaching assignments  
> Add an assignment to make this teacher’s classes available in My Teaching.

#### `Alert`

Used for warnings, blockers, and important informational conditions.

### Forms

#### `FormField`

Standardizes label, required indicator, control, hint, and validation error.

#### `Input`

#### `DateField`

#### `Select`

#### `SearchInput`

Form validation errors should appear near the affected field when possible.

Unexpected form-level failures appear in a clear Alert rather than generic floating text.

### Layered interaction

#### `Dialog`

For focused short tasks.

#### `Drawer` / `Sheet`

Used where appropriate for narrow/mobile layouts or short contextual workflows.

#### `ConfirmationDialog`

For consequential actions. It must clearly identify the record, consequence, and whether the action is reversible.

#### `Tabs`

Used for true alternate views of one workspace. They must not merely conceal unrelated page sections.

#### `Toast`

Used for short transient success feedback.

Important failures must not exist only inside a temporary toast.

## 8. Component Reference Page

Before redesigning all feature pages, create an internal visual reference page showing the approved component system.

It should demonstrate buttons, fields, statuses, table rows, empty state, warning state, menu, dialog, tabs, confirmation dialog, typical page header, and typical record header.

The reference must be checked in English desktop, Arabic desktop, English narrow/mobile, and Arabic narrow/mobile.

This reference becomes the visual baseline for subsequent feature work.

It must not become normal production navigation.

## 9. Administrator Information Architecture

Desktop Administrator navigation:

### Overview

- Dashboard

### People

- Students
- Guardians
- Teachers
- Administrators

### School

- Classes
- Teaching Assignments

### Reports

- Reports
- Delivery status

### Data

- Export
- Archives

### Settings

- School settings

If the authenticated Profile also has Teacher capability, add a clearly separate section:

### My Teaching

- This Week
- History
- My Profile

Teacher capability must not be presented as an Administrator sub-feature.

Teacher-only accounts receive only the Teacher navigation.

## 10. Responsive Navigation

### Desktop

Persistent sidebar.

Navigation groups have clear low-emphasis group labels.

Active destination has a strong but restrained selected state.

### Narrow/mobile

Sidebar becomes a navigation drawer.

The drawer preserves the same hierarchy.

Capabilities must not disappear simply because the viewport is narrow.

Language switching and account/sign-out controls remain reachable without competing with primary page content.

## 11. Standard List-Page Pattern

Use for Students, Guardians, Teachers, Administrators, Classes where appropriate, Reports, Delivery status, and archives.

Pattern:

```text
Teachers                                      + Add teacher

Search/filter controls

Teacher       Status       Login       Teaching        ⋯
Ahmed Ali     Active       Linked      2 current       ⋯
Sara Hassan   Active       No login    None            ⋯
```

Rules:

1. The primary create action belongs in `PageHeader`.
2. Search/filter controls form one toolbar.
3. Rows do not expose five or six actions simultaneously.
4. Common navigation may occur through record name/row.
5. Less-common actions belong under `⋯`.
6. Lifecycle/destructive actions are separated within the menu.
7. Empty lists use `EmptyState`.
8. Mobile rendering must be intentional.

## 12. Standard Record/Detail Pattern

Record pages default to a view state.

Example:

```text
Ahmed Ali                                  Edit    ⋯

Active

Contact
Email       ...
Phone       ...

Login access
Status      Linked

Teaching
2 current assignments
```

Editing should visibly change the page into edit mode.

Only then are input controls and Cancel / Save changes shown.

Related concepts should be separated into meaningful sections rather than merged into one long form.

## 13. Creation Pattern

Use two creation patterns.

### Dialog/Drawer

Use for focused, relatively short entities or relationships such as Teaching Assignment, simple Group, and simple Subject relationship.

### Dedicated creation page

Use for more complex flows such as Student creation or any entity requiring several meaningful sections or dependent relationships.

Do not use permanently open creation forms at the top of every list page.

## 14. Lifecycle and Destructive Actions

The normal lifecycle is `Active → Archive/Deactivate → Restore`.

Permanent deletion is exceptional.

Rules:

1. Archive/deactivate is separate from permanent deletion.
2. Permanent deletion must not look like an ordinary editing action.
3. Permanent deletion normally requires the target to already be archived where required by domain rules.
4. Dependency impact must be shown when relevant.
5. If deletion is blocked, keep the concept discoverable and explain exactly why.
6. Never silently destroy protected historical information.
7. Existing export-before-delete capabilities remain available where required.

## 15. Error-Handling Contract

The interface must stop converting unrelated failures into generic errors.

Server/domain actions should return meaningful typed outcomes that the UI can translate into user-facing messages.

Teaching Assignment operations must distinguish at minimum:

- invalid date range;
- assignment overlap;
- protected submitted history;
- authorization failure;
- missing/not-found record;
- unexpected failure.

Example messages:

### Invalid date range

> End date cannot be earlier than the start date.

### Overlap

> This teacher already has an overlapping assignment for this teaching context. Change the dates or edit the existing assignment.

### Protected history

> This change would conflict with submitted weekly teaching history. The existing historical record must be preserved.

### Unexpected

> The assignment could not be updated. No changes were saved.

Unexpected errors may also be logged server-side, but the user-facing message must remain useful.

## 16. Teaching Assignments Reference Workflow

Teaching Assignments becomes the reference implementation for the new interaction language.

### Teacher assignment page

Header:

```text
Ahmed Ali
Teaching assignments                       + Add assignment
```

Optional summary: current assignment count and upcoming assignment count.

Main content:

```text
[ Current ] [ Upcoming ] [ Past ]
```

These are Tabs, not three permanently expanded page sections.

### Assignment row

Example:

```text
Test Class · Quraan
Whole subject
Sep 30, 2026 → Ongoing        Current       ⋯
```

Do not permanently render date controls.

Overflow menu:

- Edit dates;
- End assignment;
- Delete assignment.

### Edit dates

Choosing `Edit dates` enters an explicit local editing state.

Show Start date, End date, Cancel, and Save changes.

No unrelated controls appear in that edit state.

### End assignment

`End assignment` should be a deliberate action.

The resulting end date and implications should be clear before confirmation where needed.

### Delete assignment

A real Delete Assignment action must exist.

If the assignment has no protected historical weekly work depending on it, show a confirmation and delete the mistaken/unused assignment.

If protected submitted history exists, the Delete action remains discoverable, deletion is blocked, and the UI explains exactly why. Do not require date manipulation as a substitute for deletion.

### Add Assignment

`+ Add assignment` opens a focused dialog/drawer.

Fields:

1. Class
2. Subject
3. Group / Whole subject
4. Start date
5. optional End date

Selections cascade naturally: Class → available Subjects → available Groups.

Before final submission, known conflicts may be detected in the UI when practical.

The database overlap constraint remains authoritative.

### Duplicate correction

Existing mistaken duplicate/overlapping records that are not protected by historical work must be correctable through Edit/Delete.

The UI must not present them as historical-protection failures when the actual problem is an overlap.

## 17. Teachers

The Teacher experience must clearly separate:

1. Teacher business record;
2. Login access;
3. Teaching assignments.

Teacher list columns should communicate Teacher, Status, Login, Teaching coverage, and overflow actions.

Teacher detail should include clearly separated sections for identity/contact information, login access, current teaching summary, and lifecycle state.

Teacher account/access operations must not appear to edit the Teacher business identity itself.

Teaching assignment management should open the focused Teaching Assignments surface.

## 18. Administrators

Administrators are a first-class People destination.

Do not hide them under Settings.

Administrator management should visually distinguish Administrator business record, login/access state, and active/inactive state.

Existing last-active-Administrator protections remain.

Administrator changes must not implicitly create, modify, or remove Teacher capability.

## 19. Students

Student detail should make four concepts clear:

1. identity;
2. current enrollment;
3. guardians;
4. lifecycle.

`Edit student` and `Manage enrollment` must not duplicate the same operation.

Enrollment should have a dedicated understandable section showing current Class, Subject participation, Group placement where applicable, and effective dates/history where needed.

Complex enrollment changes must not be hidden behind ambiguous action labels.

## 20. Guardians

Guardians remain independent records.

Guardian list/detail should use the same management language as other People records.

Clearly expose contact information, linked students, preferred language where relevant, active/archive state, Edit, and lifecycle actions.

## 21. Classes, Subjects, and Groups

The Administrator should understand the hierarchy visually as `Class → Subjects → optional Groups`.

A Class detail page becomes the main structural management surface.

Example:

```text
Test Class                                    Edit    ⋯

Subjects

Quraan
3 groups · 2 teachers assigned               ⋯

Arabic
Whole-subject teaching                       ⋯
```

Expanding or opening a Subject reveals its Groups and teaching coverage.

Avoid presenting every Subject and Group as a separate large card with permanently open forms.

Create/edit/archive/restore actions must follow the same interaction patterns used elsewhere.

Direct routes into Teaching Assignments should exist where they improve workflow.

## 22. Administrator Dashboard

The Dashboard must answer: **What needs my attention today?**

It must not be simply a collection of database counts.

### Primary shortcuts

Examples:

- Add Student
- Add Teacher
- Assign Teacher
- Create Class

Avoid turning every shortcut into an equally prominent large button.

### Attention area

Show actionable conditions already derivable from school data, including where available:

- Teachers without login access;
- Teachers without assignments;
- Students needing Group placement;
- missing weekly updates;
- attendance conflicts;
- reports ready for review/send;
- report delivery failures.

Each attention item should link directly to the relevant resolution workflow.

Counts may still exist, but operational attention takes priority.

## 23. Teacher Information Architecture

Teacher-only navigation:

### My Teaching

- This Week
- History
- My Profile

No Administrator navigation should appear for Teacher-only users.

Dual-capability accounts receive both surfaces without role switching.

## 24. This Week

This Week should immediately answer: **What do I need to complete this week?**

Each teaching context shows Class, Subject, Group or Whole subject, student count, status (Not started, Draft, Submitted), and one obvious next action.

Examples:

- `Start update`
- `Continue draft`
- `View submitted update`

The teacher should not need to open several screens simply to discover current responsibilities.

## 25. Weekly Update

The weekly update remains mobile-first.

Preserve the existing efficiency model:

- shared group information entered once;
- Mark all present;
- Present/Absent attendance;
- default performance;
- individual exceptions only when needed;
- optional individual comments;
- Save Draft;
- Submit.

The redesign should improve clarity without changing those domain rules.

Sticky actions may remain where helpful, but they must not obscure content on small screens.

Submitted work should clearly communicate that it is no longer editable according to existing rules.

## 26. Teacher History

History is read-only.

It should be easy to scan by week/date, Class, Subject, Group, and submitted state.

Opening a historical update presents a read-only detail view.

No editing controls should appear on submitted history.

## 27. Reports

The report workflow should visually communicate its stages:

`Prepare → Review → Finalize → Send`

The underlying immutable-report rules remain unchanged.

The Administrator should be able to understand which reports need preparation, which are ready for review, which are finalized, which are ready to send, and which have delivery failures.

`Send ready reports` should be visible when relevant rather than buried among unrelated controls.

Sending results must communicate sent, skipped, failed, and retryable conditions where applicable.

## 28. Delivery Status

Delivery status is a first-class Reports destination.

It should support quick identification of successful deliveries, pending deliveries, and failed deliveries.

A failure should expose enough context to understand what requires action without exposing sensitive provider internals unnecessarily.

## 29. Export

Export is a first-class Data destination.

Preserve existing period selection, scope selection, dataset selection, CSV/PDF functionality that already exists, and protected download behavior.

Do not mix Export into unrelated School Settings.

## 30. Archives

Archives is a first-class Data destination.

It should support filtering or grouping by record type where useful.

Archived records should clearly expose Restore, permanent deletion eligibility, and dependency impact where deletion is requested.

Permanent deletion requires a dedicated confirmation workflow.

## 31. School Settings

School Settings should contain actual school configuration only.

Examples:

- English school name;
- Arabic school name;
- timezone;
- default language.

Do not use Settings as a dumping ground for Administrators, Archives, Export, or unrelated tools.

## 32. Legacy and Compatibility Routes

Existing legacy routes may remain temporarily for compatibility but must not define the new information architecture.

Examples include routes representing older concepts such as old Groups management entry points, old Settings subpages for Administrators or Archives, and old `My Groups` Teacher routes.

Where possible they should redirect to the canonical redesigned destination, remain out of primary navigation, and not create duplicated workflows.

No user should need to know both an old and new route for the same capability.

## 33. Copy and Explanatory Text

Reduce instructional paragraphs.

Prefer descriptive labels, meaningful statuses, concise contextual hints, actionable error messages, and Empty States.

Do not leave paragraphs floating between controls explaining behavior that should be obvious through the interaction itself.

All visible product copy must use `messages/en.json` and `messages/ar.json`.

Do not hardcode separate English/Arabic strings directly inside feature components.

Teacher-authored content remains untouched and is never automatically translated.

## 34. Accessibility

All components must support keyboard interaction.

Requirements include visible `:focus-visible`, semantic button/link usage, accessible menu behavior, accessible dialog focus trapping/restoration, associated form labels, accessible error messaging, sufficiently large hit targets, and no color-only status meaning.

Important actions must remain usable without a mouse.

## 35. RTL Requirements

The same component must work in both directions.

Use logical properties such as `margin-inline`, `padding-inline`, `inset-inline`, and `border-inline`.

Icons with directional meaning must mirror appropriately.

Icons without directional meaning must not be unnecessarily mirrored.

Menus, drawers, breadcrumbs, table alignment, and form actions must be inspected in Arabic rather than assumed correct.

## 36. Live Visual Baseline Gate

Source inspection alone is not sufficient evidence of UX quality.

Before the first broad product propagation, capture and inspect the actual application in English desktop, Arabic desktop, English narrow/mobile, and Arabic narrow/mobile.

At minimum inspect Dashboard, Students, Teachers, Teaching Assignments, Classes, Reports, Archives, This Week, and Weekly Update.

If production authentication cannot be safely used for this work, use a local or Preview environment with representative data.

Screenshots/visual inspection become part of the redesign verification record.

Tests passing do not substitute for this inspection.

## 37. Functional Reachability Audit

During migration to the new UI, verify that each existing capability is actually reachable and understandable.

Audit:

- Students;
- Guardians;
- Teachers;
- Administrators;
- Teacher login access;
- Teaching Assignments;
- Classes;
- Subjects;
- Groups;
- enrollment;
- weekly updates;
- teacher history;
- reports;
- bulk report sending;
- delivery status;
- exports;
- archives;
- restore;
- permanent deletion;
- School Settings.

A route or server function existing in source code is not sufficient.

The capability must be reachable through the intended interface.

## 38. Testing Strategy

Do not run the entire stack after every cosmetic edit.

### During component-system development

Run focused component/unit tests and lint/typecheck as appropriate.

### During one-page workflow work

Run relevant unit/component tests and targeted Playwright workflow.

### Database/RLS changes

Only when database behavior changes, run targeted real PostgreSQL/RLS tests.

### Teaching Assignment work

Run only the relevant domain/unit tests, assignment PostgreSQL tests, and assignment browser workflow.

### Meaningful milestones

Run lint, typecheck, unit/contract suite, relevant database suite, and relevant browser suite.

### Before merge/release

Mandatory:

- full lint;
- full typecheck;
- full unit/contract suite;
- production build;
- full PostgreSQL/RLS suite;
- full E2E;
- English visual smoke;
- Arabic RTL visual smoke;
- desktop smoke;
- narrow/mobile smoke.

Full E2E remains mandatory before release, but not on every small visual commit.

## 39. Git Workflow

Use one feature branch for the entire redesign:

`codex/full-website-ux-redesign`

Do not create a branch for every page.

Use logical commits representing meaningful milestones, for example:

- design system foundation;
- application shell;
- Teaching Assignments reference workflow;
- People workflows;
- School workflows;
- Teacher workflows;
- Reports/Data workflows;
- final consistency/audit work.

Do not merge partial UX work to `main`.

Do not deploy incomplete redesign work to production.

Preview deployment may be used for visual verification.

Production remains on the current stable release until the entire redesign passes the final release gate and explicit production release is authorized.

## 40. Expected Backend Changes

This project is primarily a frontend/interaction redesign.

Do not create migrations merely to support visual changes.

Backend changes are justified only for verified functional gaps.

Known likely non-visual work includes:

### Teaching Assignment deletion

Provide a proper Administrator operation to delete an unused assignment when protected history does not depend on it.

Deletion must remain school-scoped and authorization-protected.

### Teaching Assignment error classification

Replace the current generic failure mapping with meaningful domain outcomes for invalid dates, overlap, protected history, not found/authorization, and unexpected failure.

These changes should reuse the existing repository/service architecture.

No broad backend rewrite is authorized.

## 41. Implementation Sequence

After this specification is approved, write a detailed implementation plan using the following order.

### Milestone 1 — Foundation

- establish tokens;
- establish component primitives;
- normalize global styling;
- build internal component reference;
- verify EN/AR desktop/mobile.

### Milestone 2 — Application shell

- Administrator sidebar;
- Teacher-only navigation;
- dual-capability navigation;
- mobile drawer;
- utility controls.

### Milestone 3 — Teaching Assignments reference workflow

- focused layout;
- Tabs;
- Add Assignment dialog/drawer;
- Edit state;
- End;
- real Delete;
- typed errors;
- overlap handling.

This becomes the reference CRUD interaction for later Administrator work.

### Milestone 4 — People

- Students;
- Guardians;
- Teachers;
- Administrators;
- Teacher access;
- enrollment.

### Milestone 5 — School structure

- Classes;
- Subjects;
- Groups;
- coverage links into Teaching Assignments.

### Milestone 6 — Teacher workflows

- This Week;
- Weekly Update;
- History;
- My Profile.

### Milestone 7 — Reports and Data

- Reports workflow;
- Delivery status;
- Export;
- Archives;
- deletion impact/restore.

### Milestone 8 — Settings and legacy cleanup

- School Settings;
- canonical redirects;
- remove duplicated navigation/workflows.

### Milestone 9 — Whole-product audit

- capability reachability;
- copy consistency;
- status consistency;
- responsive behavior;
- RTL;
- accessibility;
- destructive-action consistency.

### Milestone 10 — Release verification

- full quality suite;
- full DB/RLS;
- full E2E;
- visual production-equivalent smoke;
- Vercel Preview verification;
- release only after explicit authorization.

## 42. Out of Scope

This redesign must not become an excuse to add unrelated features.

Out of scope unless separately approved:

- parent portal;
- student accounts;
- LMS features;
- chat;
- payments;
- homework;
- online registration;
- new analytics platform;
- AI-generated content;
- additional languages;
- multi-school management UI;
- large generic CRUD framework;
- complete component-library import;
- unnecessary database redesign.

## 43. Definition of Done

The redesign is complete only when all of the following are true:

1. The application uses one recognizable design and interaction language.
2. Major Administrator capabilities are directly discoverable from navigation.
3. Teacher-only users receive a small focused product.
4. Dual-capability users can access both surfaces without role switching.
5. List pages no longer expose excessive row actions.
6. Record viewing and editing are visibly distinct.
7. Destructive actions are separated and predictable.
8. Teaching Assignments supports true Add, Edit, End, and Delete workflows.
9. Assignment errors accurately identify the underlying problem.
10. Classes, Subjects, Groups, enrollment, Teacher access, reports, exports, archives, and deletion workflows remain reachable.
11. Important actions are not hidden in Settings or obscure routes.
12. English and Arabic use the same reusable component system.
13. Teacher workflows work at approximately 360px.
14. Desktop Administrator workflows remain efficient.
15. Relevant unit/component/browser/database tests pass.
16. Full release suites pass before merge.
17. Actual screens have been visually inspected in both LTR and RTL.
18. Production is not changed until final release authorization.
