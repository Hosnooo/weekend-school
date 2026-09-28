# Roster CSV Import and Export Design

## Goal

Finish Weekend School administration with a safe bulk Student-entry workflow and simple roster exports.

The feature must match the current school model:

Student -> one current Class -> automatic Class Subjects -> optional Group per Subject.

CSV import is a fast initial-enrollment tool. The website remains the normal place to move Students between Classes or Groups later.

## Scope

Implement:

1. Bulk Student CSV import.
2. Downloadable school-specific CSV import template.
3. Upload -> validation preview -> explicit confirm.
4. Transactional all-or-nothing import.
5. School roster CSV export.
6. Class roster CSV export.

Preserve the existing operational export system for attendance, comments, reports, deliveries, memberships, and other historical data.

## Non-goals

Do not add:

- Teacher CSV import.
- Administrator CSV import.
- Attendance CSV import.
- Report CSV import.
- destructive CSV synchronization;
- deleting Students because they are absent from a file;
- changing existing Class/Group membership through the first import workflow;
- Group roster export;
- single-Student roster export;
- Auth-account creation;
- production deployment or hosted Supabase changes without explicit authorization.

## Import model

One CSV row represents one new Student, one primary Guardian, one initial Class enrollment, and optional Group assignments for Subjects in that Class.

The import creates new Students only.

Existing Students continue to be managed through the website.

## Import template

The downloaded template is UTF-8 with BOM so Arabic opens correctly in Excel.

Stable base columns:

- `student_first_name_en`
- `student_last_name_en`
- `student_first_name_ar`
- `student_last_name_ar`
- `guardian_name`
- `guardian_email`
- `guardian_phone`
- `report_language`
- `class`
- `enrollment_start_date`

Required:

- `student_first_name_en`
- `student_last_name_en`
- `guardian_name`
- `guardian_email`
- `guardian_phone`
- `class`
- `enrollment_start_date`

Optional:

- Arabic Student names
- `report_language`

`report_language` accepts:

- `en`
- `ar`
- `both`

When blank for a new Guardian, use the school's default language.

## Dynamic Subject Group columns

The template adds one optional Group column for every active school Subject.

Examples:

- `Quran group`
- `Arabic group`
- `Islamic Studies group`

Subject English names are school-unique and therefore identify the Subject represented by the generated column.

For each Student:

- the chosen Class determines which Subjects actually apply;
- Students automatically participate in the Class's active Subjects;
- the import does not expose Subject-exclusion columns;
- a Group cell may be blank;
- when blank and that Class Subject has a default Group, use the default Group;
- when blank and no default Group exists, leave the Student ungrouped for that Subject;
- when nonblank, the Group must be an active Group belonging to that Subject in the selected Class;
- a nonblank Group for a Subject not attached to the selected Class is an error.

No global `group` column is allowed.

## Class and Group resolution

The normal blank template remains human-readable and does not require UUIDs.

`class` contains the Class English name.

Class names are resolved case-insensitively after trimming.

If a name cannot be resolved to exactly one active Class, the row is invalid. The import must never guess between ambiguous Classes.

Group names are resolved within the selected Class Subject.

If the Group cannot be resolved uniquely to an active Group in that context, the row is invalid.

Roster exports include stable IDs for future administrative use, but IDs do not clutter the blank entry template.

## Guardian identity

Guardian email is normalized by trimming and lowercasing.

During preview, each row clearly reports whether the Guardian will be:

- created; or
- reused from an existing Guardian.

An existing Guardian is never silently modified by CSV import.

If the normalized email resolves to an existing Guardian:

- reuse that Guardian;
- show the existing Guardian in preview;
- do not overwrite name, phone, or report-language preference;
- differences between supplied CSV details and the existing Guardian are shown as warnings.

If multiple imported siblings use the same new Guardian email, create the Guardian once and link all those Students to it.

The Guardian becomes the Student's primary report-receiving Guardian.

## CSV parsing

Use a maintained CSV parser rather than an ad-hoc comma split.

Support:

- UTF-8 BOM;
- CRLF and LF;
- quoted fields;
- commas inside quoted fields;
- escaped quotes;
- Arabic text.

Reject malformed CSV.

Set bounded upload limits so the import cannot become an unbounded server workload. Initial limits:

- maximum file size: 1 MiB;
- maximum data rows: 500.

## Preview

Uploading a file performs no writes.

Preview validates every row and displays:

- row number;
- Student name;
- normalized Guardian email;
- Guardian resolution: Create / Reuse;
- resolved Class;
- resolved per-Subject Group or Default/Ungrouped;
- errors;
- warnings.

Blocking errors include:

- missing required columns;
- missing required values;
- malformed CSV;
- invalid email;
- invalid date;
- invalid report language;
- Class not found;
- ambiguous Class;
- inactive Class;
- unknown Subject Group column;
- Group not found;
- Group not valid for the selected Class Subject;
- nonblank Group for a Subject not attached to the selected Class;
- duplicate identical data rows in the same file.

Potential existing-Student matches are warnings, not automatic merges. Students are never merged by name.

The Confirm button is unavailable while any blocking error exists.

## Confirm and transaction

Confirm must not trust browser-provided resolved IDs.

The server revalidates the normalized row data against the current school state before writing.

The final write occurs through one administrator-only database transaction/RPC.

The entire file either succeeds or rolls back.

For every row the transaction:

1. resolves/reuses or creates the Guardian;
2. creates the Student;
3. creates the Class enrollment;
4. automatically includes active Class Subjects;
5. creates explicit/default Subject Group memberships when applicable;
6. links the primary Guardian.

If any row fails, none of the rows are imported.

## Repeat-import protection and audit

Create a small import audit record containing:

- import id;
- school id;
- administrator/profile id;
- canonical file/import hash;
- row count;
- Students created;
- Guardians created;
- Guardians reused;
- timestamp.

Do not retain the raw uploaded CSV.

An identical previously completed import hash for the same school is rejected to prevent accidental double import.

## Import UI

Add an administrator-only Student import page:

`/[locale]/students/import`

The Students page exposes an obvious `Import CSV` / Arabic equivalent action.

The import page contains:

1. short instructions;
2. `Download template`;
3. file picker;
4. `Preview`;
5. preview results;
6. `Confirm import`.

After successful import, show the counts created/reused and provide a direct link back to Students.

All visible application UI is translated in English and Arabic. CSV header names remain stable English machine-facing names.

## Roster exports

Add a separate, simple Roster export area to Export Data.

Roster scopes are only:

- Entire school;
- One Class.

Do not add Group or single-Student roster exports.

Roster CSV represents current roster state, not historical events.

One row per currently enrolled Student.

Base columns:

- `student_id`
- `student_first_name_en`
- `student_last_name_en`
- `student_first_name_ar`
- `student_last_name_ar`
- `guardian_id`
- `guardian_name`
- `guardian_email`
- `guardian_phone`
- `report_language`
- `class_id`
- `class`
- `enrollment_start_date`

Add dynamic Subject columns for active school Subjects:

- `<Subject> group`
- `<Subject> group_id`

Example:

- `Quran group`
- `Quran group_id`
- `Arabic group`
- `Arabic group_id`

For a Subject not attached to the Student's Class, leave the Subject columns blank.

For an attached Subject with no Group assignment, leave Group name/id blank.

Exports use UTF-8 BOM, CRLF CSV, CSV quoting, and spreadsheet-formula protection consistent with the existing export generator.

## Existing exports

Do not redesign or remove the current operational export system.

Existing period/scope/dataset exports remain available for:

- Students;
- memberships;
- attendance;
- comments;
- reports;
- deliveries;
- generated report PDFs where already supported.

The new Roster export is an additional everyday administrative export.

## Security

All import and roster-export actions require Administrator access.

Every lookup and write is school-scoped.

Database import RPC rechecks school ownership and active Class/Class-Subject/Group relationships.

Do not rely on client-side validation or hidden UI controls for authorization.

## Testing

Add focused tests before implementation behavior.

Unit tests:

- CSV parsing including quotes, commas, BOM, CRLF, Arabic;
- dynamic Subject headers;
- Class resolution;
- default Group behavior;
- explicit Group behavior;
- ungrouped behavior;
- Guardian normalization/reuse planning;
- row errors and warnings;
- roster column generation.

Database tests:

- admin-only import;
- school isolation;
- all-or-nothing rollback;
- default Group assignment;
- explicit per-Subject Group assignment;
- ungrouped Subject;
- Guardian reuse;
- shared new Guardian across sibling rows;
- repeat-import rejection;
- import audit summary.

UI/integration tests:

- template download;
- import page;
- preview with errors;
- successful preview;
- confirm;
- school roster export;
- Class roster export;
- EN/AR labels.

Browser smoke:

1. download template;
2. fill several Students across at least two Classes;
3. include Arabic text;
4. include one existing Guardian;
5. include siblings sharing one new Guardian;
6. include default, explicit, and blank Group cases;
7. confirm invalid file cannot import;
8. import valid file;
9. verify Students/Class/Subject Groups in the website;
10. export school roster;
11. export one Class roster;
12. inspect CSV in Excel-compatible UTF-8 form.

## Release gate

Before committing the implementation:

- focused unit tests pass;
- focused database tests pass;
- full database suite passes through the existing upgrade-path procedure;
- full application tests pass;
- `pnpm typecheck` passes;
- `pnpm lint` passes;
- `pnpm build` passes;
- `git diff --check` passes.

Do not stage or commit the local-only `supabase/config.toml`.

Do not deploy production or mutate hosted Supabase without explicit authorization.
