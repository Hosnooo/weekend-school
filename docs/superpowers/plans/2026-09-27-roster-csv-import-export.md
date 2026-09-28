# Roster CSV Import and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe bulk Student CSV enrollment plus school/class roster CSV exports without changing the existing operational export system.

**Architecture:** Parse and validate CSV in a focused `roster-csv` feature, preview without writes, then revalidate and execute the confirmed import through one administrator-only PostgreSQL transaction. Roster exports use a separate lightweight CSV route and reuse shared CSV serialization so operational exports remain untouched.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Supabase/PostgreSQL, Zod, `csv-parse`, next-intl, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-27-roster-csv-import-export-design.md`

## Global Constraints

- One import row = one new Student + one primary Guardian + one Class + optional per-Subject Groups.
- Student automatically participates in active Subjects attached to the selected Class.
- Blank Group uses the Class Subject default Group when configured; otherwise remains ungrouped.
- Do not expose Subject exclusions in CSV import.
- Do not merge Students by name.
- Normalize Guardian email by trimming and lowercasing.
- Reuse an existing Guardian by normalized email without modifying that Guardian.
- Shared new-Guardian email inside one import creates one Guardian and links all relevant Students.
- Preview performs no writes.
- Confirm revalidates server-side and database-side.
- Import is one all-or-nothing transaction.
- Maximum CSV size: 1 MiB.
- Maximum data rows: 500.
- Do not retain raw uploaded CSV.
- Identical completed import hash for the same school is rejected.
- Roster exports support only School and Class scopes.
- No Group or single-Student roster export.
- Preserve existing operational export behavior.
- EN/AR UI and RTL must remain correct.
- Do not stage or commit `supabase/config.toml`.
- Do not mutate hosted/production Supabase.

## Review Focus

1. Quoted commas, CRLF, BOM, escaped quotes, and Arabic must parse without corrupting rows — Task 1 tests this.
2. A Subject Group belonging to another Class must never be accepted just because its name matches — Task 2 tests this.
3. An inactive existing Guardian email must not be silently resurrected or modified — Task 2 treats this as a blocking preview error and Task 3 rechecks it.
4. A duplicate import confirmation or double-click must not create duplicate Students — Task 3 hash uniqueness tests this.
5. Confirm payload tampering must not allow cross-school Class/Group IDs — Task 3 database tests and Task 4 server revalidation test this.

---

### Task 1: Shared CSV codec and school-specific template

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/features/roster-csv/roster-csv.types.ts`
- Create: `src/features/roster-csv/roster-csv.service.ts`
- Create: `tests/unit/roster-csv-service.test.ts`

**Interfaces:**
- Produces:
  - `parseRosterCsv(csvText: string): ParsedRosterCsv`
  - `buildRosterTemplate(subjects: readonly RosterSubjectColumn[]): Uint8Array`
  - `serializeCsv(columns: readonly string[], rows: readonly Record<string, unknown>[]): Uint8Array`
  - stable base-column constants shared by import/export.

- [ ] **Step 1: Add the maintained CSV parser**

Run:

```bash
pnpm add csv-parse
```

Expected: `package.json` and lockfile add `csv-parse`.

- [ ] **Step 2: Write failing parser/template tests**

Cover:

- UTF-8 BOM;
- CRLF and LF;
- quoted comma;
- escaped quote;
- Arabic;
- malformed CSV;
- exact stable base headers;
- generated `<Subject> group` columns;
- 500-row boundary;
- 501 rows rejected;
- formula-safe serialization.

Run:

```bash
pnpm vitest run tests/unit/roster-csv-service.test.ts
```

Expected: FAIL because roster CSV functions do not exist.

- [ ] **Step 3: Implement focused CSV types/service**

`roster-csv.service.ts` owns parsing, header normalization, limits, template generation, and serialization only. It must not query Supabase.

- [ ] **Step 4: Run focused tests**

```bash
pnpm vitest run tests/unit/roster-csv-service.test.ts
```

Expected: PASS.

---

### Task 2: Preview resolution and duplicate/Guardian planning

**Files:**
- Create: `src/features/roster-csv/roster-csv.repository.ts`
- Extend: `src/features/roster-csv/roster-csv.types.ts`
- Extend: `src/features/roster-csv/roster-csv.service.ts`
- Create: `tests/unit/roster-import-preview.test.ts`

**Interfaces:**
- Consumes parsed CSV from Task 1.
- Produces:
  - `listRosterImportCatalog(schoolId: string): Promise<RosterImportCatalog>`
  - `buildRosterImportPreview(input): RosterImportPreview`
  - canonical normalized rows suitable for server revalidation and DB import.

- [ ] **Step 1: Write failing preview tests**

Cover:

- unique active Class resolution;
- missing/ambiguous/inactive Class;
- Subject column mapping;
- explicit valid Group;
- wrong-Class Group rejection;
- blank Group -> default Group;
- blank Group -> ungrouped when no default;
- Subject not attached to Class with nonblank Group -> error;
- existing active Guardian -> reuse;
- existing inactive Guardian -> error;
- existing Guardian detail mismatch -> warning without modification;
- repeated new Guardian email across sibling rows -> one planned Guardian;
- duplicate identical CSV rows -> error;
- likely existing Student name match -> warning only;
- default report language when blank.

Run:

```bash
pnpm vitest run tests/unit/roster-import-preview.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Implement catalog + pure preview planner**

Repository loads school-scoped active/inactive Classes, Subjects, Class Subjects, Groups, Guardians, Students, and school default language.

Preview service resolves names case-insensitively after trimming and never guesses ambiguous Class names.

- [ ] **Step 3: Run Tasks 1–2 tests**

```bash
pnpm vitest run \
  tests/unit/roster-csv-service.test.ts \
  tests/unit/roster-import-preview.test.ts
```

Expected: PASS.

---

### Task 3: Transactional database import and audit

**Files:**
- Create: `supabase/migrations/20260927132000_roster_csv_import.sql`
- Create: `supabase/tests/roster_csv_import.test.sql`
- Modify: `tests/integration/database/migrations.test.ts`
- Extend: `src/features/roster-csv/roster-csv.repository.ts`

**Interfaces:**
- Produces database RPC:
  - `public.import_student_roster(p_import_hash text, p_rows jsonb) returns jsonb`
- Produces audit table:
  - `public.roster_imports`
- Repository:
  - `confirmRosterImport(input): Promise<RosterImportSummary>`

- [ ] **Step 1: Write failing pgTAP tests**

Cover:

- migration/table/function existence;
- Admin allowed;
- Teacher denied;
- cross-school Class denied;
- cross-school Group denied;
- inactive Class/Group denied;
- new Guardian creation;
- existing active Guardian reuse;
- existing Guardian not modified;
- shared new Guardian created once;
- default Group;
- explicit Group;
- ungrouped Subject;
- whole file rollback when one row fails;
- audit counts;
- duplicate completed import hash rejected.

Run the new DB test against the correctly prepared local database.

Expected: FAIL before migration implementation.

- [ ] **Step 2: Implement migration**

`roster_imports` stores:

- `id`
- `school_id`
- `requested_by_profile_id`
- `import_hash`
- `row_count`
- `students_created`
- `guardians_created`
- `guardians_reused`
- `created_at`

Unique completed hash is enforced per school.

The security-definer RPC:

1. requires active administrator context;
2. validates JSON array and 1–500 rows;
3. rechecks every Class/Class Subject/Group belongs to current school and is active;
4. checks Guardian reuse state;
5. creates/reuses Guardians;
6. creates Students;
7. creates Class enrollments;
8. creates default/explicit Group memberships;
9. links primary report-receiving Guardians;
10. inserts audit summary;
11. returns summary JSON.

Any exception rolls back everything.

- [ ] **Step 3: Run focused DB test**

```bash
pnpm exec supabase test db supabase/tests/roster_csv_import.test.sql
```

Expected: PASS.

- [ ] **Step 4: Run migration integration test**

```bash
pnpm vitest run tests/integration/database/migrations.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Tasks 1–3**

Stage all Task 1–3 files except `supabase/config.toml`.

Commit:

```text
feat: add transactional roster csv import
```

---

### Task 4: Admin import UI, preview, confirm, and template download

**Files:**
- Create: `src/features/roster-csv/roster-csv.actions.ts`
- Create: `src/features/roster-csv/roster-import-form.tsx`
- Create: `src/app/[locale]/(protected)/(admin)/students/import/page.tsx`
- Create: `src/app/api/roster/template/route.ts`
- Modify: `src/app/[locale]/(protected)/(admin)/students/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Create: `tests/unit/roster-import-ui.test.tsx`
- Create: `tests/unit/roster-import-actions.test.ts`

**Interfaces:**
- `previewRosterImportAction(previousState, formData)`
- `confirmRosterImportAction(previousState, formData)`
- Template GET route requires Administrator and generates current school Subject columns.

- [ ] **Step 1: Write failing UI/action tests**

Assert:

- Students page exposes Import CSV action;
- import page is Admin-only;
- template route is Admin-only;
- file >1 MiB rejected;
- preview has no writes;
- errors disable confirm;
- warnings do not disable confirm;
- preview shows Guardian Create/Reuse;
- preview shows resolved/default/ungrouped Group state;
- confirm does not trust client-resolved IDs and rebuilds preview server-side;
- success shows Student/Guardian counts;
- EN/AR message parity.

- [ ] **Step 2: Implement server actions and import form**

Use server action state for upload/preview.

The browser may return canonical row JSON for confirmation, but confirm reparses/revalidates normalized row content against a fresh school catalog before calling the RPC.

Do not persist the uploaded file.

- [ ] **Step 3: Implement template route**

Return:

- `text/csv; charset=utf-8`;
- UTF-8 BOM;
- attachment filename `weekend-school-student-import-template.csv`;
- current active Subject Group columns.

- [ ] **Step 4: Run focused UI/action tests**

```bash
pnpm vitest run \
  tests/unit/roster-import-ui.test.tsx \
  tests/unit/roster-import-actions.test.ts \
  tests/unit/roster-csv-service.test.ts \
  tests/unit/roster-import-preview.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Commit:

```text
feat: add admin roster csv workflow
```

---

### Task 5: School and Class roster exports

**Files:**
- Create: `src/features/roster-csv/roster-export.repository.ts`
- Create: `src/features/roster-csv/roster-export-panel.tsx`
- Create: `src/app/api/roster/export/route.ts`
- Modify: `src/app/[locale]/(protected)/(admin)/exports/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Create: `tests/unit/roster-export.test.ts`
- Create: `tests/unit/roster-export-ui.test.tsx`

**Interfaces:**
- `collectRosterExportRows(schoolId, scope, onDate)`
- `buildRosterExportCsv(subjects, rows)`
- GET `/api/roster/export?scope=SCHOOL`
- GET `/api/roster/export?scope=CLASS&classId=<uuid>`

- [ ] **Step 1: Write failing roster-export tests**

Cover:

- school scope includes all currently enrolled Students;
- Class scope includes only current Students in that Class;
- no Group/single-Student scope accepted;
- one row per Student;
- primary Guardian fields;
- Student/Class/Guardian stable IDs;
- enrollment start date;
- dynamic `<Subject> group` + `<Subject> group_id`;
- blank for Subject not attached to Class;
- blank for attached Subject with no Group;
- explicit/default current Group exported;
- Arabic survives UTF-8 output;
- school isolation;
- inactive/historical enrollment excluded from current roster.

- [ ] **Step 2: Implement roster row repository**

Use effective current Class enrollment and effective current per-Subject Group memberships.

Do not derive roster rows from report snapshots or weekly submissions.

- [ ] **Step 3: Implement protected roster export route**

Require active Administrator.

Accept only `SCHOOL` or `CLASS`.

Return CSV attachment with formula protection and BOM.

- [ ] **Step 4: Add simple Roster export panel**

On Export Data show a separate Roster export section:

- Entire school
- One Class
- Download CSV

Do not remove or change existing operational export controls.

- [ ] **Step 5: Run focused tests**

```bash
pnpm vitest run \
  tests/unit/roster-export.test.ts \
  tests/unit/roster-export-ui.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Commit:

```text
feat: add school and class roster exports
```

---

### Task 6: Full regression and browser verification

**Files:**
- Modify only if verification exposes a real defect.
- Do not touch hosted Supabase.

- [ ] **Step 1: Rebuild the local DB using the CI upgrade path**

```bash
pnpm exec supabase db reset --version 202609230027
eval "$(pnpm exec supabase status -o env)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/fixtures/teacher_id_history_pre28.sql
pnpm exec supabase migration up --local
```

- [ ] **Step 2: Run full DB suite**

```bash
pnpm test:db
```

Expected: all DB tests pass.

- [ ] **Step 3: Run full application suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Run quality gate**

```bash
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all pass.

- [ ] **Step 5: Browser smoke locally**

Verify:

1. Download template.
2. Populate Students across at least two Classes.
3. Include Arabic names.
4. Reuse one existing active Guardian.
5. Import two siblings sharing one new Guardian email.
6. Exercise explicit Group, default Group, and ungrouped Subject.
7. Confirm invalid file cannot import.
8. Confirm valid import succeeds.
9. Verify imported Students in Student enrollment UI.
10. Download school roster.
11. Download one Class roster.
12. Inspect Arabic/UTF-8 CSV in Excel-compatible form.

- [ ] **Step 6: Final status review**

```bash
git status --short
git log --oneline -6
```

Expected: only local-only `supabase/config.toml` remains modified.

Do not push until explicitly approved.
