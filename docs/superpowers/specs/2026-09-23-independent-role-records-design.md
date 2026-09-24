# Independent Role Records Design

**Date:** 2026-09-23  
**Status:** Proposed design approved in conversation; written specification pending final review  
**Scope:** Replace the current single-role profile model with independent Administrator, Teacher, Guardian, and Student records.

## 1. Problem

The current schema makes an authenticated `profiles` row carry exactly one `role` (`ADMIN` or `TEACHER`). This incorrectly couples login identity to school roles and creates false business rules such as "this email is already an administrator" when adding a teacher.

That model does not match the required product behavior. Administrator, Teacher, Guardian, and Student are independent concepts. The same human may be any combination of them, and matching names or email addresses must not imply, prohibit, create, remove, or merge another role.

The recent administrator-teaching UI fix exposed this design flaw by treating an ADMIN profile as a teaching candidate. This design supersedes that behavior.

## 2. Product Rules

1. Administrator, Teacher, Guardian, and Student are independent records.
2. A human may be represented by any combination of those records, including all four.
3. No role implies another role.
4. Creating, editing, deactivating, archiving, restoring, unlinking, or deleting one role must not mutate another role.
5. Names are not identifiers and may repeat freely.
6. Business email fields are not cross-role identifiers and may repeat freely. The application must not reject a Teacher, Guardian, Student, or Administrator because another record uses the same email.
7. Email equality must not automatically merge business records.
8. Authentication is separate from business records. Supabase Auth may still require unique login emails, but that requirement applies only to login accounts, not to school data records.
9. Linking a login account to a role record is explicit. A matching email alone does not grant permissions.
10. Teaching assignments reference Teacher records only. An Administrator is never a teaching candidate unless a separate Teacher record exists.
11. Removing or deactivating a Teacher must not affect Administrator access or any Guardian/Student record.
12. Removing or deactivating an Administrator must not affect Teacher access or any Guardian/Student record.
13. Historical submissions and reports remain attributable after a role is deactivated or archived.

## 3. Data Model

### 3.1 `profiles` becomes login identity only

Keep `public.profiles` as the authenticated school-account record because many audit fields already reference profile IDs. Its meaning changes from "one person with one app role" to "one authenticated login identity in this school".

Retained fields:
- `id`
- `school_id`
- `auth_user_id`
- `display_name`
- `preferred_language`
- `is_active`
- timestamps

Remove:
- `role`
- role-specific indexes and logic based on `profiles.role`

`auth_user_id` remains unique because one Supabase Auth identity represents one login profile. This is an authentication constraint only; it does not constrain business records or their emails.

### 3.2 Administrators

Add `public.administrators`:
- `id uuid primary key`
- `school_id uuid not null`
- `display_name text not null`
- `email text null`
- `is_active boolean not null default true`
- timestamps
- `unique (school_id, id)` only

There is deliberately no unique constraint on administrator name or email.

### 3.3 Teachers

Add `public.teachers`:
- `id uuid primary key`
- `school_id uuid not null`
- `display_name text not null`
- `email text null`
- `preferred_language language_code not null default 'en'`
- `is_active boolean not null default true`
- timestamps
- `unique (school_id, id)` only

There is deliberately no unique constraint on teacher name or email.

### 3.4 Guardians and Students

Keep `public.guardians` and `public.students` as independent business records. Existing names/emails remain non-unique across roles. No link is inferred from matching values.

A Student does not need an email to exist. If student account access is added later, it is linked explicitly rather than derived from a name/email match.

### 3.5 Explicit account links

Add separate link tables instead of putting role columns back on `profiles`:

`public.administrator_accounts`
- `school_id`
- `administrator_id`
- `profile_id`
- primary key `(school_id, administrator_id, profile_id)`
- foreign keys to `administrators` and `profiles`

`public.teacher_accounts`
- `school_id`
- `teacher_id`
- `profile_id`
- primary key `(school_id, teacher_id, profile_id)`
- foreign keys to `teachers` and `profiles`

Do not add uniqueness on name/email and do not require one role per profile. A single login profile may be explicitly linked to both an Administrator record and a Teacher record. The schema also does not need to prevent an account from being linked to more than one record of the same role if an administrator explicitly chooses that configuration later.

Guardian and Student account-link tables are out of scope until those roles need authenticated application access. Their business records remain fully independent now.

## 4. Authorization Model

Authorization must be based on explicit active role links, not `profiles.role`.

Keep:
- `current_profile_id()` to identify the authenticated account profile.
- `current_school_id()` to identify its school.

Replace:
- `current_app_role()`
- all checks of `profiles.role`

Redefine `is_admin()` as an existence check:
- current profile is active;
- linked Administrator record is in the same school;
- linked Administrator record is active.

Teacher access becomes an explicit link check:
- current profile is active;
- current profile is linked through `teacher_accounts` to an active Teacher in the same school;
- that Teacher has an effective teaching assignment for the requested context/date.

If a login is linked to multiple Teacher records, teacher-facing lists aggregate contexts across those explicitly linked Teacher IDs. Submission authorship remains the specific Teacher ID selected by the resolved context, so history stays unambiguous.

Administrator authorization and Teacher authorization are independent. An account may satisfy either, both, or neither.

## 5. Teaching Domain Changes

`teaching_assignments.teacher_profile_id` becomes `teacher_id` and references `public.teachers`.

All teacher-owned teaching data must use Teacher IDs rather than profile IDs, including at minimum:
- teaching assignments;
- weekly submissions and submission history;
- any teacher attribution/source rows used by reports;
- legacy teacher/group assignment tables that remain referenced by migrations or compatibility code.

Audit fields that describe the authenticated actor rather than a Teacher role continue to reference `profiles.id`, for example administrator actions such as conflict resolution, export requests, or finalization where the actor is the logged-in account.

This distinction is intentional:
- **who authenticated/performed an admin action** -> `profile_id`;
- **which Teacher role produced teaching content** -> `teacher_id`.

## 6. Teacher Management UX

The Teachers section manages only `teachers` rows.

### Add Teacher

Creating a Teacher creates the business record first. It must not fail because:
- the same email belongs to an Administrator;
- the same email belongs to another Guardian or Student;
- another Teacher uses the same name or email;
- a Supabase Auth account already uses that email.

The old `adminAccount` and `teacherAccount` creation blockers are removed.

### Account access

Teacher business creation and login access are separate operations.

A Teacher may exist without application login access. The Teachers UI shows whether any login profile is explicitly linked.

When an administrator chooses **Send/Link access**:
- if no Auth user exists for the requested login email, invite/create the Auth identity, create its `profiles` row, then explicitly link it to the Teacher;
- if an Auth user/profile already exists, do not reject it merely because it has Administrator access; explicitly link that existing profile to the Teacher after the administrator requested the access action;
- email matching during this explicit access action is a way to locate the requested login account, not a rule that merges business records.

### Removing Teacher capability

The administrator can deactivate/archive a Teacher or unlink a Teacher from a login account. Neither operation changes any Administrator, Guardian, Student, or login profile record.

Historical teaching records remain attributed to the Teacher record. Permanent deletion follows the existing archive/delete safety model and must not silently delete unrelated role records.

## 7. Administrator Management

Administrator access is represented by an Administrator record plus an explicit `administrator_accounts` link.

The existing production administrator is migrated to this model and remains able to sign in after migration.

An Administrator is not shown in Teacher lists or teaching-assignment selectors unless a separate Teacher record has been created.

The temporary behavior introduced by PR #4 that adds ADMIN profiles directly to teaching candidates must be removed.

## 8. Migration Strategy

This is one coordinated forward-only migration/refactor. Existing migrations remain immutable.

### Phase A: additive schema

1. Create `administrators`.
2. Create `teachers`.
3. Create `administrator_accounts` and `teacher_accounts` with RLS enabled/forced.
4. Add new Teacher-ID columns to teacher-owned tables while old profile-ID columns still exist.

### Phase B: deterministic backfill

For every existing ADMIN profile:
- create one Administrator record in the same school;
- copy display name;
- optionally copy the current Auth email into the Administrator business email as initial data;
- create the explicit Administrator-account link.

For every existing TEACHER profile:
- create one Teacher record in the same school;
- copy display name and preferred language;
- optionally copy the current Auth email into the Teacher business email as initial data;
- create the explicit Teacher-account link.

Backfill each new `teacher_id` by mapping the former teacher profile through the newly created Teacher-account link.

Production currently has an Administrator profile and no Teacher profile; therefore the production backfill leaves that administrator as Administrator-only. It does not create a Teacher record for that account.

### Phase C: authorization cutover

1. Replace role helper functions and RLS predicates with explicit link checks.
2. Update Server Components/Actions/repositories to use Administrator/Teacher records.
3. Update invitation/access logic.
4. Update navigation routing to support a login that has both Administrator and Teacher capabilities without converting one into the other.

For an account with both capabilities, Admin navigation remains available and Teacher workflow is also available. The UI may expose both destinations; it does not collapse the records.

### Phase D: constraint cutover

After backfill and code compatibility are verified:
- make required new Teacher foreign keys non-null where appropriate;
- remove obsolete teacher-profile foreign keys/columns;
- remove `profiles.role` and role-specific profile index;
- remove obsolete `current_app_role()` behavior;
- remove the admin-as-teacher compatibility path from PR #4.

## 9. RLS and Security Requirements

All new public tables must have RLS enabled and forced.

Administrator policies require an active explicit Administrator-account link in the same school.

Teacher policies require an active explicit Teacher-account link plus effective teaching scope when the operation is teaching-context-specific.

Matching email/name must never appear in an RLS authorization predicate.

Service-role use remains limited to operations that genuinely require Auth administration, such as invitations/account lookup. Business authorization continues to be enforced through server-side checks and database RLS.

No `SECURITY DEFINER` function may be added merely to bypass a failed permission check. Any privileged function must validate the current authenticated profile and explicit role link.

## 10. Reports, History, and Audit

Finalized report snapshots remain immutable.

Past weekly submissions keep the Teacher identity that authored them even if that Teacher is later deactivated, archived, or unlinked from a login.

Admin audit actions continue to identify the authenticated `profile_id` while permission is established through Administrator links.

No migration may rewrite historical Teacher authorship into an Administrator identity merely because the same login/email is involved.

## 11. UI/Language Requirements

All changed screens remain bilingual EN/AR and RTL-safe.

Terminology must distinguish:
- account access;
- Administrator role record;
- Teacher role record;
- teaching assignment.

Remove misleading text such as "This email is already an administrator" from Teacher creation.

Teacher pages must provide independent deactivate/archive/unlink actions without altering Administrator state.

## 12. Testing and Verification

TDD is required.

Minimum database/contract coverage:
1. same email may exist on Administrator and Teacher records;
2. duplicate Teacher email/name is permitted at the business-record level;
3. adding Teacher does not grant Admin;
4. adding Admin does not grant Teacher;
5. one profile may link to both Admin and Teacher explicitly;
6. unlinking/deactivating Teacher preserves Admin authorization;
7. unlinking/deactivating Admin preserves Teacher authorization;
8. an Admin without a Teacher record cannot receive teaching assignments;
9. a linked Teacher can access only effective assigned contexts;
10. historical submissions remain readable/attributed after Teacher deactivation;
11. existing production-style Admin-only account migrates as Admin-only;
12. existing legacy Teacher profile migrates to Teacher + explicit account link;
13. cross-school links are rejected;
14. RLS denies unauthorized cross-role/cross-school access.

Application verification:
- lint;
- typecheck;
- unit/contract suite;
- production build;
- local database reset + pgTAP/RLS suite;
- targeted browser workflows for Admin-only, Teacher-only, and Admin+Teacher accounts;
- EN/AR and RTL checks.

## 13. Release Safety

Do not apply this migration to hosted production until:
- local migration/backfill tests pass;
- RLS tests pass;
- Admin-only login is verified locally;
- Admin+Teacher behavior is verified locally;
- the production build is green.

Release order:
1. merge verified application + forward-only migration;
2. apply hosted migration in the controlled release path;
3. verify the preserved Administrator account still has Admin access;
4. verify it does **not** appear as a Teacher unless a Teacher record is explicitly created;
5. verify Teacher creation accepts an email already used by an Administrator;
6. verify removing/unlinking that Teacher leaves Administrator access intact.

## 14. Superseded Rules

This design supersedes prior statements that:
- an Administrator profile itself can be assigned directly as a Teacher;
- one `profiles.role` value defines the person's application identity;
- Teacher creation should fail because the email belongs to an Administrator;
- Admin and Teacher are mutually exclusive profile types.

The Class -> Subject -> optional Group architecture, enrollment rules, co-teacher behavior, attendance rules, report immutability, archive/export behavior, bilingual requirements, and other redesign decisions remain unchanged unless directly affected by the ID migration described above.
