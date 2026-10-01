# Report Review, Admin Editing, and Bilingual Delivery Redesign

Date: 2026-10-01
Branch: `design/report-review-redesign`
Base: `main` at `cce1821558253c33739f7c57ad6ef51019f881b7`

## Goal

Redesign the Class Report Cycle review flow so an Admin can inspect submitted Teaching Updates, edit the shared report content in a UI that mirrors the Teacher editor, optionally override any individual student's report, preview the exact parent email from the same data that will be sent, finalize the reports, and send them from one coherent workspace.

The redesign also fixes multiline rendering, makes English/Arabic delivery content-driven instead of guardian-preference-driven, and disables Performance by default.

## User-facing principles

1. The report workspace is not a rigid wizard. Admin can open sources, edit report content, inspect any student, and preview any student at any time before finalization.
2. The Admin editor should use the same mental model as the Teacher Teaching Update editor: shared report fields first, then student-level exceptions.
3. The parent-email preview is read-only. Admin edits source/report/template fields; the preview always reflects those values.
4. Finalization freezes the current reviewed content. Before finalization the preview is live; after finalization it represents the frozen sendable snapshot.
5. Sent report revisions are immutable. An unsent finalized batch may be reopened; a batch with protected delivery history may not be silently altered.

## Current problems being addressed

### Multiline content is visually collapsed

Report text is escaped and inserted into ordinary HTML paragraphs, so newline characters entered by teachers/admins are collapsed by HTML rendering. The actual report body therefore does not reliably preserve Enter/new-line formatting in preview or email.

### Arabic/bilingual rendering is not structurally bilingual

The current V2 renderer selects a report language and, for `both`, joins English and Arabic inline with ` / `. This gives poor directionality and makes bilingual content difficult to read.

### Parent email preview is not the actual parent email

The current report preview renders the report document only. Delivery later wraps that report in separate email subject/greeting/message/closing/sign-off content. Admin therefore cannot see the complete deliverable before sending.

### Class Report Cycles bypass Admin report editing

The existing subject/group Admin report workspace can edit main English/Arabic content and student data. The newer Class Report Cycle branch instead goes from source selection directly to generating reports, so the existing Admin editing ability is not exposed in the workflow users actually use.

### Guardian language preference drives duplicate report generation

Current report finalization generates report snapshots according to linked guardians' `report_language`, and delivery selects recipients whose preference matches each generated report language. This is more complicated than the intended school behavior.

### Performance is on by default

Both the default report-template configuration and the database default currently enable Performance. The desired default is off.

## New Class Report Cycle workspace

The Class Report Cycle remains one page with freely accessible sections rather than a required sequence.

### 1. Teaching Updates / Sources

Keep the current source-selection behavior, including:

- include/exclude source;
- teacher name;
- subject/group context;
- coverage period/dates;
- partial-overlap warnings;
- request missing Teaching Update.

Add an expandable read-only source detail showing the actual submitted Teaching Update content so Admin can inspect the material feeding the report without leaving the workspace.

Sources remain reference/input data. Admin edits the official report composition, not the original submitted Teaching Update.

### 2. Report Review & Edit

Each report context (subject or subject-group) has an `Open report` review area. The editing layout mirrors the Teacher Teaching Update editor.

#### Shared report content

Show:

- Main report — English textarea;
- Main report — Arabic textarea with RTL direction;
- optional Performance section only when enabled by the active report template;
- student list.

The initial shared report text comes from the selected submitted Teaching Update sources through the existing approval/composition model.

Admin can correct, rewrite, combine, or remove either language independently.

All multiline fields preserve entered line breaks through save, preview, finalized report rendering, and email rendering.

#### Student rows

Each student row shows:

- student name;
- attendance summary (read-only during normal report review);
- existing attendance-conflict resolution UI when a conflict requires Admin action;
- Performance override only if Performance is enabled;
- individual English comment when student comments are enabled;
- individual Arabic comment when student comments are enabled.

Each student also has a collapsed `Customize report text` control. Opening it exposes:

- student-specific Main report — English;
- student-specific Main report — Arabic;
- a way to clear the override and return to the shared report.

If no student-specific report text is provided, the student inherits the shared report text for that subject/context.

This uses the existing `report_student_overrides.progress_en` and `progress_ar` fields rather than adding another report-content table.

### 3. Student preview

Admin can select any student at any time once report content exists.

The preview area offers two views:

- Student Report;
- Parent Email.

Before finalization, both are live previews generated from the currently saved review data.

After finalization, both use the frozen report snapshot that will be delivered.

No separate mandatory Preview stage exists.

### 4. Finalize & Send

The same workspace contains the finalization/sending area and keeps the selected student's preview visible.

Before finalization show:

- student count;
- recipient count;
- unresolved attendance conflicts;
- other blocking validation problems;
- Finalize reports action.

After finalization show:

- frozen selected-student Report preview;
- frozen exact Parent Email preview;
- recipients for that student's email;
- Send reports action;
- delivery summary/history.

If the batch is finalized and has no protected delivery, Admin may reopen it for editing using the existing reversible-report safety model.

If a report has been sent/delivered, the sent revision remains immutable.

## Content-driven bilingual model

Guardian language preference will no longer decide which report is generated or which guardian receives it.

### New generation rule

Generate exactly one V2 report snapshot per student for a Class Report Cycle.

For newly generated content-driven Class Report Cycle reports, store `reports.language = 'both'` as a backward-compatible marker. For these V2 snapshots the `language` column no longer decides which paired English/Arabic content is rendered or which guardian receives the report. Content availability controls rendering instead.

Historical reports keep their existing language values and behavior. Do not destructively rewrite them.

### Rendering rule

Each bilingual field is rendered according to actual content availability:

- English and Arabic both present: render both as separate blocks;
- English only: render English only;
- Arabic only: render Arabic only;
- neither: omit the optional block or show the existing neutral empty-state marker where a report field must exist.

Never duplicate one language into the other language's block.

English content uses `dir="ltr"`; Arabic content uses `dir="rtl"`.

For bilingual narrative content, do not join English and Arabic with ` / `.

This applies to:

- main report labels and content;
- performance labels when Performance is enabled;
- student-comment labels and comments;
- report intro and closing;
- email subject;
- email greeting;
- email message;
- email closing;
- email sign-off.

Localized entity names such as school, student, class, subject, and group may use a compact bilingual representation where appropriate, but narrative/report/email content must use separate directional blocks.

### Email subject

- both subject templates available: compose a bilingual subject from the rendered English and Arabic subject strings;
- English only: English subject only;
- Arabic only: Arabic subject only.

Placeholder values use the matching localized student/school name for each language part when available.

## Guardian recipients

Delivery recipients are all active linked guardians who have `receives_reports = true`.

`guardian.report_language` must no longer filter generation or delivery.

The Guardian language-preference control should be removed from normal Admin UI so it does not imply behavior the system no longer uses.

Keep the existing database column initially for backward compatibility and historical data. Do not destructively drop it as part of this change.

Existing CSV/import/export compatibility may retain the field temporarily if removing it would cause unrelated migration risk; it must be documented as ignored for new report delivery behavior until separately cleaned up.

## Template symmetry

The report template must allow either language to stand alone.

Today several English fields are mandatory while Arabic is optional. Adjust the schema so paired fields are symmetric.

### Required-pair validation

- Main report label: at least one of English/Arabic required.
- Email subject: at least one of English/Arabic required.
- Performance label: at least one language required only when Performance is enabled.
- Student comment label: at least one language required only when Student Comments are enabled.
- Intro/help/closing/greeting/message/sign-off fields may be blank independently.

Application types and validation schemas should represent paired English fields as nullable where the database permits them after migration.

Template preview must use the same content-driven bilingual renderer used by real report/email generation.

## Performance default

Set Performance to disabled by default everywhere:

- `defaultReportTemplateConfig().performanceEnabled = false`;
- database default for new report templates becomes false;
- current active production template(s) are migrated to `performance_enabled = false` so the change takes effect immediately;
- existing stored performance values are preserved non-destructively;
- Teacher and Admin report UIs hide performance fields while the active template has Performance disabled;
- finalized reports and emails omit Performance while disabled.

If Admin later re-enables Performance in the template, the existing reporting behavior becomes available again.

## Data model and persistence

Use existing tables wherever possible:

- `report_batches` for the Class Report Cycle;
- `report_section_approvals` for shared official subject/group report content;
- `report_section_sources` for selected submitted Teaching Update sources;
- `report_student_overrides` for per-student report text, performance, and comments;
- `reports.snapshot_json` for finalized immutable student snapshots;
- `email_deliveries` for delivery history.

No new major report-content table is required.

### Class-cycle review persistence

The Class Report Cycle needs save/read operations that work across multiple approval contexts instead of the older subject/group workspace assumption of a single approval.

Review persistence must be keyed by the specific approval/context, not simply `workspace.approvals[0]`.

Saving a context persists:

- shared approved progress EN/AR on `report_section_approvals`;
- optional shared performance/comment values where applicable;
- per-student progress EN/AR overrides;
- per-student performance override flag/value when enabled;
- per-student EN/AR comments when enabled.

Opening review establishes an approval composition from the currently included submitted sources when that context does not yet have one, giving Admin edits a stable persistence target before finalization.

Once an approval exists, changing source inclusion must never automatically overwrite its shared report text. Source inclusion changes update the selected source associations used for attendance/source attribution, while the current official report text remains unchanged. The UI provides an explicit `Rebuild from selected sources` action for that context; using it requires confirmation because it replaces the shared EN/AR report text with a fresh composition from the currently included sources. Student-specific overrides remain intact unless the Admin clears them separately.

## Exact Parent Email preview

The Parent Email preview is read-only and always generated through the same email rendering functions used for delivery.

It shows:

- recipient email addresses for the selected student;
- exact subject;
- exact greeting/message blocks;
- exact embedded student report;
- exact closing/sign-off.

The preview must not maintain separate duplicate markup.

Before finalization, create an in-memory/live snapshot from saved review data and pass it through the same report/email renderers used by delivery.

After finalization, load the frozen `reports.snapshot_json` and pass it through the same delivery renderer used by `prepareDeliverableReport`.

## Multiline rendering

Create one safe rendering helper for narrative text that:

1. escapes HTML;
2. preserves newline boundaries in a way that works in browser preview and common email clients, using escaped text with newline-to-`<br>` conversion;
3. is reused for report intro/closing, main report text, student comments, and other multiline template/email narrative fields.

Do not use raw unescaped user text in HTML.

Teacher/Admin textareas preserve their raw newline characters in storage.

## Error handling and validation

Finalization must remain blocked when:

- unresolved attendance conflicts exist;
- no student reports can be built;
- required template label/subject pairs have neither language;
- required report context data is missing.

Saving a report context should not erase entered content on server failure. Client-controlled text fields should retain typed values across failed actions, following the pattern already adopted for Teaching Update coverage text.

Delivery failures preserve the finalized snapshot and remain retryable through the existing delivery status model.

## Compatibility

Historical V1 and existing finalized V2 report snapshots continue to render according to their stored language and structure. The redesign applies to newly generated content-driven V2 Class Report Cycle reports.

Do not rewrite historical sent reports, delivery rows, or guardian preferences.

Existing subject/group report workflows should either reuse the new review components where safe or remain behaviorally compatible until they are explicitly consolidated. The Class Report Cycle is the primary user-facing workflow to fix.

## Testing strategy

Use TDD for implementation.

### Unit tests

Add/extend tests for:

- content-driven paired EN/AR rendering;
- English-only and Arabic-only rendering;
- bilingual directionality;
- no inline `English / العربية` narrative joining;
- multiline/newline preservation;
- exact email subject behavior with EN, AR, and both;
- email body omits empty language blocks;
- Performance default false;
- template paired-field validation;
- student progress override falling back to shared progress;
- clearing student progress override restores inheritance;
- one report per student regardless of guardian language preferences;
- delivery recipients ignore guardian `report_language` and include all active `receives_reports` guardians;
- class-cycle review persistence targets the correct approval rather than the first approval;
- source inclusion changes do not overwrite Admin-edited report text;
- explicit rebuild refreshes shared report text while preserving student overrides.

### UI/contract tests

Verify:

- Class Report Cycle exposes `Open report` editing before finalization;
- Admin shared report editor mirrors Teacher field structure;
- student-specific report-text override is collapsed by default;
- Performance UI is absent by default;
- selected-student Report and Parent Email previews are available without a mandatory stage transition;
- Parent Email preview remains visible in the finalization/sending area;
- finalized unsent cycle exposes reopen when allowed;
- sent/protected cycle is read-only.

### Integration/database tests

Cover migration constraints and defaults:

- performance default false;
- active template set to false during migration;
- English label/subject columns may be null after symmetry migration;
- pair-level checks reject configurations where required paired fields are both empty;
- existing guardian `report_language` data remains intact;
- finalized Class Report Cycle stores exactly one `language = 'both'` report row per student under the new model.

### Delivery tests

Verify the HTML shown in Parent Email preview is produced by the same rendering functions used by actual send preparation.

## Out of scope

- Deleting the `guardian.report_language` database column.
- Rewriting historical sent reports or delivery history.
- Redesigning attendance itself beyond using existing Admin conflict resolution.
- Changing Teacher permission boundaries.
- Replacing the email provider.
- Broad unrelated visual redesign of the Admin application.

## Success criteria

The redesign is complete when an Admin can open a Class Report Cycle, inspect included submitted Teaching Updates, edit each subject report in a Teacher-familiar layout, optionally customize any student's full EN/AR report text and comments, select any student and see a live exact parent-email preview, finalize exactly one immutable report per student, and send that report to every active receiving guardian. English/Arabic narrative sections appear only when their corresponding content exists, all multiline content preserves line breaks, source-selection changes never silently destroy Admin edits, and Performance is off by default unless explicitly enabled in the active template.
