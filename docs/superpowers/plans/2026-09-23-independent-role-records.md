# Independent Role Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-role `profiles.role` model with independent Administrator and Teacher business records while preserving existing Guardian/Student records, historical teaching attribution, and authenticated account/audit identity.

**Architecture:** Keep `public.profiles` as login identity only. Add independent `administrators` and `teachers` tables plus explicit account-link tables, move teacher-owned data from profile IDs to Teacher IDs, and authorize Admin/Teacher capabilities through active links rather than email/name matching or a single role enum. Deliver the database work as one forward-only migration and the application work as one coordinated PR.

**Tech Stack:** Next.js 16.3.5, React 19.2.0, TypeScript 5.9.3, Supabase/PostgreSQL 17, RLS/pgTAP, Vitest 5, Playwright 1.63, next-intl 4.13.7, Zod 4.1.11, pnpm 11.19.0.

**Spec:** `docs/superpowers/specs/2026-09-23-independent-role-records-design.md`

## Global Constraints

- Administrator, Teacher, Guardian, and Student are independent business records; no role implies another.
- Matching names or business emails must never automatically merge, grant, remove, or prohibit another role.
- Duplicate names and business emails are permitted across roles and within a role unless an existing domain rule unrelated to identity requires otherwise.
- Supabase Auth email uniqueness applies only to login accounts; business-record emails are not authorization identifiers.
- Teaching assignments and teacher-authored history reference Teacher IDs only.
- Admin audit/actor fields continue to reference authenticated `profiles.id` where they describe who performed the action.
- The existing production account must migrate as Administrator-only because production currently has one ADMIN profile and no TEACHER profile.
- Existing migrations 1-27 remain immutable. Create exactly one new forward-only migration for this refactor.
- All new public tables must have RLS enabled and forced.
- All changed UI remains bilingual EN/AR and RTL-safe.
- Do not apply the new migration to hosted production until local database/RLS, quality/build, and targeted browser verification are green.
- Do not infer authorization from email or name anywhere in application code or RLS.
- Use TDD: every task starts with an intended failing test and ends with fresh verification.

## Review Focus

1. **Existing Auth email reused by a new Teacher:** Teacher creation must succeed without changing or auto-linking the existing Administrator account; explicit access linking is a separate action. Pin this in Task 4.
2. **Admin-only production-style backfill:** an ADMIN legacy profile becomes Administrator + account link only, never a Teacher. Pin this in Task 1.
3. **Dual-capability account:** one profile explicitly linked to both Administrator and Teacher keeps both navigation/access paths without collapsing the two records. Pin this in Tasks 2 and 5.
4. **Teacher unlink/deactivation:** Admin access and historical Teacher attribution remain intact after Teacher access is removed. Pin this in Tasks 2, 3, and 4.
5. **Cross-school explicit links:** the database rejects Administrator/Teacher account links or teaching assignments that cross school boundaries, even if email/name values match. Pin this in Tasks 1-3.

---

## File Structure

### New files

- `supabase/tests/independent_roles.test.sql` — pgTAP contract for independent role records, migration/backfill, explicit links, and cross-school safety.
- `tests/unit/independent-role-authorization.test.ts` — pure authorization contract for independent Admin/Teacher capabilities.
- `tests/unit/teacher-independent-identity.test.ts` — teacher creation/access contract proving email/name reuse does not create cross-role coupling.
- `tests/unit/multi-capability-navigation.test.ts` — navigation contract for Admin-only, Teacher-only, and Admin+Teacher accounts.
- `tests/e2e/independent-role-records.spec.ts` — targeted browser workflow for Admin-only, Teacher-only, and explicit Admin+Teacher access.
- One CLI-generated migration from `pnpm exec supabase migration new independent_role_records`; use the exact generated `supabase/migrations/*_independent_role_records.sql` path printed by the CLI. Do not hand-invent a migration timestamp.

### Primary modified files

- `src/features/profiles/profile.types.ts` — remove business role from authenticated profile shape; add capability shape.
- `src/lib/auth/authorization.ts` — replace single-role assertions with capability/link assertions.
- `src/lib/auth/require-profile.ts` — load account profile and explicit Admin/Teacher capabilities.
- `src/lib/auth/navigation.ts` — build navigation from capability set rather than one role.
- `src/app/[locale]/(protected)/layout.tsx` — render combined navigation for explicit capabilities.
- `src/app/[locale]/(protected)/(admin)/layout.tsx` — require Administrator capability, not `profiles.role`.
- `src/features/teachers/teacher.repository.ts` — read/write `teachers`; remove ADMIN teaching candidates.
- `src/features/teachers/teacher.actions.ts` — separate Teacher business creation from login linking/invitation.
- `src/features/teachers/teacher.types.ts` — Teacher IDs/business email/access-link state.
- `src/features/teachers/teacher-form.tsx` — create Teacher without mandatory Auth coupling.
- `src/features/teaching-assignments/teaching-assignment.repository.ts` — use `teacher_id`.
- `src/features/weekly-updates/weekly-update.repository.ts` — resolve linked Teacher IDs and persist Teacher authorship.
- `src/features/classes/class.repository.ts` — use Teacher IDs/counts.
- `src/features/dashboard/dashboard.repository.ts` — use Teacher IDs for teaching context/submission state.
- `src/features/reports/report-batch.repository.ts` — preserve Teacher-source attribution through `teacher_id`.
- `src/features/exports/export.repository.ts` — export Teacher IDs/business metadata instead of profile-role assumptions.
- `messages/en.json`, `messages/ar.json` — remove misleading admin/teacher collision copy and add account-link wording.
- `supabase/seed.e2e.sql` — seed Admin-only, Teacher-only, and Admin+Teacher explicit-link fixtures.
- Existing pgTAP/RLS tests that refer to `profiles.role` or `teacher_profile_id` — update to explicit links/Teacher IDs.
- `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` — supersede the old single-profile-role rule and record the released architecture.

---

### Task 1: Add independent role tables and deterministic legacy backfill

**Files:**
- Create: `supabase/tests/independent_roles.test.sql`
- Create via CLI, then modify: `supabase/migrations/*_independent_role_records.sql`
- Test fixtures referenced by the test: existing base migrations and local Auth fixtures

**Interfaces:**
- Produces `public.administrators(id, school_id, display_name, email, is_active, created_at, updated_at)`.
- Produces `public.teachers(id, school_id, display_name, email, preferred_language, is_active, created_at, updated_at)`.
- Produces `public.administrator_accounts(school_id, administrator_id, profile_id)`.
- Produces `public.teacher_accounts(school_id, teacher_id, profile_id)`.
- Keeps `public.profiles` intact during the additive/backfill portion so later tasks can cut authorization over safely.

- [ ] **Step 1: Create the migration file with the Supabase CLI**

Run:

```bash
pnpm exec supabase migration new independent_role_records
```

Expected: Supabase prints one new file under `supabase/migrations/` ending in `_independent_role_records.sql`. Record that exact path and use it for every migration edit in Tasks 1-3.

- [ ] **Step 2: Write the failing pgTAP contract**

Create `supabase/tests/independent_roles.test.sql` with tests that assume the new tables/links exist and prove the approved semantics. The core assertions must include:

```sql
begin;
select plan(14);

select has_table('public', 'administrators');
select has_table('public', 'teachers');
select has_table('public', 'administrator_accounts');
select has_table('public', 'teacher_accounts');

-- Business email/name reuse is allowed.
select lives_ok($$
  insert into public.teachers (id, school_id, display_name, email)
  values
    ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-000000000001', 'Same Person', 'same@example.test'),
    ('00000000-0000-0000-0000-00000000a102', '00000000-0000-0000-0000-000000000001', 'Same Person', 'same@example.test')
$$, 'teacher business identity does not enforce unique name/email');

-- Explicit account links may coexist for different capabilities.
select lives_ok($$
  insert into public.administrator_accounts (school_id, administrator_id, profile_id)
  values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000b101', '00000000-0000-0000-0000-00000000c101');
  insert into public.teacher_accounts (school_id, teacher_id, profile_id)
  values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000c101');
$$, 'one login profile may explicitly link to Admin and Teacher');

-- Cross-school links must fail via composite FKs.
select throws_ok($$
  insert into public.teacher_accounts (school_id, teacher_id, profile_id)
  values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000c101')
$$, '23503', null, 'cross-school teacher-account link is rejected');

select * from finish();
rollback;
```

Use the repo's existing deterministic fixture UUIDs where available; if the exact IDs above conflict with seed conventions, define fixture rows inside the test before these assertions rather than weakening the assertions.

Also assert the deterministic legacy backfill:
- each legacy `profiles.role = 'ADMIN'` row maps to exactly one Administrator and one Administrator-account link;
- each legacy `profiles.role = 'TEACHER'` row maps to exactly one Teacher and one Teacher-account link;
- an ADMIN profile does **not** receive a Teacher row/link merely because it can authenticate.

- [ ] **Step 3: Run the DB test and verify RED**

Run:

```bash
pnpm db:start
pnpm db:reset
pnpm test:db
```

Expected: FAIL because `administrators`, `teachers`, and account-link tables do not exist yet. Infrastructure failures are not acceptable RED; fix local Supabase startup first if needed.

- [ ] **Step 4: Implement additive tables and backfill in the new migration**

Add the following shape to the CLI-generated migration:

```sql
create table public.administrators (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) > 0),
  email text check (email is null or (email = lower(trim(email)) and position('@' in email) > 1)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) > 0),
  email text check (email is null or (email = lower(trim(email)) and position('@' in email) > 1)),
  preferred_language public.language_code not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.administrator_accounts (
  school_id uuid not null references public.schools(id) on delete restrict,
  administrator_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (school_id, administrator_id, profile_id),
  foreign key (school_id, administrator_id)
    references public.administrators(school_id, id) on delete restrict,
  foreign key (school_id, profile_id)
    references public.profiles(school_id, id) on delete restrict
);

create table public.teacher_accounts (
  school_id uuid not null references public.schools(id) on delete restrict,
  teacher_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (school_id, teacher_id, profile_id),
  foreign key (school_id, teacher_id)
    references public.teachers(school_id, id) on delete restrict,
  foreign key (school_id, profile_id)
    references public.profiles(school_id, id) on delete restrict
);
```

Do not add unique constraints on business names/emails. Add updated-at triggers for Administrator/Teacher rows. Enable and force RLS on all four new public tables before the migration ends.

Backfill with stable one-to-one mapping from legacy profiles. Generate each new role-row ID once in a temporary mapping CTE/table inside the migration, then use that same generated ID for the corresponding account link. Do not match by email. Copy Auth email only as initial business data via `auth.users.id = profiles.auth_user_id`.

- [ ] **Step 5: Run DB tests and verify GREEN for Task 1**

Run:

```bash
pnpm db:reset
pnpm test:db
```

Expected: the new independent-role tests for table shape, duplicate business identity, deterministic legacy backfill, and cross-school link FKs pass. Existing tests may still fail where they intentionally depend on the old role model; those are addressed in Tasks 2-3, but no unrelated schema/reset failure is allowed.

- [ ] **Step 6: Commit Task 1**

```bash
git add supabase/migrations/*_independent_role_records.sql supabase/tests/independent_roles.test.sql
git commit -m "feat: add independent administrator and teacher records"
```

---

### Task 2: Cut authorization and RLS from single role to explicit capability links

**Files:**
- Modify: `supabase/migrations/*_independent_role_records.sql`
- Modify: `supabase/tests/rls.test.sql`
- Modify: `supabase/tests/class_subject_group_rls.test.sql`
- Create: `tests/unit/independent-role-authorization.test.ts`
- Modify: `src/features/profiles/profile.types.ts`
- Modify: `src/lib/auth/authorization.ts`
- Modify: `src/lib/auth/require-profile.ts`
- Modify admin callers currently using `requireProfile(locale, 'ADMIN')`

**Interfaces:**
- Produces `AccountCapabilities = {isAdmin: boolean; teacherIds: string[]}`.
- Produces `requireAccount(locale): Promise<Profile>`.
- Produces `requireAdministrator(locale): Promise<Profile>`.
- Produces `requireTeachingAccount(locale): Promise<{profile: Profile; teacherIds: string[]}>`.
- Database `public.is_admin()` becomes an explicit active Administrator-account existence check.
- Database `public.current_teacher_ids()` returns active explicitly-linked Teacher IDs for the current profile/school.

- [ ] **Step 1: Write failing unit authorization tests**

Create `tests/unit/independent-role-authorization.test.ts` around pure helpers. Required cases:

```ts
it('does not infer teacher capability from administrator capability', () => {
  const capabilities = {isAdmin: true, teacherIds: []};
  expect(canAdmin(capabilities)).toBe(true);
  expect(canTeach(capabilities)).toBe(false);
});

it('supports explicit admin and teacher capabilities simultaneously', () => {
  const capabilities = {isAdmin: true, teacherIds: ['teacher-1']};
  expect(canAdmin(capabilities)).toBe(true);
  expect(canTeach(capabilities)).toBe(true);
});

it('removing teacher links leaves administrator capability intact', () => {
  expect(canAdmin({isAdmin: true, teacherIds: []})).toBe(true);
});
```

- [ ] **Step 2: Extend pgTAP/RLS tests with explicit-link authorization cases**

Add database assertions that:
- Admin authorization exists only through an active `administrator_accounts` link to an active Administrator.
- Teacher authorization exists only through an active `teacher_accounts` link to an active Teacher.
- A profile linked to both has both capabilities.
- Deactivating/unlinking Teacher leaves `is_admin()` true for a dual-linked profile.
- Deactivating/unlinking Administrator leaves Teacher context access available for an explicitly linked/assigned Teacher.
- matching email/name without a link grants nothing.

- [ ] **Step 3: Run targeted tests and verify RED**

Run:

```bash
pnpm test -- tests/unit/independent-role-authorization.test.ts
pnpm db:reset
pnpm test:db
```

Expected: authorization tests fail because current helpers still inspect `profile.role`; RLS cases fail because `is_admin()` and teaching checks still rely on the old profile model.

- [ ] **Step 4: Add database capability helpers and replace RLS predicates**

In the same migration, replace old role semantics with helpers shaped as:

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.administrator_accounts aa
      on aa.school_id = p.school_id and aa.profile_id = p.id
    join public.administrators a
      on a.school_id = aa.school_id and a.id = aa.administrator_id
    where p.auth_user_id = auth.uid()
      and p.is_active
      and a.is_active
  )
$$;

create function public.current_teacher_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.profiles p
  join public.teacher_accounts ta
    on ta.school_id = p.school_id and ta.profile_id = p.id
  join public.teachers t
    on t.school_id = ta.school_id and t.id = ta.teacher_id
  where p.auth_user_id = auth.uid()
    and p.is_active
    and t.is_active
$$;
```

Revoke unintended `PUBLIC` execution and grant only the roles required by existing authenticated flows, following the repo's established function-hardening pattern.

Replace every new/current RLS predicate that means “Administrator” with `public.is_admin()` and every teacher predicate with membership in `public.current_teacher_ids()` plus context assignment checks. Do not use email or name in any policy.

- [ ] **Step 5: Refactor application account/capability helpers**

Change `Profile` to remove `role`:

```ts
export type Profile = {
  id: string;
  schoolId: string;
  displayName: string;
  preferredLanguage: Locale;
  isActive: boolean;
};

export type AccountCapabilities = {
  isAdmin: boolean;
  teacherIds: string[];
};
```

Replace `assertRole` with capability helpers:

```ts
export function canAdmin(capabilities: AccountCapabilities) {
  return capabilities.isAdmin;
}

export function canTeach(capabilities: AccountCapabilities) {
  return capabilities.teacherIds.length > 0;
}
```

`requireProfile` becomes account-only loading. Add `loadAccountCapabilities(profileId, schoolId)` using the explicit link tables, then expose `requireAdministrator(locale)` and `requireTeachingAccount(locale)` wrappers. Update admin route/actions from `requireProfile(locale, 'ADMIN')` to `requireAdministrator(locale)` without changing their downstream `profile.id` audit semantics.

- [ ] **Step 6: Run unit, typecheck, and DB tests**

Run:

```bash
pnpm test -- tests/unit/independent-role-authorization.test.ts tests/unit/authorization.test.ts
pnpm typecheck
pnpm db:reset
pnpm test:db
```

Expected: independent authorization is GREEN; existing authorization contracts are updated to capability semantics; no RLS test relies on `profiles.role` for current behavior.

- [ ] **Step 7: Commit Task 2**

```bash
git add supabase/migrations/*_independent_role_records.sql supabase/tests tests/unit/independent-role-authorization.test.ts src/features/profiles/profile.types.ts src/lib/auth src/app src/features
git commit -m "refactor: authorize explicit administrator and teacher capabilities"
```

---

### Task 3: Move teaching assignments and teacher-authored history to Teacher IDs

**Files:**
- Modify: `supabase/migrations/*_independent_role_records.sql`
- Modify: `supabase/tests/class_subject_group_rls.test.sql`
- Modify weekly/report pgTAP tests referencing `teacher_profile_id`
- Modify: `src/features/teaching-assignments/teaching-assignment.repository.ts`
- Modify: `src/features/weekly-updates/weekly-update.repository.ts`
- Modify: `src/features/classes/class.repository.ts`
- Modify: `src/features/dashboard/dashboard.repository.ts`
- Modify: `src/features/reports/report-batch.repository.ts`
- Modify: `src/features/exports/export.repository.ts`

**Interfaces:**
- `teaching_assignments.teacher_id -> teachers(id)`.
- `weekly_submissions.teacher_id -> teachers(id)`.
- Teacher-owned report/source rows use `teacher_id` where they currently persist teacher profile identity.
- Actor/audit fields such as conflict resolver/export requester/finalizer stay as `profile_id`.
- `teacher_can_teach_context(p_teacher_id uuid, p_class_subject_id uuid, p_subject_group_id uuid, p_on_date date)` operates on Teacher IDs.

- [ ] **Step 1: Write failing migration/history tests**

Extend `supabase/tests/independent_roles.test.sql` and existing weekly tests to assert:

```sql
select col_is_null('public', 'teaching_assignments', 'teacher_profile_id',
  'legacy teacher_profile_id is removed after cutover');
select has_column('public', 'teaching_assignments', 'teacher_id');
select has_column('public', 'weekly_submissions', 'teacher_id');
```

Also create a legacy Teacher profile fixture with an assignment/submitted weekly record before migration backfill, then assert after migration that both rows point to the mapped Teacher ID and remain readable after that Teacher is deactivated.

- [ ] **Step 2: Run DB tests and verify RED**

Run:

```bash
pnpm db:reset
pnpm test:db
```

Expected: FAIL because teacher-owned tables still expose/use `teacher_profile_id`.

- [ ] **Step 3: Implement additive Teacher-ID columns and deterministic backfill**

Inside the same migration:

1. Add nullable `teacher_id` to every teacher-owned table.
2. Backfill using the legacy Teacher profile -> `teacher_accounts` mapping created in Task 1.
3. Assert no unmapped non-null teacher-owned rows remain; raise an exception in the migration if a legacy Teacher reference cannot map.
4. Add same-school foreign keys to `teachers`.
5. Rebuild unique/exclusion constraints/indexes with `teacher_id`.
6. Update triggers/functions such as `teacher_can_teach_context` and weekly validation to accept Teacher IDs.
7. Make required `teacher_id` columns non-null.
8. Drop obsolete Teacher-profile FKs/indexes/columns only after the backfill assertion succeeds.

For `teaching_assignments`, the final shape must be equivalent to:

```sql
teacher_id uuid not null,
constraint teaching_assignments_teacher_school_fk
  foreign key (school_id, teacher_id)
  references public.teachers(school_id, id) on delete restrict
```

and the no-overlap constraint must key on `teacher_id`, not profile ID.

- [ ] **Step 4: Remove `profiles.role` only after role-owned references are cut over**

Still in the same migration:

```sql
drop index if exists public.profiles_school_role_active_idx;
alter table public.profiles drop column role;
```

Drop/replace obsolete `current_app_role()` only after no current RLS/function depends on it. Keep `current_profile_id()` and `current_school_id()` because they identify the authenticated account and school.

- [ ] **Step 5: Refactor repositories from profile IDs to Teacher IDs**

Replace field mappings like:

```ts
teacher_profile_id: row.teacher_profile_id
```

with:

```ts
teacherId: row.teacher_id
```

Teacher-facing weekly flows must resolve explicit linked Teacher IDs from `requireTeachingAccount()`. When a teaching context is loaded, it must carry the concrete `teacherId` owning that assignment. Persist that Teacher ID on drafts/submissions; do not persist the login profile ID as teacher authorship.

- [ ] **Step 6: Verify history and repository contracts**

Run:

```bash
pnpm test -- tests/unit/teaching-assignments.test.ts tests/unit/weekly-update.test.ts tests/unit/report-service.test.ts tests/unit/export-service.test.ts
pnpm typecheck
pnpm db:reset
pnpm test:db
```

Expected: Teacher-owned data is keyed by Teacher ID, submitted history survives Teacher deactivation, and audit/profile actor fields remain unchanged.

- [ ] **Step 7: Commit Task 3**

```bash
git add supabase/migrations/*_independent_role_records.sql supabase/tests src/features/teaching-assignments src/features/weekly-updates src/features/classes src/features/dashboard src/features/reports src/features/exports tests
git commit -m "refactor: key teaching history to teacher records"
```

---

### Task 4: Separate Teacher business creation from account access/linking

**Files:**
- Create: `tests/unit/teacher-independent-identity.test.ts`
- Modify: `src/features/teachers/teacher.repository.ts`
- Modify: `src/features/teachers/teacher.actions.ts`
- Modify: `src/features/teachers/teacher.types.ts`
- Modify: `src/features/teachers/teacher-form.tsx`
- Modify Teacher pages under `src/app/[locale]/(protected)/(admin)/teachers/`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`

**Interfaces:**
- `createTeacher(schoolId, {displayName, email, preferredLanguage}) -> Teacher` creates only a business Teacher row.
- `linkTeacherAccount(schoolId, teacherId, profileId)` creates only the explicit link.
- `ensureTeacherAccess(schoolId, teacherId, loginEmail, redirectTo)` locates/creates Auth + profile only after explicit access action, then links it.
- `unlinkTeacherAccount(schoolId, teacherId, profileId)` removes Teacher login capability only.

- [ ] **Step 1: Write failing identity/access unit contracts**

Create `tests/unit/teacher-independent-identity.test.ts` with at least:

```ts
it('creates a teacher even when an administrator Auth account uses the same email', async () => {
  const teacher = await createTeacherBusinessRecord({
    displayName: 'Mohssen',
    email: 'mohssen.elshaar@gmail.com',
    preferredLanguage: 'en'
  }, deps);
  expect(teacher.email).toBe('mohssen.elshaar@gmail.com');
  expect(deps.linkAccount).not.toHaveBeenCalled();
});

it('does not infer account linking from equal business email', async () => {
  await createTeacherBusinessRecord({displayName: 'Same', email: 'admin@example.test', preferredLanguage: 'en'}, deps);
  expect(deps.lookupAuthByEmail).not.toHaveBeenCalled();
});

it('unlinking teacher access does not remove the login profile or administrator link', async () => {
  await unlinkTeacherAccess('teacher-1', 'profile-1', deps);
  expect(deps.deleteTeacherLink).toHaveBeenCalled();
  expect(deps.deleteProfile).not.toHaveBeenCalled();
  expect(deps.deleteAdministratorLink).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
pnpm test -- tests/unit/teacher-independent-identity.test.ts
```

Expected: FAIL because current invitation flow rejects existing Administrator/Teacher profile emails and couples Teacher creation to Auth invitation.

- [ ] **Step 3: Refactor Teacher repository to `teachers`**

`listTeachers`, `getTeacher`, `updateTeacher`, and activation/deactivation must target `public.teachers` only. Remove `listTeachingCandidates()` logic that includes ADMIN profiles. Teaching candidates become active Teacher rows only.

Teacher list items expose business fields plus explicit account-access state, for example:

```ts
export type TeacherListItem = {
  id: string;
  displayName: string;
  email: string | null;
  preferredLanguage: 'en' | 'ar';
  isActive: boolean;
  assignmentCount: number;
  linkedAccountCount: number;
};
```

- [ ] **Step 4: Split create Teacher from access linking**

Change the default Add Teacher action so it inserts the Teacher business record and redirects successfully without requiring Auth invitation.

Remove these business blockers entirely:
- `administrator already has an account`
- `teacher already has an account`

Add a separate explicit “Send/Link access” action. Its algorithm is:

```ts
1. requireAdministrator(locale)
2. load Teacher by teacherId in the same school
3. validate requested loginEmail
4. find an existing Auth user by normalized login email
5. if found, find/create that Auth user's same-school profiles row
6. if not found, invite Auth user and create the profiles row
7. create teacher_accounts link for (schoolId, teacherId, profileId)
8. never create/remove administrator_accounts based on the email
```

Idempotently handle a link that already exists.

- [ ] **Step 5: Add explicit unlink/deactivate UI**

The Teacher edit page must distinguish:
- Teacher business status (active/inactive/archive actions);
- teaching assignments;
- login access links.

Unlinking one Teacher-account link must not delete `profiles`, `administrator_accounts`, Guardian, or Student records. Deactivating a Teacher must not mutate another role.

Update EN/AR copy to remove the old “already an administrator” message and use explicit terms such as “Teacher record”, “Account access”, “Link access”, and “Remove access”.

- [ ] **Step 6: Verify unit/build-relevant contracts**

Run:

```bash
pnpm test -- tests/unit/teacher-independent-identity.test.ts tests/unit/teacher-invitation.test.ts tests/unit/admin-teaching-assignment-ui.test.ts
pnpm typecheck
```

Update or replace the prior admin-teaching regression test so it now proves the opposite rule: Admin profiles are not teaching candidates without a Teacher record.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/features/teachers src/app/[locale]/\(protected\)/\(admin\)/teachers messages tests/unit
git commit -m "feat: separate teacher records from account access"
```

---

### Task 5: Support Admin-only, Teacher-only, and explicit Admin+Teacher navigation

**Files:**
- Create: `tests/unit/multi-capability-navigation.test.ts`
- Modify: `src/lib/auth/navigation.ts`
- Modify: `src/app/[locale]/(protected)/layout.tsx`
- Modify Teacher protected layout/pages that assume one role
- Modify set-password/login routing tests and routing helpers

**Interfaces:**
- `getNavigationItems(capabilities: AccountCapabilities): readonly NavigationItem[]` returns the union of permitted destinations without role conversion.
- Default post-auth destination rule: Admin capability -> `/dashboard`; otherwise Teacher capability -> `/my-teaching`; otherwise access-unavailable/login reason.

- [ ] **Step 1: Write failing navigation tests**

```ts
it('shows only admin navigation to an admin-only account', () => {
  expect(getNavigationItems({isAdmin: true, teacherIds: []}).map(x => x.href))
    .toContain('/dashboard');
  expect(getNavigationItems({isAdmin: true, teacherIds: []}).map(x => x.href))
    .not.toContain('/my-teaching');
});

it('shows only teacher navigation to a teacher-only account', () => {
  const hrefs = getNavigationItems({isAdmin: false, teacherIds: ['t1']}).map(x => x.href);
  expect(hrefs).toContain('/my-teaching');
  expect(hrefs).not.toContain('/settings');
});

it('shows both areas when the account is explicitly linked to both', () => {
  const hrefs = getNavigationItems({isAdmin: true, teacherIds: ['t1']}).map(x => x.href);
  expect(hrefs).toContain('/dashboard');
  expect(hrefs).toContain('/my-teaching');
});
```

- [ ] **Step 2: Run navigation/routing tests and verify RED**

Run:

```bash
pnpm test -- tests/unit/multi-capability-navigation.test.ts tests/unit/app-navigation.test.tsx tests/unit/set-password-routing.test.tsx
```

Expected: FAIL because navigation currently accepts a single `AppRole`.

- [ ] **Step 3: Replace role-based navigation with capability union**

Remove `AppRole` as the account/navigation discriminator. Keep Admin and Teacher navigation arrays, but return:

```ts
export function getNavigationItems(capabilities: AccountCapabilities) {
  const items: NavigationItem[] = [];
  if (capabilities.isAdmin) items.push(...adminNavigation);
  if (capabilities.teacherIds.length > 0) items.push(...teacherNavigation);
  return dedupeByHref(items);
}
```

Protected layout loads account + capabilities once and renders this union. Admin layout calls `requireAdministrator`; teacher routes call `requireTeachingAccount`.

- [ ] **Step 4: Update login/password routing**

After login/password setup, resolve explicit capabilities. Route Admin+Teacher to `/dashboard` by deterministic precedence while leaving `/my-teaching` available in navigation. Route Teacher-only to `/my-teaching`. Do not inspect email/name or a removed profile role.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm test -- tests/unit/multi-capability-navigation.test.ts tests/unit/app-navigation.test.tsx tests/unit/set-password-routing.test.tsx tests/unit/authorization.test.ts
pnpm typecheck
```

Expected: all capability/navigation/routing tests pass.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/lib/auth src/app tests/unit
git commit -m "refactor: navigate by explicit account capabilities"
```

---

### Task 6: Update reporting/export compatibility and seed targeted browser fixtures

**Files:**
- Modify: `src/features/reports/report-batch.repository.ts`
- Modify: `src/features/exports/export.repository.ts`
- Modify any report/source models that expose `teacher_profile_id`
- Modify: `supabase/seed.e2e.sql`
- Create: `tests/e2e/independent-role-records.spec.ts`
- Modify related unit tests for reports/exports

**Interfaces:**
- Report source attribution stores/reads Teacher IDs and Teacher display metadata independently from account profiles.
- Export rows expose Teacher business identity; account/profile IDs appear only where the export is explicitly auditing an authenticated actor.
- E2E fixtures include three login profiles: Admin-only, Teacher-only, and explicit Admin+Teacher (or reuse existing Auth fixture accounts with deterministic explicit links).

- [ ] **Step 1: Write failing report/export compatibility tests**

Add assertions to existing report/export unit tests that Teacher attribution comes from `teachers`, not `profiles.role`, and that deactivated Teachers remain resolvable for historical submissions/reports.

- [ ] **Step 2: Update report/export repositories**

Replace joins/fields that use `weekly_submissions.teacher_profile_id` with `teacher_id`. When rendering historical labels, join the Teacher row regardless of current active status so history remains attributable. Do not fall back to matching Auth email.

- [ ] **Step 3: Seed explicit capability fixtures**

Update `supabase/seed.e2e.sql` so fixture creation reflects the final architecture:
- login profiles have no role column;
- one active Administrator record/link for the Admin-only fixture;
- one active Teacher record/link plus assignment for Teacher-only;
- one account explicitly linked to both a distinct Administrator row and Teacher row for Admin+Teacher;
- same email/name reuse may be included as a business-data fixture without implicit linking.

- [ ] **Step 4: Write targeted E2E workflow**

Create `tests/e2e/independent-role-records.spec.ts` covering:

```text
Admin-only:
- can open Dashboard/Teachers
- is not shown as a Teacher candidate merely because it is Admin
- can create a Teacher using the same business email as the Admin account

Teacher-only:
- can open My Teaching for assigned context
- cannot open Admin routes

Admin+Teacher:
- can open Dashboard and My Teaching
- teaching submission is attributed to Teacher ID
- removing Teacher access leaves Dashboard/Admin access intact

Arabic:
- changed Teacher/access UI is usable under /ar and document direction remains rtl
```

- [ ] **Step 5: Run focused report/export/unit verification**

Run:

```bash
pnpm test -- tests/unit/report-service.test.ts tests/unit/report-workflow.test.ts tests/unit/export-service.test.ts tests/unit/export-generation.test.ts
pnpm typecheck
```

Expected: GREEN with no `teacher_profile_id` assumption in current application code.

- [ ] **Step 6: Commit Task 6**

```bash
git add src/features/reports src/features/exports supabase/seed.e2e.sql tests
git commit -m "test: cover independent role workflows end to end"
```

---

### Task 7: Full verification, documentation, and release-ready PR

**Files:**
- Modify: `docs/SPEC.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PROGRESS.md`
- Verify: all changed files on `codex/independent-role-records`

**Interfaces:**
- Produces a release-ready branch/PR only. Hosted production migration/deployment remains a separate explicit release action after verification.

- [ ] **Step 1: Update authoritative documentation**

Add a decision entry stating:

```text
Authenticated profiles identify login accounts only. Administrator, Teacher,
Guardian, and Student are independent business records. Admin/Teacher access is
explicitly linked to an account; names/emails never imply or prohibit another role.
Teaching assignments/history reference Teacher IDs, while authenticated actor/audit
fields continue to reference Profile IDs.
```

Update `docs/SPEC.md` sections that say a single ADMIN profile may directly teach. Record in `docs/PROGRESS.md` that PR #4's admin-as-teacher compatibility path is superseded by independent role records.

- [ ] **Step 2: Search for forbidden old assumptions**

Run:

```bash
git grep -n "profiles\.role\|current_app_role\|teacher_profile_id\|administrator already has an account\|teacher already has an account" -- ':!docs/superpowers/specs/2026-09-23-independent-role-records-design.md' ':!docs/superpowers/plans/2026-09-23-independent-role-records.md' ':!supabase/migrations/202609200001_extensions_and_enums.sql' ':!supabase/migrations/202609200002_identity_and_school.sql' ':!supabase/migrations/202609200003_administration.sql' ':!supabase/migrations/202609200007_row_level_security.sql' ':!supabase/migrations/202609200008_administration_functions.sql' ':!supabase/migrations/202609220013_teacher_assignment.sql' ':!supabase/migrations/202609220017_confirm_group_reassignment.sql' ':!supabase/migrations/202609220019_class_subject_group_foundation.sql' ':!supabase/migrations/202609220020_class_subject_group_rls.sql' ':!supabase/migrations/202609230022_weekly_teaching_submissions.sql' ':!supabase/migrations/202609230023_weekly_submission_history_context.sql' ':!supabase/migrations/202609230024_attendance_resolution.sql' ':!supabase/migrations/202609230025_subject_aware_reports.sql'
```

Expected: no current application/test/doc implementation depends on the old assumptions. Historical immutable migrations may still contain the legacy names because they document previously applied schema.

- [ ] **Step 3: Run the full quality suite**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass. The existing intentional password-recovery SMTP rejection test may still write expected stderr, but the test itself must pass.

- [ ] **Step 4: Run full local database verification**

Run:

```bash
pnpm db:start
pnpm db:reset
pnpm test:db
```

Expected: reset applies migrations 1-27 plus the single new independent-role migration; all pgTAP/RLS tests pass.

- [ ] **Step 5: Run targeted browser verification**

After writing `.env.local` from local Supabase status using the existing CI pattern, run:

```bash
pnpm exec playwright install chromium
pnpm test:e2e -- tests/e2e/independent-role-records.spec.ts
```

Expected: Admin-only, Teacher-only, Admin+Teacher, same-email Teacher creation, Teacher unlink preserving Admin, and Arabic RTL cases pass.

Then run the existing E2E suite once:

```bash
pnpm test:e2e
```

Expected: all existing redesigned workflows still pass.

- [ ] **Step 6: Verify migration safety explicitly**

On a fresh local reset, query and record evidence for:

```sql
-- Admin-only fixture does not become Teacher.
select p.id, count(distinct aa.administrator_id) as admins, count(distinct ta.teacher_id) as teachers
from public.profiles p
left join public.administrator_accounts aa on aa.school_id = p.school_id and aa.profile_id = p.id
left join public.teacher_accounts ta on ta.school_id = p.school_id and ta.profile_id = p.id
where p.id = '<admin-only fixture profile id>'
group by p.id;
```

Expected: `admins = 1`, `teachers = 0`.

Also verify a dual-linked fixture returns `admins = 1`, `teachers = 1`, and that deleting only its `teacher_accounts` row changes teachers to `0` while admins stays `1`.

- [ ] **Step 7: Commit docs/final verification changes**

```bash
git add docs tests supabase src messages
git commit -m "docs: finalize independent role architecture"
```

- [ ] **Step 8: Create one release PR; do not touch hosted production yet**

Create a PR from `codex/independent-role-records` to `main` summarizing:
- one new forward-only migration;
- independent Admin/Teacher records and explicit account links;
- Teacher-ID teaching/history cutover;
- removal of admin-as-teacher inference and email collision blockers;
- full local quality/database/E2E evidence.

Stop before hosted Supabase migration or production deployment. Release requires explicit production authorization after the PR/CI state is reviewed.
