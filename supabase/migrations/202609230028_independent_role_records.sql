-- Forward-only identity correction. Migrations 1-27 are already applied and immutable.
-- Business roles are independent records. Matching names/emails never imply identity or capability.

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
  constraint administrator_accounts_administrator_school_fk
    foreign key (school_id, administrator_id)
    references public.administrators(school_id, id) on delete restrict,
  constraint administrator_accounts_profile_school_fk
    foreign key (school_id, profile_id)
    references public.profiles(school_id, id) on delete restrict
);

create table public.teacher_accounts (
  school_id uuid not null references public.schools(id) on delete restrict,
  teacher_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (school_id, teacher_id, profile_id),
  constraint teacher_accounts_teacher_school_fk
    foreign key (school_id, teacher_id)
    references public.teachers(school_id, id) on delete restrict,
  constraint teacher_accounts_profile_school_fk
    foreign key (school_id, profile_id)
    references public.profiles(school_id, id) on delete restrict
);

create index administrators_school_active_idx
  on public.administrators (school_id, is_active);
create index teachers_school_active_idx
  on public.teachers (school_id, is_active);
create index administrator_accounts_profile_idx
  on public.administrator_accounts (school_id, profile_id, administrator_id);
create index teacher_accounts_profile_idx
  on public.teacher_accounts (school_id, profile_id, teacher_id);

create trigger administrators_set_updated_at
before update on public.administrators
for each row execute function public.set_updated_at();

create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

alter table public.administrators enable row level security;
alter table public.teachers enable row level security;
alter table public.administrator_accounts enable row level security;
alter table public.teacher_accounts enable row level security;

alter table public.administrators force row level security;
alter table public.teachers force row level security;
alter table public.administrator_accounts force row level security;
alter table public.teacher_accounts force row level security;

-- Preserve existing role ownership deterministically. The approved Task 1 contract
-- reuses each legacy profile UUID for its corresponding business-role record.
-- This mapping is explicit and never depends on matching names or email values.
insert into public.administrators (
  id,
  school_id,
  display_name,
  email,
  is_active,
  created_at,
  updated_at
)
select
  p.id,
  p.school_id,
  p.display_name,
  case when u.email is null then null else lower(trim(u.email)) end,
  p.is_active,
  p.created_at,
  p.updated_at
from public.profiles p
left join auth.users u on u.id = p.auth_user_id
where p.role = 'ADMIN'
on conflict (id) do nothing;

insert into public.teachers (
  id,
  school_id,
  display_name,
  email,
  preferred_language,
  is_active,
  created_at,
  updated_at
)
select
  p.id,
  p.school_id,
  p.display_name,
  case when u.email is null then null else lower(trim(u.email)) end,
  p.preferred_language,
  p.is_active,
  p.created_at,
  p.updated_at
from public.profiles p
left join auth.users u on u.id = p.auth_user_id
where p.role = 'TEACHER'
on conflict (id) do nothing;

insert into public.administrator_accounts (school_id, administrator_id, profile_id)
select p.school_id, p.id, p.id
from public.profiles p
where p.role = 'ADMIN'
on conflict do nothing;

insert into public.teacher_accounts (school_id, teacher_id, profile_id)
select p.school_id, p.id, p.id
from public.profiles p
where p.role = 'TEACHER'
on conflict do nothing;

-- Capability authorization now comes only from explicit active account links.
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
      on aa.school_id = p.school_id
     and aa.profile_id = p.id
    join public.administrators a
      on a.school_id = aa.school_id
     and a.id = aa.administrator_id
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
    on ta.school_id = p.school_id
   and ta.profile_id = p.id
  join public.teachers t
    on t.school_id = ta.school_id
   and t.id = ta.teacher_id
  where p.auth_user_id = auth.uid()
    and p.is_active
    and t.is_active
$$;

revoke all on function public.current_teacher_ids() from public;
revoke execute on function public.current_teacher_ids() from anon;
grant execute on function public.current_teacher_ids() to authenticated;

-- Until Task 3 moves assignment foreign keys to Teacher IDs, legacy/profile-owned
-- assignment rows remain in place but are usable only by explicitly linked Teacher accounts.
create or replace function public.teaches_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_teachers
    where group_teachers.school_id = public.current_school_id()
      and group_teachers.group_id = target_group_id
      and group_teachers.teacher_profile_id = public.current_profile_id()
      and exists (select 1 from public.current_teacher_ids())
  )
$$;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_memberships
    join public.group_teachers
      on group_teachers.school_id = group_memberships.school_id
     and group_teachers.group_id = group_memberships.group_id
    where group_memberships.school_id = public.current_school_id()
      and group_memberships.student_id = target_student_id
      and group_teachers.teacher_profile_id = public.current_profile_id()
      and exists (select 1 from public.current_teacher_ids())
  )
$$;

create or replace function public.teacher_can_teach_context(
  p_profile_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_on_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_subjects cs
    join public.classes c
      on c.school_id = cs.school_id
     and c.id = cs.class_id
    join public.profiles p
      on p.school_id = cs.school_id
     and p.id = p_profile_id
     and p.is_active
    where cs.id = p_class_subject_id
      and cs.is_active
      and c.is_active
      and (
        auth.uid() is null
        or (
          p.id = public.current_profile_id()
          and exists (select 1 from public.current_teacher_ids())
        )
      )
      and (
        auth.uid() is null
        or cs.school_id = public.current_school_id()
      )
      and (
        p_subject_group_id is null
        or exists (
          select 1
          from public.subject_groups sg
          where sg.school_id = cs.school_id
            and sg.class_subject_id = cs.id
            and sg.id = p_subject_group_id
            and sg.is_active
        )
      )
      and exists (
        select 1
        from public.teaching_assignments ta
        where ta.school_id = cs.school_id
          and ta.teacher_profile_id = p_profile_id
          and ta.class_subject_id = cs.id
          and ta.starts_on <= p_on_date
          and (ta.ends_on is null or ta.ends_on >= p_on_date)
          and (
            (p_subject_group_id is null and ta.subject_group_id is null)
            or (
              p_subject_group_id is not null
              and (ta.subject_group_id is null or ta.subject_group_id = p_subject_group_id)
            )
          )
      )
  )
$$;

create or replace function public.current_teacher_can_access_class_subject(
  p_class_subject_id uuid,
  p_on_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_subjects cs
    join public.classes c
      on c.school_id = cs.school_id
     and c.id = cs.class_id
    join public.profiles p
      on p.school_id = cs.school_id
     and p.id = public.current_profile_id()
     and p.is_active
    where cs.id = p_class_subject_id
      and cs.school_id = public.current_school_id()
      and cs.is_active
      and c.is_active
      and exists (select 1 from public.current_teacher_ids())
      and exists (
        select 1
        from public.teaching_assignments ta
        where ta.school_id = cs.school_id
          and ta.teacher_profile_id = p.id
          and ta.class_subject_id = cs.id
          and ta.starts_on <= p_on_date
          and (ta.ends_on is null or ta.ends_on >= p_on_date)
      )
  )
$$;

create or replace function public.current_teacher_can_access_student(
  p_student_id uuid,
  p_on_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teaching_assignments ta
    join public.class_subjects cs
      on cs.school_id = ta.school_id
     and cs.id = ta.class_subject_id
    join public.classes c
      on c.school_id = cs.school_id
     and c.id = cs.class_id
    join public.profiles p
      on p.school_id = ta.school_id
     and p.id = ta.teacher_profile_id
     and p.is_active
    where ta.school_id = public.current_school_id()
      and ta.teacher_profile_id = public.current_profile_id()
      and exists (select 1 from public.current_teacher_ids())
      and ta.starts_on <= p_on_date
      and (ta.ends_on is null or ta.ends_on >= p_on_date)
      and cs.is_active
      and c.is_active
      and public.student_participates_in_class_subject(
        p_student_id,
        ta.class_subject_id,
        p_on_date
      )
      and (
        ta.subject_group_id is null
        or exists (
          select 1
          from public.subject_group_memberships sgm
          join public.subject_groups sg
            on sg.school_id = sgm.school_id
           and sg.class_subject_id = sgm.class_subject_id
           and sg.id = sgm.subject_group_id
          where sgm.school_id = ta.school_id
            and sgm.class_subject_id = ta.class_subject_id
            and sgm.subject_group_id = ta.subject_group_id
            and sgm.student_id = p_student_id
            and sgm.starts_on <= p_on_date
            and (sgm.ends_on is null or sgm.ends_on >= p_on_date)
            and sg.is_active
        )
      )
  )
$$;

-- Direct teacher-row policies also require an explicit active Teacher link.
drop policy if exists group_teachers_select on public.group_teachers;
create policy group_teachers_select on public.group_teachers
for select to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.is_admin()
    or (
      teacher_profile_id = public.current_profile_id()
      and exists (select 1 from public.current_teacher_ids())
    )
  )
);

drop policy if exists teaching_assignments_teacher_select on public.teaching_assignments;
create policy teaching_assignments_teacher_select on public.teaching_assignments
for select to authenticated
using (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and exists (select 1 from public.current_teacher_ids())
);

drop policy if exists weekly_submissions_teacher_update on public.weekly_submissions;
create policy weekly_submissions_teacher_update on public.weekly_submissions
for update to authenticated
using (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and exists (select 1 from public.current_teacher_ids())
  and status = 'DRAFT'
)
with check (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and public.teacher_can_teach_context(
    public.current_profile_id(), class_subject_id, subject_group_id, week_start
  )
);

drop policy if exists weekly_submissions_teacher_delete on public.weekly_submissions;
create policy weekly_submissions_teacher_delete on public.weekly_submissions
for delete to authenticated
using (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and exists (select 1 from public.current_teacher_ids())
  and status = 'DRAFT'
);

drop policy if exists weekly_submission_students_teacher_select on public.weekly_submission_students;
create policy weekly_submission_students_teacher_select on public.weekly_submission_students
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (select 1 from public.current_teacher_ids())
  and exists (
    select 1 from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
  )
);

drop policy if exists weekly_submission_students_teacher_update on public.weekly_submission_students;
create policy weekly_submission_students_teacher_update on public.weekly_submission_students
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (select 1 from public.current_teacher_ids())
  and exists (
    select 1 from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
      and ws.status = 'DRAFT'
  )
)
with check (
  school_id = public.current_school_id()
  and exists (select 1 from public.current_teacher_ids())
  and exists (
    select 1 from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
      and ws.status = 'DRAFT'
  )
);

drop policy if exists weekly_submission_students_teacher_delete on public.weekly_submission_students;
create policy weekly_submission_students_teacher_delete on public.weekly_submission_students
for delete to authenticated
using (
  school_id = public.current_school_id()
  and exists (select 1 from public.current_teacher_ids())
  and exists (
    select 1 from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
      and ws.status = 'DRAFT'
  )
);

create or replace function public.get_weekly_submission_context(p_submission_id uuid)
returns table (
  class_subject_id uuid,
  subject_group_id uuid,
  class_name_en text,
  class_name_ar text,
  subject_name_en text,
  subject_name_ar text,
  group_name_en text,
  group_name_ar text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ws.class_subject_id,
    ws.subject_group_id,
    c.name_en,
    c.name_ar,
    s.name_en,
    s.name_ar,
    sg.name_en,
    sg.name_ar
  from public.weekly_submissions ws
  join public.class_subjects cs
    on cs.school_id = ws.school_id and cs.id = ws.class_subject_id
  join public.classes c
    on c.school_id = cs.school_id and c.id = cs.class_id
  join public.subjects s
    on s.school_id = cs.school_id and s.id = cs.subject_id
  left join public.subject_groups sg
    on sg.school_id = ws.school_id
   and sg.class_subject_id = ws.class_subject_id
   and sg.id = ws.subject_group_id
  where ws.school_id = public.current_school_id()
    and ws.id = p_submission_id
    and (
      public.is_admin()
      or (
        ws.teacher_profile_id = public.current_profile_id()
        and exists (select 1 from public.current_teacher_ids())
      )
    )
$$;
