# Class, Subject, Group, and Reporting Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current primary-teacher / global-group Phase 1 model with the approved `Class -> Subject -> optional Group` architecture, independent co-teacher weekly submissions, Present/Absent attendance resolution, admin-approved subject-aware reports, archive/delete/export workflows, and a clearer bilingual UI before Phase 2 CSV begins.

**Architecture:** Keep the existing Next.js modular monolith and Supabase/PostgreSQL deployment, but introduce explicit school-domain tables for Classes, reusable Subjects, Class Subjects, optional Subject Groups, Class enrollment, Subject exclusions, dated Group membership, and dated teaching assignments. New weekly-submission and reporting flows use those entities directly; the legacy group/session tables remain intact until the new model is verified so applied migrations 1-18 are never edited and production data is never silently reinterpreted.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.2, TypeScript 5.9 strict mode, next-intl 4.13.7, Supabase/PostgreSQL/RLS, Zod 4.1.11, Vitest 5, Playwright 1.63, Tailwind CSS 4, Brevo/React Email, pnpm 11.19, Node >=22.

**Spec:** `docs/superpowers/specs/2026-09-22-class-subject-group-reporting-redesign.md`

## Global Constraints

- `docs/SPEC.md` is the product source of truth; synchronize the approved redesign into it before production code changes.
- Record the superseding architecture as a new decision in `docs/DECISIONS.md`; do not rewrite historical D-007, D-008, D-023, or D-024 entries.
- Migrations 1-18 are immutable. All corrections are forward-only, starting at migration 19.
- Never apply `supabase/seed.sql` or development seed data to hosted production.
- Every school-owned row carries `school_id`; server authorization and PostgreSQL RLS are both mandatory.
- Do not expose service-role, Brevo, SMTP, or cron secrets to client code.
- Teacher-authored English/Arabic content is never automatically translated.
- Attendance has exactly `PRESENT` and `ABSENT` in the new teaching model.
- A student may have at most one active Class and at most one active Group per Class Subject.
- Teachers may have unlimited legitimate Class/Subject/Group assignments; multiple teachers may teach the same context.
- Parent-facing reports never show teacher names and identify MCE Weekend School as the author/source.
- Finalized reports are immutable snapshots; corrections create a revision rather than mutating the finalized version.
- Active -> Archived -> Restore OR Permanently Delete is the approved lifecycle. Permanent deletion must show impact first and may remove dependent history only after explicit admin confirmation.
- Teacher workflows remain mobile-first at approximately 360px and both English LTR and Arabic RTL are required.
- Before modifying Next.js application code, read the relevant local guides under `node_modules/next/dist/docs/` as required by `AGENTS.md`.
- Run the phase gate `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, and `pnpm build` before release. Database/RLS and browser evidence must be real, not mocked.
- Phase 2 CSV remains blocked until this redesign is released and production-smoke-tested.

## Review Focus

1. **Whole-subject teacher plus explicit Group assignment:** effective teaching contexts must be deduplicated so one teacher does not receive duplicate cards, expected submissions, or permissions for the same Group.
2. **Default Group changes:** changing the default must not move existing students; only new/unassigned participating students use the new default.
3. **Co-teacher attendance disagreement:** two teacher observations must produce one conflict, not two attendance days; an admin resolution must become the official report value.
4. **Subject exclusion/date boundaries:** an excluded student must disappear only from the affected Subject context while remaining enrolled in the Class and other Subjects.
5. **Permanent deletion with finalized reports:** impact calculation must include dependent reports/deliveries and deletion must require an archived target plus explicit confirmation; unrelated school data must remain untouched.

---

## File structure and ownership

New code should follow existing feature boundaries instead of creating a generic CRUD framework.

- `src/features/classes/` — Classes, Subjects, Class Subjects, Subject Groups, admin class detail UI, schemas/services/repositories.
- `src/features/enrollment/` — Class enrollment, Subject exclusions, Subject Group memberships, effective student participation rules.
- `src/features/teaching-assignments/` — teacher assignment scopes and effective teaching-context expansion.
- `src/features/weekly-updates/` — migrate the existing teacher workflow to the new teaching-context model; keep files focused rather than duplicating a second teacher-update feature.
- `src/features/reports/` — subject-aware source aggregation, admin approval/composer, snapshot v2, renderer/email compatibility.
- `src/features/archives/` — archive/restore/delete-impact/permanent-delete application services and admin pages.
- `src/features/exports/` — export filters, workbook/CSV/ZIP/PDF bundle orchestration and protected download route.
- `src/components/ui/` — shared form controls, buttons, cards, badges, dialogs, table/list primitives; no page-specific business rules.
- `src/components/layout/` — navigation and application shell only.

The legacy `src/features/groups/` and legacy group/session database tables are not deleted in the first migration. The new code stops depending on them once equivalent workflows are green. Removal of legacy storage, if desired, is a separate later cleanup after hosted verification.

---

### Task 1: Synchronize repository authority documents before product code

**Files:**
- Modify: `docs/SPEC.md`
- Modify: `docs/DECISIONS.md`
- Modify: `AGENTS.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: approved design at `docs/superpowers/specs/2026-09-22-class-subject-group-reporting-redesign.md`.
- Produces: authoritative requirement text that all later tasks use; new decision `D-025` explicitly superseding conflicting cardinality/lifecycle rules.

- [ ] **Step 1: Read the approved design and current authority files side by side**

Run:
```bash
sed -n '1,260p' docs/superpowers/specs/2026-09-22-class-subject-group-reporting-redesign.md
sed -n '1,260p' AGENTS.md
sed -n '1800,2200p' docs/SPEC.md
tail -n 120 docs/DECISIONS.md
```
Expected: the approved design conflicts with legacy primary-teacher, one-global-group, Late/Excused, no-hard-delete, and group-only navigation/report rules.

- [ ] **Step 2: Append an explicit superseding section to `docs/SPEC.md` rather than silently rewriting history**

Add a new section headed:
```markdown
# 58. Class-Subject-Group architecture correction (2026-09-22)

This section supersedes conflicting requirements in sections 5, 8-12, 15-18, 21-24, 31-39, 44, 51-55, and 57. The approved detailed design is `docs/superpowers/specs/2026-09-22-class-subject-group-reporting-redesign.md`.
```
Then copy the approved rules into concise normative subsections covering: Class -> Subject -> optional Group; one active Class/student; automatic Subject participation with exclusions; one Group/student/Class Subject; default Group semantics; many-to-many teacher assignments; separate co-teacher submissions; Present/Absent only; admin attendance resolution; subject-aware report composer; immutable finalized snapshot; new navigation; archive/delete/export; security; forward-only rollout.

- [ ] **Step 3: Add `D-025 — Explicit Class/Subject/Group model supersedes group-centric cardinalities`**

Append to `docs/DECISIONS.md`:
```markdown
## D-025 — Explicit Class/Subject/Group model supersedes group-centric cardinalities

**Status:** Accepted — 2026-09-22

Use explicit `Class -> Subject -> optional Group` concepts. A student has one active Class, participates automatically in that Class's Subjects unless excluded, and has at most one active Group per Class Subject. Teachers may have multiple Class/Subject/Group assignments and multiple teachers may share the same context; there is no primary-teacher business rule. Co-teachers submit separately and the admin resolves official attendance/report content. Attendance is Present/Absent only. Reports are subject-aware, parent-facing teacher names are omitted, and finalization creates immutable snapshots.

This decision supersedes D-007's hierarchy shape, D-008's one-session-per-group/date identity, D-023's group-submission dashboard semantics, and the teacher/student cardinality and release-order portions of D-024. Existing authentication, school isolation, recovery, provider, and forward-only migration decisions remain in force where they do not conflict.

Approved lifecycle is Active -> Archived -> Restore OR Permanently Delete. An admin may permanently delete an archived entity and dependent history after an explicit impact review; protected export/download is available before deletion and independently by period/scope.
```

- [ ] **Step 4: Reconcile `AGENTS.md` without weakening safety**

Replace the legacy absolute rules:
```text
Do not hard-delete historical school records.
Use deactivation for teachers, students, groups, and guardians with history.
```
with:
```text
Use archive/restore for normal lifecycle changes. Permanent deletion is an explicit admin-only workflow for archived records, must show dependent-data impact, may offer export first, and must be school-scoped and transactional.
```
Keep all RLS, secrets, TDD, bilingual, strict TypeScript, Next.js-doc, and migration-immutability rules unchanged.

- [ ] **Step 5: Update the implementation/progress docs to block Phase 2 CSV**

Record that the architecture correction is the active phase, that the old Phase 1 release is superseded by this correction, and that Phase 2 CSV cannot start until the correction's production smoke gate passes.

- [ ] **Step 6: Verify there is no unresolved authority contradiction**

Run:
```bash
rg -n "one primary teacher|one current group|PRIMARY|ASSISTANT|LATE|EXCUSED|hard-delete|hard deletion|My Groups" AGENTS.md docs/SPEC.md docs/DECISIONS.md
```
Expected: legacy text may remain only in historical sections/decisions that the new section/D-025 explicitly supersede; current normative text is unambiguous.

- [ ] **Step 7: Commit authority synchronization**

```bash
git add AGENTS.md docs/SPEC.md docs/DECISIONS.md docs/IMPLEMENTATION_PLAN.md docs/PROGRESS.md
git commit -m "docs: adopt class subject group architecture"
```

---

### Task 2: Create the forward-only core academic schema and migrate existing setup safely

**Files:**
- Create: `supabase/migrations/202609220019_class_subject_group_foundation.sql`
- Create: `supabase/tests/class_subject_group.test.sql`
- Modify: `tests/integration/database/migrations.test.ts`

**Interfaces:**
- Produces tables `classes`, `subjects`, `class_subjects`, `subject_groups`, `class_enrollments`, `subject_exclusions`, `subject_group_memberships`, `teaching_assignments`.
- Produces helper functions used later: `student_participates_in_class_subject(student_id, class_subject_id, on_date)`, `teacher_can_teach_context(profile_id, class_subject_id, subject_group_id, on_date)`.

- [ ] **Step 1: Write failing pgTAP coverage for the approved cardinalities**

Tests must assert at least:
```sql
-- one active Class per student
-- same student can be Quran Group A and Arabic Group B
-- same student cannot hold two overlapping Groups in the same Class Subject
-- changing class_subjects.default_group_id does not update existing memberships
-- multiple teachers can share the same Class Subject or Group
-- duplicate identical overlapping teacher assignment is rejected
-- cross-school Class/Subject/Group references are rejected
```
Also add a migration contract assertion that migration 19 exists and migrations 1-18 remain byte-for-byte untouched in git history.

- [ ] **Step 2: Run the new database test and confirm RED**

Run:
```bash
pnpm db:reset
pnpm test:db
```
Expected: FAIL because the new tables/functions do not exist.

- [ ] **Step 3: Implement migration 19 with explicit tables and date-aware constraints**

Use UUID keys and `school_id` on every owned table. The shape should be equivalent to:
```sql
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name_en text not null,
  name_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name_en text not null,
  name_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name_en)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  default_group_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, class_id, subject_id),
  foreign key (school_id, class_id) references public.classes(school_id, id),
  foreign key (school_id, subject_id) references public.subjects(school_id, id)
);

create table public.subject_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_subject_id uuid not null,
  name_en text not null,
  name_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, class_subject_id, name_en),
  foreign key (school_id, class_subject_id) references public.class_subjects(school_id, id)
);
```
Add the default-group FK after `subject_groups` exists and enforce that the selected default belongs to the same Class Subject with a trigger or validated RPC.

Use date ranges/exclusion constraints for `class_enrollments`, `subject_group_memberships`, and `teaching_assignments`. Do not use a global one-Group-per-student constraint; the Group overlap key is `(school_id, student_id, class_subject_id)`.

- [ ] **Step 4: Migrate the current top-level legacy groups into Classes only**

Migration SQL must copy active/root legacy `groups` to `classes`, preserving IDs/names when safe:
```sql
insert into public.classes (id, school_id, name_en, name_ar, is_active, created_at, updated_at)
select id, school_id, name_en, name_ar, is_active, created_at, updated_at
from public.groups
where parent_group_id is null
on conflict (id) do nothing;
```
Do **not** invent Subjects or convert legacy teacher assignments into a fake Subject. Existing production has no student/session/report history, but the migration must still be safe if rows appear before release.

- [ ] **Step 5: Implement default-Group behavior as a database function used by application services**

Provide an RPC equivalent to:
```sql
create function public.create_subject_group(
  p_class_subject_id uuid,
  p_name_en text,
  p_name_ar text default null
) returns uuid
```
It creates the Group school-scoped and sets `default_group_id` only if no default currently exists. It never moves existing memberships.

- [ ] **Step 6: Implement the two authorization/effective-participation helpers**

`student_participates_in_class_subject` must require active Class enrollment on the date, active Class Subject, and no active exclusion. `teacher_can_teach_context` must accept either a whole-Class-Subject assignment or an exact Group assignment; Group must belong to the supplied Class Subject.

- [ ] **Step 7: Run DB tests to GREEN**

```bash
pnpm db:reset
pnpm test:db
pnpm test -- tests/integration/database/migrations.test.ts
```
Expected: PASS, including the five Review Focus data cases owned by this schema task.

- [ ] **Step 8: Commit the core schema**

```bash
git add supabase/migrations/202609220019_class_subject_group_foundation.sql supabase/tests/class_subject_group.test.sql tests/integration/database/migrations.test.ts
git commit -m "feat: add class subject group foundation"
```

---

### Task 3: Add RLS for the new academic model before exposing application screens

**Files:**
- Create: `supabase/migrations/202609220020_class_subject_group_rls.sql`
- Create: `supabase/tests/class_subject_group_rls.test.sql`
- Modify: `src/lib/auth/authorization.ts`
- Modify: `tests/unit/authorization.test.ts`

**Interfaces:**
- Consumes: migration 19 tables/helpers.
- Produces: admin full same-school policies; teacher read policies constrained by active teaching assignments; typed server helpers `requireAdmin()` and `requireTeachingContextAccess(classSubjectId, subjectGroupId?)`.

- [ ] **Step 1: Write RED RLS tests**

Exercise two schools and assert:
```text
admin A can manage only school A academic rows
teacher A whole-subject assignment can read all participating students/groups in that subject
teacher A group assignment cannot read sibling group rosters
subject-excluded student is not visible through that subject roster
teacher B cannot see teacher A context
inactive teacher cannot write
```

- [ ] **Step 2: Confirm RED with real PostgreSQL/RLS**

```bash
pnpm db:reset
pnpm test:db
```
Expected: new RLS test fails before policies exist.

- [ ] **Step 3: Implement migration 20 policies and narrowly scoped SECURITY DEFINER helpers**

Enable RLS on all migration-19 tables. Revoke anonymous execute on any SECURITY DEFINER helper immediately in the same migration. Do not use service-role access for ordinary teacher/admin requests.

- [ ] **Step 4: Update server authorization helpers and unit tests**

Add a typed context:
```ts
export type TeachingContextRef = {
  classSubjectId: string;
  subjectGroupId: string | null;
};

export async function requireTeachingContextAccess(
  context: TeachingContextRef,
): Promise<AuthenticatedProfile>;
```
The helper checks active profile, same-school context, and effective assignment. Admin rights do not implicitly grant teacher submission ownership; an admin who teaches still needs a teaching assignment for teacher workflow writes.

- [ ] **Step 5: Run DB + authorization tests to GREEN**

```bash
pnpm test:db
pnpm test -- tests/unit/authorization.test.ts
```

- [ ] **Step 6: Commit RLS**

```bash
git add supabase/migrations/202609220020_class_subject_group_rls.sql supabase/tests/class_subject_group_rls.test.sql src/lib/auth/authorization.ts tests/unit/authorization.test.ts
git commit -m "feat: secure class subject group model"
```

---

### Task 4: Build the admin Classes/Subjects/Groups application workflow and shared UI foundation

**Files:**
- Create: `src/features/classes/class.types.ts`
- Create: `src/features/classes/class.schemas.ts`
- Create: `src/features/classes/class.repository.ts`
- Create: `src/features/classes/class.service.ts`
- Create: `src/features/classes/class.actions.ts`
- Create: `src/features/classes/class-form.tsx`
- Create: `src/features/classes/class-subject-card.tsx`
- Create: `src/features/classes/class-subject-form.tsx`
- Create: `src/features/classes/subject-group-form.tsx`
- Create: `src/app/[locale]/(protected)/(admin)/classes/page.tsx`
- Create: `src/app/[locale]/(protected)/(admin)/classes/new/page.tsx`
- Create: `src/app/[locale]/(protected)/(admin)/classes/[classId]/page.tsx`
- Modify: `src/components/layout/app-navigation.tsx`
- Modify: `src/components/ui/button.tsx`
- Create: `src/components/ui/form-field.tsx`
- Modify: `src/app/globals.css`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Test: `tests/unit/app-navigation.test.ts`
- Create test: `tests/unit/class-schemas.test.ts`

**Interfaces:**
- Produces admin CRUD/service APIs for Class, reusable Subject, Class Subject, optional Group, default Group selection.
- UI never exposes database terms like `class_subject_id`.

- [ ] **Step 1: Read local Next.js documentation before changing App Router code**

Run:
```bash
find node_modules/next/dist/docs -type f | sort | head -80
```
Read the local guides for App Router pages/layouts, Server Actions, forms, caching/revalidation, and async route params. Do not rely on remembered Next.js APIs.

- [ ] **Step 2: Write RED schema/navigation tests**

Pin validation for bilingual optional names, required English display names, Subject selection, Group creation, and navigation containing exactly:
```text
Dashboard | Classes | Students | Teachers | Reports | Settings
```

- [ ] **Step 3: Implement focused domain types/repository/service/action boundaries**

Use types equivalent to:
```ts
export type ClassSummary = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  activeStudentCount: number;
  subjects: ClassSubjectSummary[];
};

export type ClassSubjectSummary = {
  id: string;
  subject: {id: string; nameEn: string; nameAr: string | null};
  groups: Array<{id: string; nameEn: string; nameAr: string | null; isDefault: boolean}>;
  teacherCount: number;
};
```
Server Actions validate Zod input, require admin, call service/repository, then revalidate affected Class/admin routes.

- [ ] **Step 4: Implement the Classes page and Class detail progressive disclosure**

The Class detail is the main organizational screen. A Subject with zero Groups displays `Whole class`; Group controls appear only when Groups are enabled/created. Changing default Group shows explicitly that existing students will not move.

- [ ] **Step 5: Establish shared visual primitives while touching these screens**

Create a visible-label `FormField` wrapper and normalize button variants: `primary`, `secondary`, `danger`. In `globals.css`, establish one MCE primary accent, neutral surfaces, visible borders/focus, readable body text, semantic status variables, and logical RTL-safe spacing. Do not add gradients or a logo.

- [ ] **Step 6: Add complete EN/AR copy and RTL checks**

No visible string remains hardcoded in the new Classes UI. Arabic uses actual document RTL and logical spacing.

- [ ] **Step 7: Run focused tests then gate**

```bash
pnpm test -- tests/unit/class-schemas.test.ts tests/unit/app-navigation.test.ts
pnpm lint
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 8: Commit Classes UI/domain**

```bash
git add src/features/classes src/app/'[locale]'/'(protected)'/'(admin)'/classes src/components src/app/globals.css messages tests/unit
git commit -m "feat: add class subject group administration"
```

---

### Task 5: Replace global student transfer with Class enrollment, automatic Subject participation, exclusions, and per-Subject Group membership

**Files:**
- Create: `src/features/enrollment/enrollment.types.ts`
- Create: `src/features/enrollment/enrollment.schemas.ts`
- Create: `src/features/enrollment/enrollment.repository.ts`
- Create: `src/features/enrollment/enrollment.service.ts`
- Modify: `src/features/students/student-form.tsx`
- Modify: `src/features/students/student.actions.ts`
- Modify: `src/features/students/student.repository.ts`
- Modify: `src/features/students/student.types.ts`
- Remove from active routes: `src/features/students/student-transfer-form.tsx`
- Modify: student admin pages under `src/app/[locale]/(protected)/(admin)/students/`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Create: `tests/unit/enrollment.test.ts`
- Modify: `supabase/tests/class_subject_group.test.sql`

**Interfaces:**
- Produces `createStudentWithEnrollment`, `changeStudentClass`, `setSubjectExcluded`, `moveStudentSubjectGroup`.
- Consumes Class/Subject/Group APIs from Task 4.

- [ ] **Step 1: Write RED unit tests for participation rules**

Cover:
```ts
it('inherits active class subjects unless excluded');
it('uses the default group only for new or unassigned students');
it('does not move existing students when default group changes');
it('moves a student only inside one class subject and preserves old membership');
it('class change ends old enrollment and initializes new subject defaults');
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
pnpm test -- tests/unit/enrollment.test.ts
```

- [ ] **Step 3: Implement transaction-oriented enrollment services/RPCs**

Do not compose multi-row Class moves as unrelated browser mutations. Use one server-side transaction/RPC for each operation. A Class change must end old enrollment/memberships, create the new enrollment, and create memberships only for grouped non-excluded Subjects with defaults.

- [ ] **Step 4: Replace the Student form's single Group field with Class + derived Subjects**

Form behavior:
```text
Class *
Subjects
  Quran       Included      Group A
  Arabic      Included      Whole class
  Islamic     Excluded
```
Subjects are included by default; admin changes only exclusions or Group selection. If a grouped Subject temporarily has no default, show an actionable `Group assignment needed` state rather than silently inventing a Group.

- [ ] **Step 5: Remove the old global Move Group behavior from active UI**

The UI must expose `Change Class` and per-Subject `Change Group`; legacy `StudentTransferForm` must no longer be reachable from current navigation/routes.

- [ ] **Step 6: Run unit + DB tests**

```bash
pnpm test -- tests/unit/enrollment.test.ts tests/unit/administration-schemas.test.ts
pnpm test:db
pnpm typecheck
```

- [ ] **Step 7: Commit student enrollment redesign**

```bash
git add src/features/enrollment src/features/students src/app/'[locale]'/'(protected)'/'(admin)'/students messages tests supabase/tests
git commit -m "feat: redesign student class and subject enrollment"
```

---

### Task 6: Replace primary-teacher assignment UI and fix existing-auth teacher invitation

**Files:**
- Create: `src/features/teaching-assignments/teaching-assignment.types.ts`
- Create: `src/features/teaching-assignments/teaching-assignment.schemas.ts`
- Create: `src/features/teaching-assignments/teaching-assignment.repository.ts`
- Create: `src/features/teaching-assignments/teaching-assignment.service.ts`
- Modify: `src/features/teachers/teacher-form.tsx`
- Modify: `src/features/teachers/teacher.actions.ts`
- Modify: `src/features/teachers/teacher.repository.ts`
- Modify: `src/features/teachers/teacher.service.ts`
- Modify: `src/features/teachers/teacher.types.ts`
- Modify: teacher admin pages
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Modify: `tests/unit/teacher-invitation.test.ts`
- Create: `tests/unit/teaching-assignments.test.ts`

**Interfaces:**
- Produces effective teaching-context expansion: a whole-Class-Subject assignment expands to all active Groups, or to one whole-class context when there are no Groups; duplicate exact Group assignment does not duplicate effective context.
- Produces safe onboarding behavior for new email vs existing unclaimed Auth user.

- [ ] **Step 1: Write RED tests for unlimited assignments and context deduplication**

Pin cases where one teacher has multiple Subjects/Classes, two teachers share one Group, and one teacher has both whole-Subject and exact-Group access. Expected effective context list contains each context once.

- [ ] **Step 2: Add regression test for the production `email_exists` failure**

Given an Auth user with the requested normalized email and no linked same-school profile, `createTeacher` must link/reuse the account path instead of calling `inviteUserByEmail` again. Existing linked profile must return a safe duplicate message rather than creating another profile.

- [ ] **Step 3: Implement assignment repository/service**

Expose operations equivalent to:
```ts
assignTeacher({teacherProfileId, classSubjectId, subjectGroupId, startsOn});
endTeacherAssignment({assignmentId, endsOn});
listEffectiveTeachingContexts({teacherProfileId, onDate});
```
`subjectGroupId: null` means whole Class Subject. There is no primary/assistant field.

- [ ] **Step 4: Replace checkbox/reassignment UI with context-based assignment UI**

Admin chooses Teacher, Class, Subject, then scope `Entire subject` or one Group. If whole-subject access already covers a Group, explain that access exists rather than adding redundant assignment.

- [ ] **Step 5: Fix invitation/account reuse service**

Normalize email before lookup. Branch explicitly:
```ts
if (linkedProfile) return duplicateProfileOutcome;
if (existingAuthUser) return linkExistingAuthUser(...);
return inviteNewAuthUser(...);
```
Do not expose whether arbitrary login emails exist on public recovery screens; this behavior is admin-only teacher provisioning.

- [ ] **Step 6: Run tests**

```bash
pnpm test -- tests/unit/teaching-assignments.test.ts tests/unit/teacher-invitation.test.ts
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/features/teaching-assignments src/features/teachers src/app/'[locale]'/'(protected)'/'(admin)'/teachers messages tests/unit
git commit -m "feat: add flexible teaching assignments"
```

---

### Task 7: Introduce independent weekly teacher submissions and Present/Absent observations

**Files:**
- Create: `supabase/migrations/202609220021_weekly_teaching_submissions.sql`
- Create: `supabase/tests/weekly_teaching_submissions.test.sql`
- Modify: `src/features/weekly-updates/weekly-update.types.ts`
- Modify: `src/features/weekly-updates/weekly-update.model.ts`
- Modify: `src/features/weekly-updates/weekly-update.schemas.ts`
- Modify: `src/features/weekly-updates/weekly-update.repository.ts`
- Modify: `src/features/weekly-updates/weekly-update.actions.ts`
- Modify: `src/features/weekly-updates/weekly-update-form.tsx`
- Replace active teacher routes from `my-groups` semantics to `my-teaching` routes under `src/app/[locale]/(protected)/(teacher)/`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Modify: `tests/unit/weekly-update.test.ts`
- Modify: `tests/unit/weekly-update-form.test.tsx`

**Interfaces:**
- Produces `weekly_submissions` and `weekly_submission_students` with one logical submission per `(school, class_subject, optional subject_group, teacher, week_start)`.
- `weekly_submission_students.attendance_status` is only `PRESENT | ABSENT`.

- [ ] **Step 1: Write RED database tests**

Prove:
```text
Ahmed and Omar can submit Quran Group A in the same week
Ahmed cannot create a duplicate logical submission for that same context/week
whole-class Subject supports subject_group_id = null
Group must belong to the Class Subject
teacher must have effective assignment on week/date
Late/Excused cannot be stored in the new attendance column
```

- [ ] **Step 2: Write RED unit/form tests**

Change new types to:
```ts
export type TeachingContext = {
  classSubjectId: string;
  subjectGroupId: string | null;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
};
export type AttendanceStatus = 'PRESENT' | 'ABSENT';
```
Form test must assert `Mark all Present`, only Present/Absent choices, sparse student-specific controls, and 360px-safe structure.

- [ ] **Step 3: Implement migration 21 and RLS in the same ownership boundary**

`weekly_submissions` stores shared progress/default performance and draft/submitted state. `weekly_submission_students` stores each roster student's teacher attendance observation plus optional sparse overrides/comments. Add policies so a teacher reads/writes only their own submission for an authorized context; admin can review all school submissions.

- [ ] **Step 4: Rewrite repository/history queries around authorship and effective contexts**

Teacher History must query submissions where `teacher_profile_id = current profile`, not all submissions in currently assigned contexts. This fixes the current co-teacher/history leak.

- [ ] **Step 5: Replace My Groups UI with My Teaching cards**

Each effective context card shows Class, Subject, Group or `Whole class`, student count, current-week status, and one prominent update action. Whole-subject assignments that expand to several Groups show one card per actual Group context, deduplicated.

- [ ] **Step 6: Run DB/unit tests**

```bash
pnpm db:reset
pnpm test:db
pnpm test -- tests/unit/weekly-update.test.ts tests/unit/weekly-update-form.test.tsx
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202609220021_weekly_teaching_submissions.sql supabase/tests/weekly_teaching_submissions.test.sql src/features/weekly-updates src/app/'[locale]'/'(protected)'/'(teacher)' messages tests/unit
git commit -m "feat: add independent weekly teaching submissions"
```

---

### Task 8: Add official attendance resolution and actionable dashboards

**Files:**
- Create: `supabase/migrations/202609220022_attendance_resolution.sql`
- Create: `supabase/tests/attendance_resolution.test.sql`
- Create: `src/features/attendance/attendance.types.ts`
- Create: `src/features/attendance/attendance.repository.ts`
- Create: `src/features/attendance/attendance.service.ts`
- Create: `src/features/attendance/attendance.actions.ts`
- Create: `src/features/attendance/attendance-conflict-list.tsx`
- Modify: `src/features/dashboard/dashboard.model.ts`
- Modify: `src/features/dashboard/dashboard.repository.ts`
- Modify: admin dashboard page
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Modify: `tests/unit/dashboard.test.ts`
- Create: `tests/unit/attendance-resolution.test.ts`

**Interfaces:**
- Produces `getEffectiveAttendance(context, week, student)` and `resolveAttendanceConflict(...)`.
- Dashboard counts expected/submitted teacher-context updates, not simply Groups.

- [ ] **Step 1: Write RED tests for consensus, conflict, and manual resolution**

Cases:
```text
PRESENT + PRESENT => official PRESENT, no conflict
ABSENT + ABSENT => official ABSENT, no conflict
PRESENT + ABSENT => conflict, no official value until resolution
admin resolves conflict to PRESENT => official PRESENT
same student/context/week counts exactly one attendance occurrence
```

- [ ] **Step 2: Implement migration 22**

Create an `attendance_resolutions` table keyed by school + Class Subject + optional Group + week + student. Store admin resolution only when needed; consensus can be derived from submitted teacher observations. Ensure a later unrelated teacher/context cannot overwrite another context's resolution.

- [ ] **Step 3: Implement service and admin conflict UI**

Only admin may resolve. Teacher observations remain unchanged/auditable internally.

- [ ] **Step 4: Rewrite dashboard summary**

Expected weekly updates = distinct effective `(teacher, Class Subject, Group-or-whole-class)` contexts for active assignments in the school week. Display submitted, draft, missing; attendance conflicts; report batches needing review. Do not mark an entire Class/Subject as submitted because one co-teacher submitted.

- [ ] **Step 5: Run tests**

```bash
pnpm test:db
pnpm test -- tests/unit/attendance-resolution.test.ts tests/unit/dashboard.test.ts
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609220022_attendance_resolution.sql supabase/tests/attendance_resolution.test.sql src/features/attendance src/features/dashboard src/app/'[locale]'/'(protected)'/'(admin)'/dashboard messages tests/unit
git commit -m "feat: resolve co-teacher attendance conflicts"
```

---

### Task 9: Redesign reports around admin-approved subject sections and immutable snapshot v2

**Files:**
- Create: `supabase/migrations/202609220023_subject_aware_reports.sql`
- Create: `supabase/tests/subject_aware_reports.test.sql`
- Modify: `src/features/reports/report.types.ts`
- Modify: `src/features/reports/report.schemas.ts`
- Modify: `src/features/reports/report.repository.ts`
- Modify: `src/features/reports/report.service.ts`
- Modify: `src/features/reports/report.renderer.tsx`
- Modify: `src/features/reports/report.actions.ts`
- Create: `src/features/reports/report-composer.tsx`
- Create: `src/features/reports/report-batch-summary.tsx`
- Modify: report admin pages
- Modify: `src/features/email/report-email.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Modify: `tests/unit/report-service.test.ts`
- Create: `tests/unit/report-composer.test.tsx`

**Interfaces:**
- Produces reusable school/Subject template records, report batches/scopes, approved period content, student-specific approved overrides, and `ReportSnapshot` version 2.
- Consumes submitted weekly teacher sources and official attendance from Tasks 7-8.

- [ ] **Step 1: Write RED report-service tests around subject-aware output**

Define snapshot v2 equivalent to:
```ts
export type ReportSnapshotV2 = {
  version: 2;
  school: {nameEn: string; nameAr: string};
  student: {id: string; nameEn: string; nameAr: string | null};
  class: {id: string; nameEn: string; nameAr: string | null};
  period: {start: string; end: string};
  language: 'en' | 'ar' | 'both';
  sections: Array<{
    classSubjectId: string;
    subjectNameEn: string;
    subjectNameAr: string | null;
    groupNameEn: string | null;
    groupNameAr: string | null;
    approvedProgressEn: string | null;
    approvedProgressAr: string | null;
    performance: 'EXCELLENT' | 'GOOD' | 'DEVELOPING' | 'NEEDS_SUPPORT' | null;
    attendance: {present: number; absent: number; sessions: number};
    commentEn: string | null;
    commentAr: string | null;
  }>;
  template: {introEn: string | null; introAr: string | null; closingEn: string | null; closingAr: string | null};
  author: 'MCE Weekend School';
  generatedAt: string;
};
```
Tests must prove teacher names never appear in the parent snapshot/renderer, two Subjects do not mix performance/progress, and unresolved attendance conflicts block readiness for the affected section.

- [ ] **Step 2: Write RED composer tests**

Admin can select one teacher source, multiple source blocks, or custom official text. Shared approved period content applies to all relevant students; optional personalized student content overrides/adds only where chosen.

- [ ] **Step 3: Implement migration 23**

Create normalized template/approval/batch metadata needed to compose snapshots. Preserve existing `reports`/`email_deliveries` IDs and delivery idempotency where possible; store v2 JSON snapshots in the existing report row or a versioned successor without mutating old v1 snapshots.

- [ ] **Step 4: Implement Class/Subject/Group scope and period selection**

Period presets resolve to start/end dates; no separate weekly/monthly report type is stored. Class scope generates one student report containing all selected applicable Subjects; Subject and Group scopes narrow sections.

- [ ] **Step 5: Implement admin composer and batch-first review**

Show source submissions with internal teacher names, then official content controls. Batch summary surfaces `ready automatically`, `personalized comments`, `attendance conflicts`, and missing data. Do not require opening every student.

- [ ] **Step 6: Implement Draft -> Review -> Finalize -> Send immutability**

Finalization copies labels, attendance totals, approved wording/performance/comments, template text, and authorship into the snapshot. Editing teacher data/templates later must not change finalized output. A correction creates a new revision/version.

- [ ] **Step 7: Update browser/email renderer from the same snapshot**

Keep fallback rules: render available teacher/admin-authored language when the requested language is missing; never auto-translate.

- [ ] **Step 8: Run report/DB tests**

```bash
pnpm test:db
pnpm test -- tests/unit/report-service.test.ts tests/unit/report-composer.test.tsx
pnpm typecheck
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/202609220023_subject_aware_reports.sql supabase/tests/subject_aware_reports.test.sql src/features/reports src/features/email/report-email.tsx src/app/'[locale]'/'(protected)'/'(admin)'/reports messages tests/unit
git commit -m "feat: add subject aware report composer"
```

---

### Task 10: Add archive/restore, permanent deletion impact, and protected exports

**Files:**
- Create: `supabase/migrations/202609220024_archives_and_delete.sql`
- Create: `supabase/tests/archives_and_delete.test.sql`
- Create: `src/features/archives/archive.types.ts`
- Create: `src/features/archives/archive.repository.ts`
- Create: `src/features/archives/archive.service.ts`
- Create: `src/features/archives/archive.actions.ts`
- Create: `src/features/archives/delete-impact-dialog.tsx`
- Create: `src/app/[locale]/(protected)/(admin)/settings/archives/page.tsx`
- Create: `src/features/exports/export.schemas.ts`
- Create: `src/features/exports/export.service.ts`
- Create: `src/features/exports/export.repository.ts`
- Create: `src/features/exports/export-panel.tsx`
- Create: `src/app/api/exports/[exportId]/route.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Create: `tests/unit/archive-delete.test.ts`
- Create: `tests/unit/export-service.test.ts`

**Interfaces:**
- Produces `getDeleteImpact`, `archiveEntity`, `restoreEntity`, `permanentlyDeleteArchivedEntity`.
- Produces protected export request/result with period, scope, selected datasets, `.xlsx` primary workbook, optional CSVs, finalized-report PDFs, and ZIP bundle when multiple files are selected.

- [ ] **Step 1: Write RED delete-impact tests**

Verify an archived Student impact includes memberships, attendance observations/resolutions, comments, reports, and delivery rows; deletion removes only that school/entity graph. Active target deletion is rejected. Unrelated students and other-school rows remain.

- [ ] **Step 2: Write RED export tests**

Validate filters for week/month/custom/all-history and scopes school/Class/Subject/Group/Student/Teacher. A Student export must not contain another student's rows; teacher export must contain their authored submissions/assignments but not unrelated guardian data.

- [ ] **Step 3: Choose minimal maintained file-generation dependencies during implementation**

Before installing, inspect current package compatibility and select focused libraries for XLSX and ZIP/PDF only if the existing runtime lacks a safe implementation. Record exact chosen packages/versions in the commit. Do not add a generic reporting framework.

- [ ] **Step 4: Implement transactional archive/delete RPCs**

`getDeleteImpact` returns counts/categories before mutation. Permanent delete requires admin, same school, archived state, and explicit confirmation token/input. Delete dependent rows in a controlled transaction. Do not rely on hidden broad `ON DELETE CASCADE` as the user-facing behavior.

- [ ] **Step 5: Implement protected temporary export delivery**

Generate on demand server-side. The download route verifies active admin + school ownership of the export request, streams the file, and does not create a permanent public URL. Add expiry/cleanup metadata for generated artifacts or generate synchronously where bounded.

- [ ] **Step 6: Add Archives and Export UI**

Archives show Restore, View data/history, Download data, Permanently delete. Delete dialog displays impact counts and `Download data first`. Export UI supports approved period/scope/dataset controls.

- [ ] **Step 7: Run tests**

```bash
pnpm test:db
pnpm test -- tests/unit/archive-delete.test.ts tests/unit/export-service.test.ts
pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/202609220024_archives_and_delete.sql supabase/tests/archives_and_delete.test.sql src/features/archives src/features/exports src/app/api/exports src/app/'[locale]'/'(protected)'/'(admin)'/settings/archives package.json pnpm-lock.yaml messages tests/unit
git commit -m "feat: add archives deletion and data export"
```

---

### Task 11: Finish the UI system, auth-field regression, bilingual accessibility, and current-route cleanup

**Files:**
- Create: `src/components/ui/text-input.tsx`
- Create: `src/components/ui/select-field.tsx`
- Create: `src/components/ui/status-badge.tsx`
- Modify: `src/app/[locale]/(auth)/login/login-form.tsx`
- Modify: `src/app/[locale]/(auth)/forgot-password/forgot-password-form.tsx`
- Modify: `src/app/[locale]/(auth)/set-password/set-password-form.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/layout/app-navigation.tsx`
- Modify: old admin/teacher route redirects or removal points for `/groups` and `/my-groups`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Modify: `tests/unit/set-password-routing.test.ts`
- Create: `tests/unit/auth-form-style.test.tsx`
- Modify: `tests/unit/app-navigation.test.ts`

**Interfaces:**
- Shared controls used by auth and redesigned forms; no business rules.

- [ ] **Step 1: Write RED auth style/accessibility regression test**

Render Login, Forgot Password, and Set Password and assert each password/text field uses the same visible input primitive, has an associated visible label, and receives the shared bordered/focusable class contract.

- [ ] **Step 2: Implement shared input/select/status primitives**

Avoid page-specific `.login-form input` styling. Put input appearance on the actual reusable component so Set Password cannot silently lose it.

- [ ] **Step 3: Finish responsive/RTL visual pass**

Verify logical CSS properties, focus visibility, sufficient contrast, large teacher tap targets, status text in addition to color, no horizontal scrolling in normal 360px teacher flow, and clear primary/secondary/destructive action hierarchy.

- [ ] **Step 4: Redirect or remove obsolete active routes**

Old `/groups` should lead to `/classes`; old `/my-groups` should lead to `/my-teaching` while preserving locale. Do not leave two competing admin concepts visible.

- [ ] **Step 5: Run focused UI tests plus lint/typecheck**

```bash
pnpm test -- tests/unit/auth-form-style.test.tsx tests/unit/set-password-routing.test.ts tests/unit/app-navigation.test.ts
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components src/app src/messages messages tests/unit
git commit -m "feat: unify bilingual application UI"
```

If `src/messages` does not exist, do not stage it; all translation files remain under repository `messages/`.

---

### Task 12: Rewrite end-to-end flows for the approved architecture and run the full local release gate

**Files:**
- Modify: `tests/e2e/english-flow.spec.ts`
- Modify: `tests/e2e/arabic-flow.spec.ts`
- Modify: `tests/e2e/authorization.spec.ts`
- Modify: `tests/e2e/student-exception.spec.ts`
- Create: `tests/e2e/co-teacher-attendance.spec.ts`
- Create: `tests/e2e/archive-export.spec.ts`
- Modify: E2E helpers/fixtures as required
- Modify: `supabase/seed.sql` for local-only test data only
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Produces executable proof of the corrected Phase 1 workflow.

- [ ] **Step 1: Update local seed to represent the new architecture only for local tests**

Seed at least one Class with a whole-class Subject, one grouped Subject, two co-teachers on the same Group, and students with normal/default/excluded cases. Keep the existing guard that refuses hosted Supabase URLs.

- [ ] **Step 2: Rewrite the English E2E around the new happy path**

Flow:
```text
Admin -> Class -> Subject -> Group/default -> Student/Class -> teacher assignments
Teacher 1 submits weekly update
Teacher 2 submits same context independently
Admin reviews grouped submissions and resolves conflict if created
Admin prepares Class report -> approves shared content -> finalizes -> previews
```

- [ ] **Step 3: Rewrite Arabic/RTL E2E**

Use the same real workflow under `/ar`, assert `dir="rtl"`, Arabic navigation/forms, teacher weekly submission, and Arabic/bilingual report rendering.

- [ ] **Step 4: Rewrite authorization E2E**

A Group-only teacher cannot access sibling Group/student, cannot finalize report/export/delete, and cannot edit co-teacher submission.

- [ ] **Step 5: Add archive/export E2E**

Archive a safe record, verify it leaves active lists, restore it, archive again, request download impact/export, then permanently delete a test-only archived entity and verify dependent test history is gone without touching a sibling entity.

- [ ] **Step 6: Run complete local gate from a reset database**

```bash
pnpm db:reset
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
```
Expected: all commands PASS. Do not accept static/mocked substitutes for PostgreSQL/RLS/Auth/browser failures.

- [ ] **Step 7: Record observed counts/results in `docs/PROGRESS.md`**

Record exact test counts and build outcome from command output; do not copy expected numbers from this plan.

- [ ] **Step 8: Commit local release gate**

```bash
git add tests/e2e supabase/seed.sql docs/PROGRESS.md
git commit -m "test: verify redesigned phase one workflows"
```

---

### Task 13: Preview deployment, hosted forward migrations, production smoke test, and Phase 2 gate

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md` only after observed release result

**Interfaces:**
- Consumes all prior tasks.
- Produces corrected Phase 1 release evidence and either opens or keeps closed the Phase 2 CSV gate.

- [ ] **Step 1: Push the implementation branch and inspect the Vercel preview**

Verify build is READY. Exercise login, Classes, student, teacher assignment, My Teaching, weekly update, attendance, report composer, and auth recovery field styling in the preview against an appropriate non-production/local-safe environment.

- [ ] **Step 2: Inspect hosted production data immediately before migration**

Run read-only counts for Classes/legacy groups/students/memberships/submissions/reports and compare with the expected minimal production state. If unexpected real student/session/report data appeared since design approval, stop and adjust migration verification before any destructive step.

- [ ] **Step 3: Apply only forward migrations 19-24 to hosted Supabase in order**

Do **not** run `db reset` or seed against hosted. Verify remote migration history after each migration batch.

- [ ] **Step 4: Run hosted SQL safety checks**

Verify:
```text
legacy root groups were represented as Classes
no fake Subjects were invented
new tables are school-scoped
RLS enabled on all new owned tables
anonymous EXECUTE is absent from SECURITY DEFINER functions
existing admin/teacher Auth/profile rows remain intact
```

- [ ] **Step 5: Deploy production code after hosted schema is ready**

Do not deploy code that depends on unapplied schema.

- [ ] **Step 6: Run production smoke tests without destructive sample-data creation**

At minimum: English login, Arabic login/RTL shell, current admin navigation, existing Class mapping, teacher invitation/reuse behavior using an approved safe test account if available, password recovery/set-password appearance, and read-only dashboard/report pages. Any workflow requiring disposable records must be explicitly created and cleaned through the approved admin UI, not via dev seed.

- [ ] **Step 7: Review runtime errors after smoke testing**

Confirm the prior `primary teacher conflict` and `email_exists` failure paths no longer occur in the corrected flows. Investigate any new 4xx/5xx/server exceptions before declaring release complete.

- [ ] **Step 8: Update docs from observed release evidence**

Only if all gates pass, mark the architecture correction released and unblock planning for Phase 2 CSV against the new Class/Subject/Group model. If any gate fails, keep Phase 2 blocked and record the blocker.

- [ ] **Step 9: Commit release documentation**

```bash
git add docs/PROGRESS.md docs/IMPLEMENTATION_PLAN.md
git commit -m "docs: record redesigned phase one release"
```

---

## Self-review notes

### Spec coverage

- Core Class/Subject/optional Group model: Tasks 2-5.
- Student automatic Subject participation, exclusions, default Group, one Group/Subject, one Class: Tasks 2 and 5.
- Flexible multi-teacher assignments and existing-auth invitation regression: Task 6.
- Independent weekly teacher submissions, sparse exceptions, Present/Absent only: Task 7.
- Co-teacher attendance consensus/conflict/admin resolution and dashboard: Task 8.
- Weekly/monthly/custom period, Class/Subject/Group scope, reusable wording, admin composer, no teacher names, MCE authorship, immutable finalization: Task 9.
- Friendly navigation/colors/fonts/buttons/forms, mobile and RTL, password input regression: Tasks 4 and 11.
- Archive/restore/permanent delete with impact and period/scope export: Task 10.
- Server auth + RLS + cross-school isolation: Tasks 2-3 and feature migrations.
- Full DB/unit/browser/build gate and hosted forward-only rollout: Tasks 12-13.
- Phase 2 CSV remains blocked until Task 13 passes.

### Placeholder scan

This plan intentionally contains no `TBD`, `TODO`, “similar to Task N”, or unspecified “add tests” steps. Where a dependency choice is not safely knowable until execution (XLSX/ZIP/PDF library), Task 10 defines the selection criteria and requires the exact chosen versions to be recorded before use rather than preselecting an unverified dependency.

### Type/interface consistency

The plan uses `ClassSubject`, optional `subjectGroupId`, dated Class/Group/teacher relations, `TeachingContext`, `PRESENT | ABSENT`, and report snapshot v2 consistently across later tasks. Whole-subject access expands to concrete Group contexts only when Groups exist and is deduplicated against exact Group assignment.

### Review Focus coverage

- whole-subject + exact Group deduplication: Tasks 6-7 tests;
- default Group not moving existing students: Tasks 2 and 5 tests;
- co-teacher attendance conflict: Task 8 DB/unit/E2E;
- Subject exclusion boundaries: Tasks 2, 3, 5;
- permanent deletion/finalized-report impact: Task 10 unit/DB/E2E.
