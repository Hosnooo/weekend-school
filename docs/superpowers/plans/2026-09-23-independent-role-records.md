# Independent Role Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-role `profiles.role` model with independent Administrator and Teacher business records while preserving Guardian/Student independence, historical teaching attribution, and authenticated account/audit identity.

**Architecture:** Keep `public.profiles` as login identity only. Add independent `administrators` and `teachers` tables plus explicit account-link tables, move teacher-owned data from Profile IDs to Teacher IDs, and authorize Admin/Teacher capabilities through active explicit links rather than email/name matching or one role enum. Ship this as one new forward-only migration and one coordinated application PR.

**Tech Stack:** Next.js 16.3.5, React 19.2.0, TypeScript 5.9.3, Supabase/PostgreSQL 17, RLS/pgTAP, Vitest 5, Playwright 1.63, next-intl 4.13.7, Zod 4.1.11, pnpm 11.19.0.

**Spec:** `docs/superpowers/specs/2026-09-23-independent-role-records-design.md`

## Global Constraints

- Administrator, Teacher, Guardian, and Student are independent business records; no role implies another.
- Names and business emails may repeat freely; equality must not merge, grant, remove, or prohibit another role.
- Supabase Auth email uniqueness applies only to login accounts, never to business records.
- Teaching assignments and teacher-authored history reference Teacher IDs only.
- Authenticated actor/audit fields continue to reference `profiles.id` when they describe who performed an action.
- The production ADMIN-only account must migrate to Administrator-only, never Teacher.
- Existing migrations 1-27 remain immutable; create exactly one new migration with `pnpm exec supabase migration new independent_role_records`.
- All new public tables have RLS enabled and forced.
- Changed UI remains EN/AR and RTL-safe.
- No hosted production migration/deployment until local DB/RLS, quality/build, and targeted browser verification pass and release is explicitly authorized.
- TDD is mandatory: intended behavior must fail first, then pass after implementation.

## Review Focus

1. Existing Auth email reused on a new Teacher: Teacher creation succeeds and does not auto-link or mutate Administrator access.
2. Legacy ADMIN-only backfill: creates Administrator + account link only, never Teacher.
3. Explicit Admin+Teacher account: both capabilities coexist without collapsing records.
4. Teacher unlink/deactivation: Administrator access and historical Teacher attribution remain intact.
5. Cross-school links: rejected by composite FKs and authorization; matching names/emails never bypass school boundaries.

---

### Task 1: Add independent role tables and deterministic legacy backfill

**Files:**
- Create: `supabase/tests/independent_roles.test.sql`
- Create via CLI then modify: the exact `supabase/migrations/*_independent_role_records.sql` path printed by `pnpm exec supabase migration new independent_role_records`

**Interfaces:**
- `administrators(id, school_id, display_name, email, is_active, created_at, updated_at)`
- `teachers(id, school_id, display_name, email, preferred_language, is_active, created_at, updated_at)`
- `administrator_accounts(school_id, administrator_id, profile_id)`
- `teacher_accounts(school_id, teacher_id, profile_id)`

- [ ] **Step 1: Create the migration file through the CLI**

```bash
pnpm exec supabase migration new independent_role_records
```

Expected: one generated file ending `_independent_role_records.sql`. Record its exact path; do not invent a timestamp.

- [ ] **Step 2: Write the RED pgTAP contract**

Create `supabase/tests/independent_roles.test.sql` and assert:

```sql
begin;
select plan(14);
select has_table('public', 'administrators');
select has_table('public', 'teachers');
select has_table('public', 'administrator_accounts');
select has_table('public', 'teacher_accounts');

-- two Teacher rows may share both name and business email
select lives_ok($$
  insert into public.teachers (id, school_id, display_name, email)
  values
    ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-000000000001', 'Same Person', 'same@example.test'),
    ('00000000-0000-0000-0000-00000000a102', '00000000-0000-0000-0000-000000000001', 'Same Person', 'same@example.test')
$$, 'Teacher business identity allows duplicate name/email');

select * from finish();
rollback;
```

Add fixtures/assertions proving:
- each legacy `profiles.role='ADMIN'` maps to exactly one Administrator + Administrator-account link;
- each legacy `profiles.role='TEACHER'` maps to exactly one Teacher + Teacher-account link;
- ADMIN does not produce a Teacher link;
- one Profile may explicitly link to both one Administrator and one Teacher;
- a cross-school `teacher_accounts` or `administrator_accounts` insert throws `23503`.

- [ ] **Step 3: Run RED**

```bash
pnpm db:start
pnpm db:reset
pnpm test:db
```

Expected: failure because the new tables do not exist. Infrastructure/startup failure is not valid RED.

- [ ] **Step 4: Implement the additive schema**

Use this table shape in the generated migration:

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
  foreign key (school_id, administrator_id) references public.administrators(school_id, id) on delete restrict,
  foreign key (school_id, profile_id) references public.profiles(school_id, id) on delete restrict
);

create table public.teacher_accounts (
  school_id uuid not null references public.schools(id) on delete restrict,
  teacher_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (school_id, teacher_id, profile_id),
  foreign key (school_id, teacher_id) references public.teachers(school_id, id) on delete restrict,
  foreign key (school_id, profile_id) references public.profiles(school_id, id) on delete restrict
);
```

Do not add unique constraints to business name/email. Add updated-at triggers to Administrator/Teacher. Enable and force RLS on all four tables.

For deterministic backfill, create a temporary mapping table once and reuse the generated IDs:

```sql
create temporary table role_profile_backfill (
  profile_id uuid primary key,
  school_id uuid not null,
  legacy_role public.app_role not null,
  role_record_id uuid not null default gen_random_uuid()
) on commit drop;

insert into role_profile_backfill (profile_id, school_id, legacy_role)
select id, school_id, role from public.profiles;
```

Insert `administrators`/`administrator_accounts` from rows with `legacy_role='ADMIN'`, and `teachers`/`teacher_accounts` from rows with `legacy_role='TEACHER'`. Copy Auth email only as initial business data by joining `auth.users.id = profiles.auth_user_id`; never use email as the mapping key.

- [ ] **Step 5: Run GREEN for Task 1**

```bash
pnpm db:reset
pnpm test:db
```

Expected: all new table/backfill/duplicate/cross-school tests pass; no unrelated reset failure.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_independent_role_records.sql supabase/tests/independent_roles.test.sql
git commit -m "feat: add independent administrator and teacher records"
```

---

### Task 2: Replace single-role authorization with explicit capability links

**Files:**
- Modify: generated independent-role migration
- Modify: `supabase/tests/rls.test.sql`
- Modify: `supabase/tests/class_subject_group_rls.test.sql`
- Create: `tests/unit/independent-role-authorization.test.ts`
- Modify: `src/features/profiles/profile.types.ts`
- Modify: `src/lib/auth/authorization.ts`
- Modify: `src/lib/auth/require-profile.ts`
- Modify Admin callers currently using `requireProfile(locale, 'ADMIN')`

**Interfaces:**

```ts
export type AccountCapabilities = {isAdmin: boolean; teacherIds: string[]};
export async function requireAccount(locale: Locale): Promise<Profile>;
export async function requireAdministrator(locale: Locale): Promise<Profile>;
export async function requireTeachingAccount(locale: Locale): Promise<{profile: Profile; teacherIds: string[]}>;
```

Database helpers:
- `public.is_admin()` checks active explicit Administrator link.
- `public.current_teacher_ids()` returns active explicitly linked Teacher IDs.

- [ ] **Step 1: Write RED unit tests**

```ts
it('does not infer Teacher from Admin', () => {
  expect(canAdmin({isAdmin: true, teacherIds: []})).toBe(true);
  expect(canTeach({isAdmin: true, teacherIds: []})).toBe(false);
});

it('supports explicit Admin+Teacher', () => {
  expect(canAdmin({isAdmin: true, teacherIds: ['t1']})).toBe(true);
  expect(canTeach({isAdmin: true, teacherIds: ['t1']})).toBe(true);
});
```

Extend pgTAP/RLS tests to prove matching email/name without an explicit link grants nothing, dual links grant both capabilities, and unlinking one capability preserves the other.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/unit/independent-role-authorization.test.ts
pnpm db:reset
pnpm test:db
```

Expected: failures because current code/RLS still uses `profiles.role`.

- [ ] **Step 3: Add capability helpers to the migration**

```sql
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.administrator_accounts aa on aa.school_id=p.school_id and aa.profile_id=p.id
    join public.administrators a on a.school_id=aa.school_id and a.id=aa.administrator_id
    where p.auth_user_id=auth.uid() and p.is_active and a.is_active
  )
$$;

create function public.current_teacher_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select t.id
  from public.profiles p
  join public.teacher_accounts ta on ta.school_id=p.school_id and ta.profile_id=p.id
  join public.teachers t on t.school_id=ta.school_id and t.id=ta.teacher_id
  where p.auth_user_id=auth.uid() and p.is_active and t.is_active
$$;
```

Revoke unintended PUBLIC execution following existing hardened-function conventions. Rewrite current RLS/admin/teacher predicates to use these explicit links. Never compare email/name in RLS.

- [ ] **Step 4: Refactor account types/helpers**

`Profile` becomes login identity only:

```ts
export type Profile = {
  id: string;
  schoolId: string;
  displayName: string;
  preferredLanguage: Locale;
  isActive: boolean;
};
```

Remove `AppRole` from `Profile`. Add `AccountCapabilities`, `canAdmin`, and `canTeach`. `requireProfile` becomes account-only loading; add `requireAdministrator` and `requireTeachingAccount` wrappers using explicit link queries. Replace Admin callers without changing their downstream audit use of `profile.id`.

- [ ] **Step 5: Run GREEN**

```bash
pnpm test -- tests/unit/independent-role-authorization.test.ts tests/unit/authorization.test.ts
pnpm typecheck
pnpm db:reset
pnpm test:db
```

Expected: explicit capability tests and RLS tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_independent_role_records.sql supabase/tests src/features/profiles src/lib/auth src/app src/features
git commit -m "refactor: authorize explicit administrator and teacher capabilities"
```

---

### Task 3: Move teacher-owned assignments/history from Profile IDs to Teacher IDs

**Files:**
- Modify: generated independent-role migration
- Modify pgTAP tests referencing `teacher_profile_id`
- Modify: `src/features/teaching-assignments/teaching-assignment.repository.ts`
- Modify: `src/features/weekly-updates/weekly-update.repository.ts`
- Modify: `src/features/classes/class.repository.ts`
- Modify: `src/features/dashboard/dashboard.repository.ts`
- Modify: `src/features/reports/report-batch.repository.ts`
- Modify: `src/features/exports/export.repository.ts`

**Interfaces:**
- `teaching_assignments.teacher_id -> teachers(id)`
- `weekly_submissions.teacher_id -> teachers(id)`
- report/source Teacher attribution uses Teacher IDs
- admin actor fields remain Profile IDs
- `teacher_can_teach_context(p_teacher_id, p_class_subject_id, p_subject_group_id, p_on_date)` accepts Teacher ID

- [ ] **Step 1: Write RED schema/history assertions**

Use pgTAP helpers known to the suite:

```sql
select has_column('public', 'teaching_assignments', 'teacher_id');
select hasnt_column('public', 'teaching_assignments', 'teacher_profile_id');
select has_column('public', 'weekly_submissions', 'teacher_id');
select hasnt_column('public', 'weekly_submissions', 'teacher_profile_id');
```

Seed a legacy Teacher profile with assignment/submission before migration and assert after migration that both rows map to the new Teacher ID and remain readable after Teacher deactivation.

- [ ] **Step 2: Run RED**

```bash
pnpm db:reset
pnpm test:db
```

Expected: failures because current teacher-owned tables still use Profile IDs.

- [ ] **Step 3: Add/backfill Teacher IDs in the same migration**

For every teacher-owned table:
1. add nullable `teacher_id`;
2. backfill through `teacher_accounts` created from the legacy Teacher profile;
3. raise a migration exception if any non-null legacy Teacher reference has no mapping;
4. add same-school FK to `teachers`;
5. rebuild unique/exclusion constraints/indexes using `teacher_id`;
6. update triggers/functions/policies to Teacher IDs;
7. set required `teacher_id` non-null;
8. drop old Teacher-profile FK/index/column.

Final assignment FK:

```sql
constraint teaching_assignments_teacher_school_fk
  foreign key (school_id, teacher_id)
  references public.teachers(school_id, id) on delete restrict
```

After all current functions/policies no longer depend on it:

```sql
drop index if exists public.profiles_school_role_active_idx;
alter table public.profiles drop column role;
drop function if exists public.current_app_role();
```

Keep `current_profile_id()` and `current_school_id()` for login/audit identity.

- [ ] **Step 4: Refactor repositories to Teacher IDs**

Replace current `teacher_profile_id` mappings with `teacher_id`/`teacherId`. Teacher-facing context loaders resolve concrete Teacher IDs from `requireTeachingAccount()` and persist that Teacher ID as authorship. Do not persist Profile ID as Teacher identity.

- [ ] **Step 5: Run GREEN**

```bash
pnpm test -- tests/unit/teaching-assignments.test.ts tests/unit/weekly-update.test.ts tests/unit/report-service.test.ts tests/unit/export-service.test.ts
pnpm typecheck
pnpm db:reset
pnpm test:db
```

Expected: Teacher-owned data is keyed by Teacher ID; deactivation preserves historical attribution.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_independent_role_records.sql supabase/tests src/features tests
git commit -m "refactor: key teaching history to teacher records"
```

---

### Task 4: Separate Teacher creation from login access/linking

**Files:**
- Create: `tests/unit/teacher-independent-identity.test.ts`
- Modify: `src/features/teachers/teacher.repository.ts`
- Modify: `src/features/teachers/teacher.actions.ts`
- Modify: `src/features/teachers/teacher.types.ts`
- Modify: `src/features/teachers/teacher-form.tsx`
- Modify Teacher pages under `src/app/[locale]/(protected)/(admin)/teachers/`
- Modify: `messages/en.json`, `messages/ar.json`
- Modify archive/delete support if Teacher is added to the existing archive/permanent-delete workflow

**Interfaces:**

```ts
createTeacher(schoolId, {displayName, email, preferredLanguage})
linkTeacherAccount(schoolId, teacherId, profileId)
ensureTeacherAccess(schoolId, teacherId, loginEmail, redirectTo)
unlinkTeacherAccount(schoolId, teacherId, profileId)
```

- [ ] **Step 1: Write RED identity tests**

```ts
it('creates Teacher even when an Administrator account uses the same email', async () => {
  await createTeacherBusinessRecord({displayName:'Mohssen', email:'mohssen.elshaar@gmail.com', preferredLanguage:'en'}, deps);
  expect(deps.lookupAuthByEmail).not.toHaveBeenCalled();
  expect(deps.linkAccount).not.toHaveBeenCalled();
});

it('unlinking Teacher access does not remove Admin access or profile', async () => {
  await unlinkTeacherAccess('t1', 'p1', deps);
  expect(deps.deleteTeacherLink).toHaveBeenCalled();
  expect(deps.deleteAdministratorLink).not.toHaveBeenCalled();
  expect(deps.deleteProfile).not.toHaveBeenCalled();
});
```

Also test duplicate Teacher name/email and same email as Guardian data.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/unit/teacher-independent-identity.test.ts
```

Expected: failure because current invite flow couples Teacher creation to Auth and rejects existing account email.

- [ ] **Step 3: Refactor Teacher CRUD to `teachers` only**

`listTeachers/getTeacher/updateTeacher/setTeacherActive` operate on `public.teachers`. Teaching candidates are active Teacher rows only; remove PR #4 logic that includes ADMIN profiles.

Teacher list shape:

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

- [ ] **Step 4: Split business creation and explicit access linking**

Default Add Teacher inserts only the Teacher row. Remove business errors `administrator already has an account` and `teacher already has an account`.

Explicit access action algorithm:

```text
1 requireAdministrator(locale)
2 load same-school Teacher by teacherId
3 normalize/validate requested login email
4 find Auth user by login email
5 if Auth user exists:
    - load profile by auth_user_id
    - if profile exists in another school, reject with visible cross-school access error
    - if same-school profile exists, reuse it
6 if no Auth user exists, invite it and create same-school Profile
7 if Auth user exists but no Profile exists, create same-school Profile
8 insert teacher_accounts link idempotently
9 do not create/remove administrator_accounts based on email
```

Email lookup occurs only because the admin explicitly chose “Link/Send access”; it never merges Teacher/Admin business records.

- [ ] **Step 5: Add independent unlink/deactivate/archive controls**

Teacher edit UI separately shows business status, assignments, and linked login access. Unlink removes only `teacher_accounts`. Deactivate/archive keeps historical submissions. Permanent delete follows existing impact-check safeguards and must not cascade into Administrator/Guardian/Student/Profile records.

Update EN/AR copy to “Teacher record”, “Account access”, “Link access”, “Remove access”; remove “already an administrator” wording.

- [ ] **Step 6: Run GREEN**

```bash
pnpm test -- tests/unit/teacher-independent-identity.test.ts tests/unit/teacher-invitation.test.ts tests/unit/admin-teaching-assignment-ui.test.ts
pnpm typecheck
```

Update the prior admin-teaching test so it now proves Admin profiles are not candidates unless a separate Teacher exists.

- [ ] **Step 7: Commit**

```bash
git add src/features/teachers src/app messages tests/unit src/features/archives
git commit -m "feat: separate teacher records from account access"
```

---

### Task 5: Support Admin-only, Teacher-only, and explicit Admin+Teacher navigation

**Files:**
- Create: `tests/unit/multi-capability-navigation.test.ts`
- Modify: `src/lib/auth/navigation.ts`
- Modify: `src/app/[locale]/(protected)/layout.tsx`
- Modify Admin/Teacher protected layouts
- Modify login/set-password routing helpers/tests

**Interfaces:**

```ts
getNavigationItems(capabilities: AccountCapabilities): readonly NavigationItem[]
```

Default post-auth route: Admin capability -> `/dashboard`; otherwise Teacher capability -> `/my-teaching`; otherwise access-unavailable.

- [ ] **Step 1: Write RED navigation tests**

```ts
expect(getNavigationItems({isAdmin:true, teacherIds:[]}).map(x=>x.href)).not.toContain('/my-teaching');
expect(getNavigationItems({isAdmin:false, teacherIds:['t1']}).map(x=>x.href)).not.toContain('/settings');
expect(getNavigationItems({isAdmin:true, teacherIds:['t1']}).map(x=>x.href)).toEqual(expect.arrayContaining(['/dashboard','/my-teaching']));
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- tests/unit/multi-capability-navigation.test.ts tests/unit/app-navigation.test.tsx tests/unit/set-password-routing.test.tsx
```

Expected: failure because navigation currently accepts one `AppRole`.

- [ ] **Step 3: Implement capability-union navigation**

```ts
export function getNavigationItems(capabilities: AccountCapabilities) {
  const items: NavigationItem[] = [];
  if (capabilities.isAdmin) items.push(...adminNavigation);
  if (capabilities.teacherIds.length) items.push(...teacherNavigation);
  return [...new Map(items.map(item => [item.href, item])).values()];
}
```

Protected root layout loads account + capabilities once. Admin layout calls `requireAdministrator`; teacher routes call `requireTeachingAccount`. Admin+Teacher defaults to Dashboard but retains My Teaching navigation.

- [ ] **Step 4: Run GREEN and commit**

```bash
pnpm test -- tests/unit/multi-capability-navigation.test.ts tests/unit/app-navigation.test.tsx tests/unit/set-password-routing.test.tsx tests/unit/authorization.test.ts
pnpm typecheck
git add src/lib/auth src/app tests/unit
git commit -m "refactor: navigate by explicit account capabilities"
```

---

### Task 6: Preserve report/export attribution and add browser fixtures

**Files:**
- Modify: `src/features/reports/report-batch.repository.ts`
- Modify: `src/features/exports/export.repository.ts`
- Modify Teacher-source/report models that still expose `teacher_profile_id`
- Modify: `supabase/seed.e2e.sql`
- Create: `tests/e2e/independent-role-records.spec.ts`
- Modify related report/export unit tests

**Interfaces:**
- historical report/source attribution reads Teacher business identity by `teacher_id`, even if inactive;
- account/Profile IDs remain only where explicitly auditing an authenticated actor;
- E2E seed includes Admin-only, Teacher-only, and explicit Admin+Teacher fixtures.

- [ ] **Step 1: Write RED report/export tests**

Assert report/export data uses Teacher IDs and resolves inactive historical Teachers without email-based fallback.

- [ ] **Step 2: Update report/export repositories**

Replace current `teacher_profile_id` joins/fields with `teacher_id`; join Teacher rows without filtering `is_active` for historical attribution.

- [ ] **Step 3: Update `supabase/seed.e2e.sql`**

Seed:
- login Profiles with no role column;
- Admin-only profile -> Administrator link only;
- Teacher-only profile -> Teacher link + assignment;
- Admin+Teacher profile -> distinct Administrator and Teacher rows + both explicit links;
- duplicate business name/email fixture proving no implicit relationship.

- [ ] **Step 4: Add targeted E2E flow**

`tests/e2e/independent-role-records.spec.ts` must prove:

```text
Admin-only: Dashboard works; not a Teacher candidate; can create Teacher with same business email.
Teacher-only: My Teaching works for assigned context; Admin route denied.
Admin+Teacher: Dashboard and My Teaching both available; submission carries Teacher ID.
Unlink Teacher access: Admin capability still works.
Arabic: changed Teacher/access UI remains RTL.
```

- [ ] **Step 5: Run focused GREEN and commit**

```bash
pnpm test -- tests/unit/report-service.test.ts tests/unit/report-workflow.test.ts tests/unit/export-service.test.ts tests/unit/export-generation.test.ts
pnpm typecheck
git add src/features/reports src/features/exports supabase/seed.e2e.sql tests
git commit -m "test: cover independent role workflows end to end"
```

---

### Task 7: Full verification, docs, and release-ready PR

**Files:**
- Modify: `docs/SPEC.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PROGRESS.md`
- Verify all branch changes

**Interfaces:**
- Produces a release-ready PR only. Hosted production migration/deployment remains a separately authorized release action.

- [ ] **Step 1: Update authoritative docs**

Record this decision verbatim in substance:

```text
Profiles identify login accounts only. Administrator, Teacher, Guardian, and Student are independent business records. Admin/Teacher access is explicitly linked to an account; names/emails never imply or prohibit another role. Teaching assignments/history reference Teacher IDs while authenticated actor/audit fields reference Profile IDs.
```

Supersede old SPEC language that an ADMIN profile itself can teach, and note PR #4's compatibility behavior is removed.

- [ ] **Step 2: Search for forbidden current assumptions**

```bash
git grep -n "profiles\.role\|current_app_role\|teacher_profile_id\|administrator already has an account\|teacher already has an account" -- src tests messages supabase/tests supabase/seed.e2e.sql docs/SPEC.md docs/DECISIONS.md docs/PROGRESS.md
```

Expected: no current implementation/test/doc dependency on these assumptions. Historical immutable migrations may still contain them and are intentionally excluded from this search.

- [ ] **Step 3: Full quality suite**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass. Intentional password-recovery SMTP rejection stderr may appear while its test passes.

- [ ] **Step 4: Full local database verification**

```bash
pnpm db:start
pnpm db:reset
pnpm test:db
```

Expected: migrations 1-27 plus exactly one new independent-role migration apply; all pgTAP/RLS tests pass.

- [ ] **Step 5: Targeted then full E2E**

Using the existing CI local `.env.local` setup:

```bash
pnpm exec playwright install chromium
pnpm test:e2e -- tests/e2e/independent-role-records.spec.ts
pnpm test:e2e
```

Expected: targeted independent-role flows and the full existing suite pass.

- [ ] **Step 6: Record explicit migration-safety evidence**

Query local DB after reset:

```sql
select p.id,
       count(distinct aa.administrator_id) as admins,
       count(distinct ta.teacher_id) as teachers
from public.profiles p
left join public.administrator_accounts aa on aa.school_id=p.school_id and aa.profile_id=p.id
left join public.teacher_accounts ta on ta.school_id=p.school_id and ta.profile_id=p.id
where p.id = '<fixture profile id supplied by seed>'
group by p.id;
```

For Admin-only fixture expect `admins=1, teachers=0`. For dual fixture expect `admins=1, teachers=1`; after deleting only its Teacher-account link, expect `admins=1, teachers=0`.

- [ ] **Step 7: Commit final docs**

```bash
git add docs tests supabase src messages
git commit -m "docs: finalize independent role architecture"
```

- [ ] **Step 8: Create one PR and stop before production**

Create PR `codex/independent-role-records -> main` summarizing:
- one new forward-only migration;
- independent Admin/Teacher business records + explicit account links;
- Teacher-ID teaching/history cutover;
- removal of admin-as-teacher inference and email collision blockers;
- full quality/database/E2E evidence.

Do not apply the hosted Supabase migration and do not deploy production until explicit release authorization after PR/CI review.
