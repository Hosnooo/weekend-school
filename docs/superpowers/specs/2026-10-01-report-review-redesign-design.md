# Report Review, Admin Editing, and Bilingual Delivery Redesign

Date: 2026-10-01
Revision: 2 — simplified Admin editing, email-only review, per-subject attendance
Branch: `design/report-page-simplification`
Base: `main` at `4b80b4b38a451629acd901e9be158a78bf04bcba`

## Goal

Keep the Class Report Cycle simple and familiar while giving Admin full control over what parents receive.

The active Report Cycle workspace should have only the controls Admin actually needs:

1. inspect included Teaching Updates;
2. edit the report directly in a Teacher-familiar layout;
3. review the exact parent email for a selected student;
4. finalize;
5. send.

There should be no redundant standalone report preview and no hidden `Open report` layer that makes Admin hunt for editable fields.

This revision preserves the already-approved bilingual delivery model, multiline rendering, one-report-per-student delivery, guardian-language simplification, and Performance disabled by default.

## User-facing principles

1. The page is not a wizard.
2. Report editing is the primary workspace, not a secondary collapsed step.
3. The Admin editor should closely mirror the Teacher Teaching Update form.
4. The parent-email review is read-only and is the only preview needed in the active Class Report Cycle.
5. Admin changes report data in the editor, never inside the email preview.
6. Finalization freezes the reviewed values into immutable report snapshots.
7. A finalized unsent cycle may be reopened for editing; sent/delivered revisions remain immutable.
8. Keep the UI visually consistent with the existing application and avoid broad layout/CSS changes.

## UI restraint and implementation guardrails

- Reuse existing Teacher/Admin form controls, spacing, cards, buttons, labels, and responsive behavior.
- Keep everything on the existing Class Report Cycle workspace page.
- Do not add another wizard, tab system, preview page, or navigation concept.
- Remove duplicate preview controls rather than adding more controls.
- Keep source details secondary/collapsible.
- Keep only the uncommon per-student full-report-text override collapsed.
- Do not hide the normal Admin report editor inside a collapsed `Open report` control.
- Avoid broad CSS changes.
- Do not redesign unrelated Teacher, Guardian, Student, navigation, or general attendance-management surfaces.
- GitHub Actions remain manual-only and are not required for this work.

## Current problems being corrected

### Redundant previewing

The current Class Report Cycle shows both a Student Report preview and a Parent Email preview. Because the parent email already contains the rendered student report, the standalone report preview adds duplication without helping the send decision.

### Report editing is hidden

After reopening a finalized report, Admin can technically edit it, but the actual fields are hidden inside collapsed subject cards under `Open report`. This makes `Edit report` feel like it did nothing.

### Student email selection is visually heavy

The current email preview uses a row of student buttons. This becomes noisy as class size grows. A single student selector is more appropriate.

### Attendance is difficult to understand for a reporting period

The current report derives Present / Absent / Sessions from Teaching Update attendance observations. For a custom report period, Admin needs a simpler report-level metric per subject:

`Attended X out of Y sessions`.

The source attendance should still provide the initial values, but Admin must be able to correct the report-level counts before finalization.

## Class Report Cycle workspace

The page remains one freely accessible workspace.

### 1. Teaching Updates / Sources

Keep the existing source section:

- included/excluded submitted Teaching Updates;
- teacher;
- subject/group;
- covered dates;
- partial-overlap warning;
- request missing update;
- expandable submitted source details.

Teaching Updates remain source/reference data. Admin edits the official report without changing the teacher's submitted record.

### 2. Report Edit

The report editor is fully visible on the page whenever the batch is editable.

Do not wrap each normal subject editor inside an `Open report` disclosure.

Each subject or subject-group context appears as a normal report section/card containing:

#### Shared report fields

- Main report — English;
- Main report — Arabic, RTL;
- optional Performance controls only when the template enables Performance;
- student rows.

The shared English/Arabic report starts from the included submitted Teaching Updates. Admin can correct, rewrite, combine, or remove either language independently.

Multiline content must preserve line breaks through storage, email review, finalization, and delivery.

#### Student rows

For every student participating in that subject/context, show the normal report controls directly:

- student name;
- attendance: `Attended [number] out of [number] sessions`;
- Performance override only when Performance is enabled;
- individual English comment when comments are enabled;
- individual Arabic comment when comments are enabled.

The layout should reuse the Teacher form's familiar student-row treatment as closely as practical.

The only collapsed student control is `Customize report text`, which exposes optional student-specific:

- Main report — English;
- Main report — Arabic;
- clear/reset-to-shared behavior.

If the student-specific main report is blank, the student inherits the shared subject report.

### Reopen & edit behavior

When a finalized unsent cycle can be changed, the action label should be clear: `Reopen & edit`.

After the action succeeds:

- the batch returns to editable state;
- the full Report Edit panel is immediately visible;
- show a lightweight editing-state notice if useful;
- do not require Admin to open hidden report cards before seeing the fields.

If protected delivery exists, keep the current safety rule and do not allow silent mutation of the sent revision.

## Per-subject attendance model

Attendance is report-level, per student, per subject/context.

Example for one student:

- Quran: `7 of 8 sessions`;
- Arabic: `5 of 6 sessions`.

### Source-derived default

When review data is first created, derive the initial attendance pair from the included Teaching Update attendance observations for that student and subject/context.

The existing attendance history remains the source/audit trail. The report editor does not rewrite those teacher observations.

### Admin-approved override

Admin can edit both values:

- attended sessions;
- total sessions.

Persist these as nullable report overrides keyed by the existing report approval + student relationship, alongside the existing progress/comment/performance overrides.

Recommended schema extension on `report_student_overrides`:

- `attendance_attended integer null`;
- `attendance_total integer null`.

No new major table is needed.

### Effective attendance rule

For each student + subject/context:

1. if an Admin attendance override exists, use it;
2. otherwise use the source-derived attendance pair.

The finalized V2 snapshot stores the effective pair so later email delivery does not depend on live Teaching Update data.

The V2 report section may continue to use an internal attendance object, but parent-facing rendering should present only the approved metric:

`Attendance: X of Y sessions`

Do not display separate Present / Absent / Sessions chips in the new active Class Report Cycle email.

### Validation

Attendance values must be whole numbers and satisfy:

- `total >= 0`;
- `attended >= 0`;
- `attended <= total`.

If there is no usable derived attendance and Admin has not supplied a valid pair, finalization should clearly identify that student's subject attendance as needing review.

If source attendance observations disagree but Admin explicitly supplies a valid attended/total pair, that report-level pair is authoritative for the report and may be finalized without changing the underlying attendance records. Attendance-record conflict resolution remains a separate audit/data-quality concern.

## 3. Email Review

This is the only preview in the active Class Report Cycle workspace.

Remove the standalone Student Report preview from this page.

### Student selector

Use one compact student dropdown rather than one button per student.

The selected student determines which email is shown.

A simple server-driven selector is sufficient; it does not need a new state framework. It may use a GET selection action with a small `Show email` control if that best matches existing patterns.

### Read-only exact email

Email Review shows:

- selected student;
- recipient email address(es);
- exact subject;
- exact email body.

It is not editable.

The body must be rendered through the same email rendering path used by real delivery, including:

- email greeting/message;
- embedded student report content;
- bilingual LTR/RTL blocks;
- per-subject approved attendance;
- comments;
- closing/sign-off;
- preserved line breaks.

If Admin wants to change what the preview shows, Admin edits the Report Edit fields or report template, saves, then reviews the resulting email.

Before finalization the email review uses a live snapshot built from saved review data.

After finalization it uses the frozen `reports.snapshot_json` that will be sent.

There must not be separate duplicated email-preview markup.

## 4. Finalize & Send

Keep Finalize and Send immediately below/with Email Review on the same page.

Before finalization:

- Email Review remains available;
- show clear blocking validation if present;
- show `Finalize reports`.

After finalization:

- Email Review remains available using the frozen snapshot;
- show `Reopen & edit` only when allowed;
- show `Send reports`;
- keep delivery status/history access.

Do not reintroduce a separate report-preview stage.

## Content-driven bilingual model

The existing Revision 1 behavior remains:

- one report snapshot per student for a Class Report Cycle;
- newly generated content-driven reports use `reports.language = 'both'` as a compatibility marker;
- guardian `report_language` does not control generation or delivery;
- all active linked guardians with `receives_reports = true` receive the same student report;
- English-only content renders English only;
- Arabic-only content renders Arabic only;
- when both exist, render separate directional blocks;
- never manufacture missing translated content;
- preserve historical report behavior.

Narrative English uses LTR and Arabic uses RTL.

## Template behavior

Keep the existing symmetric bilingual template rules:

- main report label: at least one language;
- email subject: at least one language;
- Performance label required only when Performance is enabled;
- student-comment label required only when comments are enabled;
- optional intro/help/closing/email copy may be independently blank.

Performance remains disabled by default.

## Data model and persistence

Continue using:

- `report_batches`;
- `report_section_approvals`;
- `report_section_sources`;
- `report_student_overrides`;
- `reports.snapshot_json`;
- `email_deliveries`.

Extend `report_student_overrides` with the two nullable attendance override fields rather than creating a new report-content table.

Saving a report context persists:

- shared report EN/AR;
- per-student report EN/AR override;
- per-student attended/total override;
- optional Performance override;
- per-student EN/AR comments.

Changing source inclusion must not silently overwrite Admin-edited report text or attendance overrides.

`Rebuild from selected sources` may refresh shared report text and source-derived defaults, but must preserve explicit student overrides unless the Admin deliberately clears them.

## Multiline rendering

Keep the already-approved safe behavior:

- escape user text;
- preserve line breaks in browser/email rendering;
- do not insert raw unescaped user content;
- reuse the same helpers across report and email content.

## Error handling

Finalization must be blocked when:

- no report content can be built;
- required bilingual template pairs are both empty;
- a student/subject has no valid effective attendance pair;
- another required report-context value is missing.

An unresolved source attendance disagreement by itself does not block finalization when Admin has explicitly supplied a valid report-level attended/total pair.

Save failures must not silently erase entered text or attendance values.

Delivery failures keep the finalized immutable snapshot and remain retryable.

## Compatibility

- Historical V1 and already-finalized V2 snapshots are not rewritten.
- Historical report preview/detail routes may remain for archive/history use; this change removes the redundant standalone report preview only from the active Class Report Cycle workspace.
- Existing Teaching Update attendance records are not rewritten when Admin edits report-level attendance.
- Existing guardian language data remains stored but ignored for new Class Report Cycle delivery.
- Existing subject/group historical report workflow remains compatible unless separately consolidated later.

## Testing strategy

Use TDD during implementation.

### UI/contract tests

Verify:

- normal Report Edit fields are visible without `Open report` disclosures;
- Admin editor follows the Teacher-style shared-report + students structure;
- per-student full-report override remains collapsed;
- no standalone Student Report preview appears in the Class Report Cycle workspace;
- Email Review is the only preview;
- student email selection uses one dropdown rather than a row of student buttons;
- Email Review is read-only;
- `Reopen & edit` returns immediately to visible editing controls;
- Performance remains absent by default;
- no unrelated navigation/layout redesign occurs.

### Attendance tests

Verify:

- source-derived attended/total values prefill report review;
- Admin may override attended and total independently;
- `attended > total` is rejected;
- negative/non-integer values are rejected;
- explicit override wins over source-derived attendance;
- absent override falls back to source-derived attendance;
- source conflict with a valid explicit aggregate override can finalize;
- finalized snapshot freezes effective attendance per subject;
- parent email renders `X of Y sessions` and does not show redundant Present/Absent/Sessions chips.

### Email tests

Verify:

- dropdown-selected student controls the previewed email;
- preview recipients match real delivery recipients;
- preview subject equals delivery subject;
- preview HTML uses the same renderer used by delivery;
- EN-only, AR-only, and bilingual content still work;
- multiline content remains preserved.

### Regression tests

Retain coverage for:

- one report per student;
- all active receiving guardians receive it;
- guardian language preference is ignored for new delivery;
- Performance defaults off;
- source inclusion does not overwrite Admin edits;
- historical snapshots remain readable;
- finalized sent reports remain immutable.

## Out of scope

- Rewriting historical sent reports.
- Deleting `guardian.report_language` from the database.
- Rewriting underlying Teaching Update attendance records from report-level attendance edits.
- Replacing the email provider.
- Changing Teacher permission boundaries.
- Broad visual redesign or a new design system.
- Adding a multi-step reporting wizard.

## Success criteria

The revision is complete when Admin opens a Class Report Cycle and immediately has a fully accessible Teacher-familiar Report Edit panel for every subject/context; can edit each student's subject attendance as `attended out of total sessions`; can choose one student from a dropdown and review the exact read-only parent email; sees no redundant standalone report preview; can clearly `Reopen & edit` an unsent finalized cycle; can finalize and send from the same page; and all existing bilingual, multiline, recipient, immutability, and Performance-default behavior remains intact without making the UI heavier or redesigning unrelated parts of the application.
