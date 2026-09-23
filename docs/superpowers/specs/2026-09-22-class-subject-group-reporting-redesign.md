# Class, subject, group, and reporting architecture redesign

**Status:** Approved conversational design on 2026-09-22; written-spec review pending before implementation planning.

This document replaces the earlier one-primary-teacher / one-global-group assumptions for the next architecture correction. It is intentionally written before implementation. After written approval, `docs/SPEC.md` and `docs/DECISIONS.md` must be updated to make these rules authoritative, then a separate implementation plan must be written before code changes begin.

## 1. Intent and success criteria

The school application must model the way MCE Weekend School actually operates while keeping the teacher and admin interfaces simpler than the current Phase 1 UI.

The required organizational model is:

`Class -> Subject -> optional Group`

A Class is the student's main cohort. Subjects are applied to a Class. A Class Subject may be taught as one whole class or divided into Groups. There are no subgroups.

The redesign succeeds when:

- each student has one active Class at a time;
- all active Subjects attached to that Class apply automatically unless the student is explicitly excluded;
- a grouped Subject places a participating student in at most one active Group for that Subject;
- teachers can teach many Classes, Subjects, and Groups;
- multiple teachers can teach the same Subject or the same Group without a primary-teacher restriction;
- teachers submit independent weekly updates;
- admins see co-teacher submissions collected together and choose what becomes the official parent-facing report content;
- attendance uses only Present and Absent;
- reports can cover one week, several weeks, a month, or a custom period;
- reports can be prepared by Class, Subject, or Group scope;
- shared report content is approved once and reused, with optional student-specific comments or overrides;
- parent reports do not show teacher names and are authored as MCE Weekend School;
- the UI is reorganized around real school tasks, with clearer hierarchy, colors, fonts, buttons, forms, RTL, and mobile teacher workflows;
- archived data can be restored or permanently deleted, and admins can export existing data for a selected period before deletion or at any other time;
- all changes remain school-scoped, server-authorized, RLS-protected, bilingual, and forward-migrated.

## 2. Chosen architecture

Use explicit first-class concepts instead of reinterpreting the current `groups` table or introducing a generic arbitrary learning-unit tree.

### 2.1 Core entities

#### Class

The student's main cohort, for example Class 5 or Class 6.

A student may have only one active Class enrollment at a time. Historical Class enrollment must be preserved until explicitly permanently deleted through the archive workflow.

#### Subject

A reusable school subject, for example Quran, Arabic, or Islamic Studies.

Subjects are reusable across Classes.

#### Class Subject

A school-scoped association between one Class and one Subject, for example "Quran in Class 5".

This is the operational teaching context above Groups. It owns configuration such as whether the Subject currently uses Groups and the default Group when grouping is enabled.

#### Group

An optional child of exactly one Class Subject.

"Group A" under Class 5 Quran is distinct from "Group A" under Class 5 Arabic.

A Class Subject may have zero Groups. Zero Groups means the participating students are taught together as a whole Class Subject. The system must not create an artificial "All" Group record merely to represent whole-class teaching.

There are no subgroups.

## 3. Student enrollment and subject participation

### 3.1 One active Class

Each student has exactly one active Class at a time.

Changing Class is a historical transition, not an overwrite. The prior Class enrollment ends and the new Class enrollment begins. Past attendance, submissions, Group memberships, and finalized reports remain attached to the historical context unless explicitly permanently deleted later.

### 3.2 Automatic Subject participation

Every active Subject attached to the student's active Class applies automatically.

The database should store exceptions rather than requiring a duplicate enrollment row for every normal Subject participation when practical. A student may be explicitly excluded from a particular Class Subject.

An excluded student must not appear in that Subject's active teacher roster or receive that Subject in newly generated reports for the excluded period.

### 3.3 Grouped Subjects

For a participating student in a Class Subject that uses Groups:

- the student may have at most one active Group in that Class Subject;
- Group membership is historical and date-aware;
- moving Group ends the previous membership and starts the next one;
- the same student may simultaneously be in different Groups for different Subjects, for example Quran Group A and Arabic Group B.

The old rule that one student may have only one Group globally is removed.

### 3.4 Default Group

When the first Group is created for a Class Subject, it becomes the default Group automatically.

The admin may later designate a different Group as default.

Changing the default does not move existing students. It affects only new or currently unassigned participating students.

When an existing whole-class Subject is changed to grouped mode, the UI must explicitly ask how to initialize current students. It must support:

- assigning all current participating students to the default Group; or
- reviewing assignments before enabling the grouped workflow.

When grouped mode is removed, historical Group memberships remain historical. Current students return to whole-Class-Subject participation.

## 4. Teacher assignments

### 4.1 Assignment scopes

A teacher may be assigned to either:

1. the whole Class Subject; or
2. one specific Group belonging to that Class Subject.

A whole-Class-Subject assignment covers all current Groups in that Subject and also covers whole-class teaching when the Subject has no Groups.

A Group assignment covers only that Group.

Assignments are additive. A Group-level teacher does not replace a Class-Subject-level teacher.

### 4.2 Cardinality

Do not impose business cardinality restrictions that prevent legitimate school operation.

- one teacher may teach many Classes;
- one teacher may teach many Subjects;
- one teacher may teach many Groups;
- one Class Subject may have many teachers;
- one Group may have many teachers;
- multiple teachers may teach the same Group for the same Subject.

There is no `PRIMARY` / `ASSISTANT` teaching concept and no primary-teacher conflict.

The system should prevent only duplicate identical active assignments.

### 4.3 Assignment history

Teacher assignments should have effective start/end history rather than being destructive replacements when they have been used.

An inactive or archived teacher cannot create new submissions, but their historical submissions remain internally attributable until explicitly permanently deleted.

## 5. Teacher workflow

Teacher-facing UI must be substantially simpler than admin configuration UI.

The primary landing page is **My Teaching**.

Each card represents one teaching context, for example:

- Quran — Class 5 — Group A
- Arabic — Class 6 — Whole class

The card should show the relevant student count, current-week status, and a prominent **Enter weekly update** or **Continue** action.

Teachers should not see admin configuration controls.

## 6. Weekly teaching submissions

### 6.1 Submission identity

Teachers submit independently.

A weekly submission is associated with:

- school;
- Class Subject;
- optional Group;
- submitting teacher;
- reporting week / teaching occurrence identity.

The current uniqueness rule of one session per Group/date must be replaced. Multiple teachers may submit for the same Class Subject / Group / week without overwriting or blocking one another.

A teacher may have at most one logical submission for their own teaching context and week, with revision history if post-submission editing is later allowed.

### 6.2 Submission content

The common case is optimized around shared content:

- one shared progress/update text for the whole teaching context;
- Present/Absent attendance entry;
- optional default performance value;
- optional student-specific performance override;
- optional student-specific comment or progress override.

Most students should require no individual typing.

Advanced student-specific controls should remain collapsed until needed.

### 6.3 Draft and submitted states

A teacher can keep a submission as Draft and later Submit it.

Submitted content must be historically traceable. If a submitted record can be edited, the implementation must preserve revision information rather than silently replacing past content.

## 7. Attendance

Attendance has exactly two statuses:

- `PRESENT`
- `ABSENT`

No Late or Excused state is part of the product.

The teacher UX should support **Mark all Present**, then allow the teacher to change exceptions to Absent.

### 7.1 Multi-teacher attendance

Independent teacher submissions must not inflate attendance counts.

For the same student and teaching occurrence, the school needs one effective attendance result.

Teacher observations remain internally attributable. If co-teachers agree, the effective result is straightforward. If they disagree, the admin receives an attendance conflict and chooses the official Present/Absent value.

Reports use the official effective attendance result, never a double count of teacher observations.

## 8. Admin aggregation of teacher submissions

The admin sees teacher submissions grouped by teaching context and period rather than as unrelated rows.

Example:

`Class 5 -> Quran -> Group A -> Week of Sept 21`

- Ahmed — Submitted
- Omar — Submitted
- Attendance — 1 conflict
- Personalized student comments — 3

Teacher names remain visible internally for accountability.

Teachers do not edit one another's submissions.

## 9. Reporting periods and scopes

Do not create separate "weekly report" and "monthly report" products.

A report uses a start date and end date. The admin may choose presets such as:

- This week
- Last week
- This month
- Last month
- Custom period

A monthly report is an aggregation of weekly teaching records inside the selected period.

### 9.1 Report generation scope

The admin can begin report preparation from:

- **Class** — produce one report per selected student containing all selected applicable Subjects;
- **Subject** — report only that Class Subject for participating students;
- **Group** — report only that Subject/Group for students relevant to that Group.

This is a batch-selection mechanism. The final parent-facing report remains an individual student's report.

## 10. Reusable report content

The reporting system must be optimized for repeated wording.

Separate these concepts:

### 10.1 School template

Reusable presentation and standard wording, including:

- MCE Weekend School text branding;
- report heading;
- optional introduction;
- optional closing;
- standard section labels and layout.

No logo is required for now.

### 10.2 Subject template

Optional reusable Subject-specific wording for Quran, Arabic, Islamic Studies, and other Subjects.

### 10.3 Approved period content

Actual instructional progress for the selected reporting period, derived from teacher submissions and approved by the admin.

This is approved once per reporting context and reused for all applicable students unless an individual override exists.

### 10.4 Student-specific content

Optional content only where needed, such as:

- personalized comment;
- performance override;
- personalized progress wording.

The design goal is that most students can be reported without individual editing.

## 11. Admin report composer

For each reporting context, the admin sees all relevant teacher submissions and may:

- use one teacher's submitted text as-is;
- include multiple teacher submissions;
- edit/combine submitted text into one official summary;
- ignore a submission;
- write entirely new official wording while using submissions as reference.

Teacher-authored source material remains stored internally.

The parent-facing report does not identify individual teachers.

The official author/source shown to parents is **MCE Weekend School**.

### 11.1 Batch-first review

The admin should approve shared content once rather than once per student.

Example:

- Quran Group A — approved September progress
- apply to all 18 applicable students
- then review only students with personalized exceptions

The report batch screen should emphasize readiness and exceptions, for example:

- 20 ready automatically
- 3 have personalized comments
- 1 has an attendance conflict

## 12. Attendance and performance in reports

Attendance is derived from official Present/Absent results for the selected period.

A one-week report may show Present or Absent. A longer report may show counts such as Present: 3, Absent: 1.

Performance is Subject-specific. Do not derive one overall student performance from the last arbitrary session.

When co-teachers submit different performance values, the admin sees the alternatives and chooses or edits the official parent-facing result.

## 13. Report finalization and immutability

Report workflow:

`Draft -> Review -> Finalize -> Send`

Finalization creates an immutable snapshot of the exact parent-facing data used, including:

- student display data;
- Class label;
- Subject label;
- Group label when applicable;
- reporting period;
- approved progress wording;
- approved performance;
- attendance totals/results;
- personalized comments;
- school template wording;
- MCE Weekend School authorship.

Later edits to teachers, Classes, Subjects, Groups, templates, or submissions do not alter an already finalized report.

If correction is required, create a revised report/version instead of silently mutating the finalized snapshot.

## 14. UI and navigation redesign

The redesigned UI must feel simpler than the current app despite the richer model.

### 14.1 Main navigation

Use:

- Dashboard
- Classes
- Students
- Teachers
- Reports
- Settings

Subjects and Groups primarily live inside Classes rather than becoming separate top-level navigation sections.

### 14.2 Class page

The Class page is the main organizational admin screen.

A Class summary should show student and Subject counts. Each Subject card should make clear whether it is whole-class or grouped, its teachers, weekly submission status, and a direct route to its Groups/students/submissions/reports.

### 14.3 Visual language

No logo is required for now. Use **MCE Weekend School** as text branding.

Establish a coherent visual system with:

- one primary MCE brand color;
- light neutral backgrounds;
- high-contrast dark body text;
- muted borders;
- green only for success/submitted states;
- amber for pending/review states;
- red for errors/destructive actions;
- consistent spacing, card treatment, inputs, buttons, tables, dialogs, badges, and empty states.

Do not use excessive unrelated accent colors or decorative gradients.

### 14.4 Typography and bilingual layout

Use a modern readable English UI font such as Inter or an equivalent approved local stack, and a highly readable Arabic UI font such as Noto Sans Arabic or equivalent.

Arabic must be true RTL with logical spacing and direction-aware icons, not merely translated strings with right-aligned text.

Body text, labels, and controls should be easier to read than the current interface.

### 14.5 Buttons and forms

Primary actions such as Save, Submit weekly update, Generate reports, and Finalize must be visually obvious.

Secondary actions such as Edit, Preview, and Change group are quieter.

Archive/Delete actions are clearly destructive and separated from routine actions.

All form controls use shared styling with visible labels, clear borders, focus states, validation, and adequate contrast. Login, Forgot password, and Set password use the same shared auth form/input primitives so a white input cannot disappear against a white background.

### 14.6 Progressive disclosure

Only show configuration when it is relevant.

Examples:

- Group configuration appears only when a Class Subject is configured to use Groups;
- student-specific weekly fields remain collapsed until the teacher needs them;
- destructive explanations appear when a destructive action is chosen.

### 14.7 Cards versus tables

Use cards for:

- teacher My Teaching contexts;
- admin dashboard summaries;
- Class Subject summaries.

Use tables/lists for:

- students;
- teacher directory;
- attendance review;
- report batches;
- assignment administration.

### 14.8 Mobile teacher workflow

Teacher weekly-update and attendance flows remain mobile-first, including approximately 360px widths.

Use large tap targets, simple Present/Absent controls, no normal horizontal scrolling, and clear Save/Submit actions.

Admin-heavy configuration may be desktop-optimized while remaining usable on smaller screens.

## 15. Dashboard behavior

### 15.1 Teacher dashboard

Show actionable teaching contexts and current-week status only, such as Not started, Draft, or Submitted.

### 15.2 Admin dashboard

Focus on unresolved or useful work, for example:

- expected teacher updates / submitted updates;
- attendance conflicts;
- report batches ready for review;
- reports needing attention;
- unresolved Group assignment issues.

Do not fill the dashboard with statistics that do not lead to an action.

Until a timetable/schedule exists, expected weekly teacher updates are derived from active teaching assignments rather than invented meeting schedules.

## 16. Archive, restore, deletion, and history

### 16.1 Lifecycle

Supported lifecycle:

`Active -> Archived -> Restore OR Permanently Delete`

Archive removes the record from active school workflows while preserving it.

Archives must have their own management area and support:

- Restore
- View history/data
- Download/export data
- Permanently delete

### 16.2 Permanent deletion

The admin may permanently delete archived records even when they have history.

When confirmed, dependent historical data may be deleted as part of the operation. Examples include memberships, attendance, submissions, comments, reports, and delivery history associated with the deleted entity.

The operation must never be a silent database cascade hidden from the user. The UI must calculate and explain the impact before confirmation when meaningful history exists.

Example impact summary:

- 28 attendance records
- 12 weekly observations
- 4 finalized reports
- Class/Group history

The confirmation states that the operation cannot be undone.

This requirement intentionally supersedes the earlier product rule that historical school records are never hard-deleted.

### 16.3 Delete versus archive in active screens

Records created by mistake with no meaningful history may be permanently deleted directly when safe.

Records with active dependencies should normally be archived first or require those dependencies to be resolved.

For example, a Group with active students cannot be archived until those students are reassigned if the Subject continues using Groups.

## 17. Export and download

Admins need a general **Export Data** capability, not only a pre-delete download.

### 17.1 Export period

Support:

- This week
- Last week
- This month
- Last month
- Custom date range
- All available history

### 17.2 Export scope

Support:

- entire school;
- Class;
- Subject;
- Group;
- Student;
- Teacher.

### 17.3 Export content

Allow selection of applicable datasets, including:

- attendance;
- weekly teacher submissions/progress;
- student performance;
- personalized comments;
- reports;
- enrollment and Group history;
- teacher assignments.

### 17.4 Formats

Target:

- `.xlsx` for readable structured administrative export;
- optional CSV per dataset for portability;
- PDF for finalized parent reports;
- ZIP when bundling multiple datasets/reports.

A bulk export should not require the admin to download many files individually.

### 17.5 Export before deletion

Permanent-delete dialogs should prominently offer **Download data first**.

Export is optional rather than mandatory so test data can be deleted quickly when intended.

Only admins can perform school-wide or bulk exports. Generated downloads must be protected and temporary rather than public permanent URLs.

## 18. Security and permissions

### 18.1 Admin

An active admin may:

- manage Classes, Subjects, Groups, Students, Teachers, and assignments;
- review all teacher submissions;
- resolve attendance conflicts;
- prepare/approve/finalize/send reports;
- manage archives;
- export data;
- permanently delete archived data.

### 18.2 Teacher

An active teacher may:

- see only teaching contexts granted through active assignments;
- see only students relevant to those contexts;
- create/manage their own weekly submissions;
- record Present/Absent attendance for those contexts;
- add allowed student-specific observations;
- view their own historical submissions.

A teacher may not:

- manage school structure;
- assign teachers;
- move students between Classes or Groups;
- finalize/send official parent reports;
- run bulk school exports;
- permanently delete school records;
- edit another teacher's submission.

### 18.3 Teacher roster access

A whole-Class-Subject assignment grants access to all participating students in that Subject, including all Groups.

A Group-level assignment grants access only to participating students in that Group.

Explicitly excluded students do not appear in the active Subject roster.

### 18.4 School isolation

Every school-owned row remains explicitly school-scoped. Server authorization and PostgreSQL RLS are both required.

Users from one school must never read or mutate another school's Classes, Subjects, Groups, Students, Teachers, submissions, attendance, reports, archives, or exports.

### 18.5 Sensitive mutations

Server/database authorization must independently validate actions such as:

- teacher assignment changes;
- Class/Group moves;
- official attendance conflict resolution;
- report finalization/sending;
- exports;
- archive/restore/delete.

Browser input alone is never authoritative.

## 19. Teacher invitation and password recovery correction

The existing teacher invitation flow must be corrected for already-registered Auth emails.

Expected behavior:

- new email: create/invite access;
- existing compatible Auth account: safely reuse/link it where appropriate rather than blindly inviting again;
- never create duplicate school teacher profiles for the same intended person;
- surface a clear admin message instead of exposing an Auth `email_exists` failure.

Login, Forgot password, and Set password use consistent shared styling and safe provider error handling. Public signup remains disabled.

## 20. Forward-only migration strategy

Applied migrations remain immutable. Do not edit migrations 1-18.

Start the correction with migration 19 or later and split it into reviewable stages rather than one monolithic migration.

Recommended migration sequence:

1. Classes, Subjects, and Class Subjects;
2. Subject Groups and default-Group behavior;
3. student Class enrollment, Subject exclusions, and per-Subject Group membership;
4. teacher Class-Subject / Group assignments with history;
5. weekly teaching occurrences/submissions and Present/Absent attendance;
6. subject-aware reporting, admin-approved content, templates, and finalized snapshots;
7. archive/restore/permanent deletion and export support;
8. rewritten RLS and privileged functions for the new model.

The exact split may be refined in the implementation plan, but all production changes remain forward-only.

## 21. Existing production-data migration

The current hosted database has only minimal setup data and no meaningful student/session/report history at the time of this design, making this the preferred correction window.

Preserve existing setup data where it can be mapped without inventing facts.

Existing top-level `groups` may be migrated into Classes when the mapping is clear. Existing teacher assignments should be migrated only where the destination context is unambiguous.

Do not invent a Subject merely to make an old assignment fit silently. If Subject information is unknown, migrate the safe structural portion and require explicit admin configuration.

Never apply the development seed to hosted production.

## 22. Explicitly superseded assumptions

This redesign supersedes the following earlier assumptions and decisions where they conflict:

- one primary teacher per Group;
- `PRIMARY` versus `ASSISTANT` assignment behavior;
- forced teacher reassignment conflicts for occupied Groups;
- one effective current Group per student across the whole school;
- one session per `(school, group, date)`;
- report aggregation that is not Subject-aware;
- teacher history/authorization based only on current broad Group assignment;
- the generic self-referencing subgroup direction as a future product model;
- the blanket rule that historical records can never be permanently deleted;
- the earlier Phase 2 CSV contract that assumes one initial global Group;
- the earlier Phase 3 report-template contract that lacks admin-selected/co-teacher source content and per-student official overrides.

The implementation must add a new dated decision entry rather than rewriting old accepted decisions such as D-007, D-008, D-011, D-014, D-017, D-023, and D-024 in place.

## 23. Testing requirements

Use TDD for business rules, authorization helpers, validation, and regressions.

### 23.1 Database/integration coverage

At minimum verify:

- one student cannot have two active Classes;
- a student participates in multiple Subjects in their Class;
- exclusions remove a student from a Subject's active participation;
- a student cannot have two active Groups in the same Class Subject;
- the same student may be in different Groups for different Subjects;
- Subjects with zero Groups work as whole-class Subjects;
- first Group becomes default;
- changing default does not move existing students;
- multiple teachers may share the same Class Subject;
- multiple teachers may share the same Group;
- one teacher may hold many teaching assignments;
- co-teachers can submit independently for the same week/context;
- duplicate identical active teacher assignment is rejected;
- attendance has only Present/Absent;
- conflicting teacher attendance observations require one official resolution;
- inactive/archived teachers cannot create new submissions;
- archived students do not appear in active rosters;
- school A cannot access school B data;
- finalized report snapshots do not mutate when source records later change;
- permanent deletion removes the data described by its confirmed impact scope.

### 23.2 Application/browser coverage

At minimum cover:

- create Class and attach Subjects;
- whole-class Subject;
- grouped Subject and default Group;
- assign several teachers to the same Subject/Group;
- create student with automatic Subjects/default Groups;
- exclude a student from a Subject;
- move a student between Groups;
- change a student's Class;
- first teacher submission;
- second co-teacher submission for the same context/week;
- Present/Absent attendance;
- attendance conflict and admin resolution;
- weekly report preparation;
- multi-week/monthly report preparation;
- Class, Subject, and Group reporting scopes;
- admin source selection/custom report wording;
- student-specific exception handling;
- finalization immutability;
- archive, restore, permanent delete;
- period/scoped export;
- teacher invitation with an already-registered email;
- Forgot password and Set password visual/behavior regression;
- English LTR and Arabic RTL for changed critical workflows;
- 360px teacher workflows.

## 24. UI error handling

Do not expose raw database constraint errors to normal users.

Examples of useful messages:

- "This teacher already has access to all Quran Groups through a whole-subject assignment."
- "Group A cannot be archived while 12 active students are assigned to it."
- "Attendance differs between two teacher submissions and needs admin review."

Empty states should explain the next action and provide a direct action button where appropriate.

## 25. Release gate and rollout

Do not begin the CSV phase against the old architecture.

Implementation sequence after this written spec is approved:

1. update product source-of-truth and decision records;
2. write and approve the implementation plan;
3. implement in an isolated feature branch with TDD;
4. apply changes to a local/reset database first;
5. run database/RLS and browser verification;
6. pass `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` as applicable to the release gate;
7. deploy a Vercel preview and manually smoke-test the redesigned English/Arabic workflows;
8. apply forward-only hosted Supabase migrations before deploying code that requires them;
9. deploy production;
10. verify critical hosted RLS/auth/browser workflows;
11. only then treat corrected Phase 1 as complete and redesign Phase 2 CSV against this model.

Production migration and deployment order must avoid serving application code that depends on schema not yet present.

## 26. Phase 2 implications

The later CSV import must be redesigned around:

`Student -> one Class -> automatic Class Subjects -> optional Subject exclusions -> default Group per grouped Subject`

It must not revive the old single-global-Group assumption.

The detailed CSV format remains a separate design/plan after the corrected architecture is released.

## 27. Non-goals for this correction

Do not add the following unless separately approved:

- subgroups;
- arbitrary nested learning-unit trees;
- a timetable/scheduling engine;
- teacher names in parent-facing reports;
- public self-signup;
- a parent portal;
- automatic AI rewriting/translation of teacher content;
- a logo requirement;
- microservices, GraphQL, queues, or event buses.

The product should keep clean extension points without speculative implementation.
