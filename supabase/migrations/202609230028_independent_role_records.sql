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

-- Deterministic business-role backfill from the one-time legacy role label.
insert into public.administrators (
  id, school_id, display_name, email, is_active, created_at, updated_at
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
  id, school_id, display_name, email, preferred_language, is_active, created_at, updated_at
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

-- Add Teacher ownership beside legacy Profile ownership, then backfill only through
-- explicit same-school links. Never infer a relationship from name or email.
alter table public.group_teachers add column teacher_id uuid;
alter table public.teaching_assignments add column teacher_id uuid;
alter table public.weekly_submissions add column teacher_id uuid;

update public.group_teachers gt
set teacher_id = account_link.teacher_id
from public.teacher_accounts account_link
where account_link.school_id = gt.school_id
  and account_link.profile_id = gt.teacher_profile_id;

update public.teaching_assignments assignment
set teacher_id = account_link.teacher_id
from public.teacher_accounts account_link
where account_link.school_id = assignment.school_id
  and account_link.profile_id = assignment.teacher_profile_id;

update public.weekly_submissions submission
set teacher_id = account_link.teacher_id
from public.teacher_accounts account_link
where account_link.school_id = submission.school_id
  and account_link.profile_id = submission.teacher_profile_id;

do $$
begin
  if exists (select 1 from public.group_teachers where teacher_id is null) then
    raise exception 'unmapped legacy group teacher reference';
  end if;
  if exists (select 1 from public.teaching_assignments where teacher_id is null) then
    raise exception 'unmapped legacy teaching assignment reference';
  end if;
  if exists (select 1 from public.weekly_submissions where teacher_id is null) then
    raise exception 'unmapped legacy weekly submission reference';
  end if;
end;
$$;

-- Remove policy/trigger dependencies on the legacy teacher Profile columns.
drop policy if exists group_teachers_select on public.group_teachers;
drop policy if exists teaching_assignments_teacher_select on public.teaching_assignments;
drop policy if exists weekly_submissions_teacher_select on public.weekly_submissions;
drop policy if exists weekly_submissions_teacher_insert on public.weekly_submissions;
drop policy if exists weekly_submissions_teacher_update on public.weekly_submissions;
drop policy if exists weekly_submissions_teacher_delete on public.weekly_submissions;
drop policy if exists weekly_submission_students_teacher_select on public.weekly_submission_students;
drop policy if exists weekly_submission_students_teacher_insert on public.weekly_submission_students;
drop policy if exists weekly_submission_students_teacher_update on public.weekly_submission_students;
drop policy if exists weekly_submission_students_teacher_delete on public.weekly_submission_students;
drop trigger if exists weekly_submissions_validate_context on public.weekly_submissions;

drop index if exists public.group_teachers_teacher_idx;
alter table public.group_teachers
  drop constraint if exists group_teachers_pkey,
  drop constraint if exists group_teachers_school_id_teacher_profile_id_fkey;

drop index if exists public.teaching_assignments_teacher_idx;
alter table public.teaching_assignments
  drop constraint if exists teaching_assignments_profile_school_fk,
  drop constraint if exists teaching_assignments_no_duplicate_overlap;

drop index if exists public.weekly_submissions_teacher_week_idx;
alter table public.weekly_submissions
  drop constraint if exists weekly_submissions_teacher_school_fk,
  drop constraint if exists weekly_submissions_one_teacher_context_week;

alter table public.group_teachers
  alter column teacher_id set not null,
  add constraint group_teachers_teacher_school_fk
    foreign key (school_id, teacher_id)
    references public.teachers(school_id, id) on delete restrict,
  add constraint group_teachers_pkey primary key (school_id, group_id, teacher_id);

create index group_teachers_teacher_idx
  on public.group_teachers (school_id, teacher_id, group_id);

alter table public.teaching_assignments
  alter column teacher_id set not null,
  add constraint teaching_assignments_teacher_school_fk
    foreign key (school_id, teacher_id)
    references public.teachers(school_id, id) on delete restrict,
  add constraint teaching_assignments_no_duplicate_overlap
    exclude using gist (
      school_id with =,
      teacher_id with =,
      class_subject_id with =,
      (coalesce(subject_group_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
      daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
    );

create index teaching_assignments_teacher_idx
  on public.teaching_assignments (school_id, teacher_id, starts_on, ends_on);

alter table public.weekly_submissions
  alter column teacher_id set not null,
  add constraint weekly_submissions_teacher_school_fk
    foreign key (school_id, teacher_id)
    references public.teachers(school_id, id) on delete restrict,
  add constraint weekly_submissions_one_teacher_context_week
    unique nulls not distinct (
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_id,
      week_start
    );

create index weekly_submissions_teacher_week_idx
  on public.weekly_submissions (school_id, teacher_id, week_start desc);

alter table public.group_teachers drop column teacher_profile_id;
alter table public.teaching_assignments drop column teacher_profile_id;
alter table public.weekly_submissions drop column teacher_profile_id;

-- Capability authorization comes only from explicit active account links.
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
    join public.administrator_accounts account_link
      on account_link.school_id = p.school_id
     and account_link.profile_id = p.id
    join public.administrators administrator
      on administrator.school_id = account_link.school_id
     and administrator.id = account_link.administrator_id
    where p.auth_user_id = auth.uid()
      and p.is_active
      and administrator.is_active
  )
$$;

create function public.current_teacher_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select teacher.id
  from public.profiles p
  join public.teacher_accounts account_link
    on account_link.school_id = p.school_id
   and account_link.profile_id = p.id
  join public.teachers teacher
    on teacher.school_id = account_link.school_id
   and teacher.id = account_link.teacher_id
  where p.auth_user_id = auth.uid()
    and p.is_active
    and teacher.is_active
$$;

revoke all on function public.current_teacher_ids() from public;
revoke execute on function public.current_teacher_ids() from anon;
grant execute on function public.current_teacher_ids() to authenticated;

create or replace function public.teaches_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_teachers assignment
    where assignment.school_id = public.current_school_id()
      and assignment.group_id = target_group_id
      and assignment.teacher_id in (select public.current_teacher_ids())
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
    from public.group_memberships membership
    join public.group_teachers assignment
      on assignment.school_id = membership.school_id
     and assignment.group_id = membership.group_id
    where membership.school_id = public.current_school_id()
      and membership.student_id = target_student_id
      and assignment.teacher_id in (select public.current_teacher_ids())
  )
$$;

-- Preserve the historical four-argument signature for migrations 20/24. The first
-- UUID may be a concrete Teacher ID or a Profile ID that resolves through an
-- explicit teacher_accounts link.
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
  with candidate_teachers as (
    select teacher.school_id, teacher.id as teacher_id
    from public.teachers teacher
    where teacher.id = p_profile_id
      and teacher.is_active

    union

    select teacher.school_id, teacher.id
    from public.teacher_accounts account_link
    join public.teachers teacher
      on teacher.school_id = account_link.school_id
     and teacher.id = account_link.teacher_id
    join public.profiles p
      on p.school_id = account_link.school_id
     and p.id = account_link.profile_id
    where account_link.profile_id = p_profile_id
      and p.is_active
      and teacher.is_active
  )
  select exists (
    select 1
    from public.class_subjects class_subject
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    join candidate_teachers candidate
      on candidate.school_id = class_subject.school_id
    where class_subject.id = p_class_subject_id
      and class_subject.is_active
      and class_row.is_active
      and (
        auth.uid() is null
        or (
          class_subject.school_id = public.current_school_id()
          and candidate.teacher_id in (select public.current_teacher_ids())
        )
      )
      and (
        p_subject_group_id is null
        or exists (
          select 1
          from public.subject_groups subject_group
          where subject_group.school_id = class_subject.school_id
            and subject_group.class_subject_id = class_subject.id
            and subject_group.id = p_subject_group_id
            and subject_group.is_active
        )
      )
      and exists (
        select 1
        from public.teaching_assignments assignment
        where assignment.school_id = class_subject.school_id
          and assignment.teacher_id = candidate.teacher_id
          and assignment.class_subject_id = class_subject.id
          and assignment.starts_on <= p_on_date
          and (assignment.ends_on is null or assignment.ends_on >= p_on_date)
          and (
            (p_subject_group_id is null and assignment.subject_group_id is null)
            or (
              p_subject_group_id is not null
              and (
                assignment.subject_group_id is null
                or assignment.subject_group_id = p_subject_group_id
              )
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
    from public.class_subjects class_subject
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    where class_subject.id = p_class_subject_id
      and class_subject.school_id = public.current_school_id()
      and class_subject.is_active
      and class_row.is_active
      and exists (
        select 1
        from public.teaching_assignments assignment
        where assignment.school_id = class_subject.school_id
          and assignment.teacher_id in (select public.current_teacher_ids())
          and assignment.class_subject_id = class_subject.id
          and assignment.starts_on <= p_on_date
          and (assignment.ends_on is null or assignment.ends_on >= p_on_date)
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
    from public.teaching_assignments assignment
    join public.class_subjects class_subject
      on class_subject.school_id = assignment.school_id
     and class_subject.id = assignment.class_subject_id
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    where assignment.school_id = public.current_school_id()
      and assignment.teacher_id in (select public.current_teacher_ids())
      and assignment.starts_on <= p_on_date
      and (assignment.ends_on is null or assignment.ends_on >= p_on_date)
      and class_subject.is_active
      and class_row.is_active
      and public.student_participates_in_class_subject(
        p_student_id,
        assignment.class_subject_id,
        p_on_date
      )
      and (
        assignment.subject_group_id is null
        or exists (
          select 1
          from public.subject_group_memberships membership
          join public.subject_groups subject_group
            on subject_group.school_id = membership.school_id
           and subject_group.class_subject_id = membership.class_subject_id
           and subject_group.id = membership.subject_group_id
          where membership.school_id = assignment.school_id
            and membership.class_subject_id = assignment.class_subject_id
            and membership.subject_group_id = assignment.subject_group_id
            and membership.student_id = p_student_id
            and membership.starts_on <= p_on_date
            and (membership.ends_on is null or membership.ends_on >= p_on_date)
            and subject_group.is_active
        )
      )
  )
$$;

-- Legacy Group RPC names remain callable during the redesign, but their teacher
-- UUID argument now denotes a Teacher business record.
create or replace function public.create_group_with_teacher(
  p_name_en text,
  p_name_ar text,
  p_parent_group_id uuid,
  p_teacher_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  new_group_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_teacher_profile_id is not null and not exists (
    select 1 from public.teachers teacher
    where teacher.school_id = target_school_id
      and teacher.id = p_teacher_profile_id
      and teacher.is_active
  ) then
    raise exception 'active teacher not found' using errcode = '23503';
  end if;

  insert into public.groups (school_id, name_en, name_ar, parent_group_id)
  values (target_school_id, trim(p_name_en), nullif(trim(p_name_ar), ''), p_parent_group_id)
  returning id into new_group_id;

  if p_teacher_profile_id is not null then
    insert into public.group_teachers (school_id, group_id, teacher_id, assignment_type)
    values (target_school_id, new_group_id, p_teacher_profile_id, 'PRIMARY');
  end if;
  return new_group_id;
end;
$$;

create or replace function public.update_group_with_teacher_confirmed(
  p_group_id uuid,
  p_name_en text,
  p_name_ar text,
  p_parent_group_id uuid,
  p_teacher_profile_id uuid,
  p_allow_reassignment boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  current_teacher_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_allow_reassignment is null then
    raise exception 'invalid assignment request' using errcode = '22023';
  end if;

  perform 1 from public.groups group_row
  where group_row.school_id = target_school_id
    and group_row.id = p_group_id
    and group_row.is_active
  for update;
  if not found then
    raise exception 'active group not found' using errcode = 'P0002';
  end if;

  if p_teacher_profile_id is not null and not exists (
    select 1 from public.teachers teacher
    where teacher.school_id = target_school_id
      and teacher.id = p_teacher_profile_id
      and teacher.is_active
  ) then
    raise exception 'active teacher not found' using errcode = '23503';
  end if;

  select assignment.teacher_id into current_teacher_id
  from public.group_teachers assignment
  where assignment.school_id = target_school_id
    and assignment.group_id = p_group_id
    and assignment.assignment_type = 'PRIMARY';

  if current_teacher_id is not null
    and current_teacher_id is distinct from p_teacher_profile_id
    and not p_allow_reassignment
  then
    raise exception 'primary teacher conflict' using errcode = '23505';
  end if;

  update public.groups group_row
  set name_en = trim(p_name_en),
      name_ar = nullif(trim(p_name_ar), ''),
      parent_group_id = p_parent_group_id
  where group_row.school_id = target_school_id
    and group_row.id = p_group_id;

  if current_teacher_id is distinct from p_teacher_profile_id then
    delete from public.group_teachers assignment
    where assignment.school_id = target_school_id
      and assignment.group_id = p_group_id
      and assignment.assignment_type = 'PRIMARY';

    if p_teacher_profile_id is not null then
      insert into public.group_teachers (school_id, group_id, teacher_id, assignment_type)
      values (target_school_id, p_group_id, p_teacher_profile_id, 'PRIMARY');
    end if;
  end if;
end;
$$;

create or replace function public.update_group_with_teacher(
  p_group_id uuid,
  p_name_en text,
  p_name_ar text,
  p_parent_group_id uuid,
  p_teacher_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.update_group_with_teacher_confirmed(
    p_group_id, p_name_en, p_name_ar, p_parent_group_id, p_teacher_profile_id, false
  );
end;
$$;

create or replace function public.replace_teacher_group_assignments_confirmed(
  p_teacher_profile_id uuid,
  p_group_ids uuid[],
  p_allow_reassignment boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  requested_group_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_group_ids is null or p_allow_reassignment is null then
    raise exception 'invalid assignment request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.teachers teacher
    where teacher.school_id = target_school_id
      and teacher.id = p_teacher_profile_id
      and teacher.is_active
  ) then
    raise exception 'active teacher not found' using errcode = '23503';
  end if;

  for requested_group_id in
    select distinct requested.group_id
    from unnest(p_group_ids) as requested(group_id)
    order by requested.group_id
  loop
    if requested_group_id is null then
      raise exception 'active group not found' using errcode = '23503';
    end if;
    perform 1 from public.groups group_row
    where group_row.school_id = target_school_id
      and group_row.id = requested_group_id
      and group_row.is_active
    for update;
    if not found then
      raise exception 'active group not found' using errcode = '23503';
    end if;
  end loop;

  if not p_allow_reassignment and exists (
    select 1 from public.group_teachers assignment
    where assignment.school_id = target_school_id
      and assignment.assignment_type = 'PRIMARY'
      and assignment.group_id = any(p_group_ids)
      and assignment.teacher_id <> p_teacher_profile_id
  ) then
    raise exception 'primary teacher conflict' using errcode = '23505';
  end if;

  if p_allow_reassignment then
    delete from public.group_teachers assignment
    where assignment.school_id = target_school_id
      and assignment.assignment_type = 'PRIMARY'
      and assignment.group_id = any(p_group_ids)
      and assignment.teacher_id <> p_teacher_profile_id;
  end if;

  delete from public.group_teachers assignment
  where assignment.school_id = target_school_id
    and assignment.assignment_type = 'PRIMARY'
    and assignment.teacher_id = p_teacher_profile_id
    and not (assignment.group_id = any(p_group_ids));

  insert into public.group_teachers (school_id, group_id, teacher_id, assignment_type)
  select target_school_id, requested.group_id, p_teacher_profile_id, 'PRIMARY'
  from (select distinct unnest(p_group_ids) as group_id) requested
  where not exists (
    select 1 from public.group_teachers existing_assignment
    where existing_assignment.school_id = target_school_id
      and existing_assignment.group_id = requested.group_id
      and existing_assignment.teacher_id = p_teacher_profile_id
      and existing_assignment.assignment_type = 'PRIMARY'
  );
end;
$$;

create or replace function public.replace_teacher_group_assignments(
  p_teacher_profile_id uuid,
  p_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.replace_teacher_group_assignments_confirmed(
    p_teacher_profile_id, p_group_ids, false
  );
end;
$$;

create or replace function public.update_teacher_administration_confirmed(
  p_teacher_profile_id uuid,
  p_display_name text,
  p_preferred_language public.language_code,
  p_group_ids uuid[],
  p_allow_reassignment boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  update public.teachers teacher
  set display_name = trim(p_display_name),
      preferred_language = p_preferred_language
  where teacher.school_id = target_school_id
    and teacher.id = p_teacher_profile_id
    and teacher.is_active;

  if not found then
    raise exception 'active teacher not found' using errcode = 'P0002';
  end if;

  perform public.replace_teacher_group_assignments_confirmed(
    p_teacher_profile_id, p_group_ids, p_allow_reassignment
  );
end;
$$;

create or replace function public.update_teacher_administration(
  p_teacher_profile_id uuid,
  p_display_name text,
  p_preferred_language public.language_code,
  p_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.update_teacher_administration_confirmed(
    p_teacher_profile_id, p_display_name, p_preferred_language, p_group_ids, false
  );
end;
$$;

-- Weekly submission validation now checks the concrete Teacher author.
create or replace function public.validate_weekly_submission_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.subject_group_id is not null and not exists (
    select 1 from public.subject_groups subject_group
    where subject_group.school_id = new.school_id
      and subject_group.class_subject_id = new.class_subject_id
      and subject_group.id = new.subject_group_id
  ) then
    return new;
  end if;

  if not public.teacher_can_teach_context(
    new.teacher_id,
    new.class_subject_id,
    new.subject_group_id,
    new.week_start
  ) then
    raise exception 'teacher is not assigned to this teaching context'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_weekly_submission_context() from public;
revoke execute on function public.validate_weekly_submission_context() from anon;
revoke execute on function public.validate_weekly_submission_context() from authenticated;

create trigger weekly_submissions_validate_context
before insert or update of school_id, class_subject_id, subject_group_id, teacher_id, week_start
on public.weekly_submissions
for each row execute function public.validate_weekly_submission_context();

-- New public role tables are accessible only through their same-school RLS policies.
create policy administrators_admin_all on public.administrators
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy teachers_admin_all on public.teachers
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy teachers_linked_select on public.teachers
for select to authenticated
using (
  school_id = public.current_school_id()
  and id in (select public.current_teacher_ids())
);

create policy administrator_accounts_admin_all on public.administrator_accounts
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy teacher_accounts_admin_all on public.teacher_accounts
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

grant select, insert, update, delete
on public.administrators, public.teachers, public.administrator_accounts, public.teacher_accounts
to authenticated;

create policy group_teachers_select on public.group_teachers
for select to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.is_admin()
    or teacher_id in (select public.current_teacher_ids())
  )
);

create policy teaching_assignments_teacher_select on public.teaching_assignments
for select to authenticated
using (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
);

create policy weekly_submissions_teacher_select on public.weekly_submissions
for select to authenticated
using (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
);

create policy weekly_submissions_teacher_insert on public.weekly_submissions
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
  and public.teacher_can_teach_context(teacher_id, class_subject_id, subject_group_id, week_start)
);

create policy weekly_submissions_teacher_update on public.weekly_submissions
for update to authenticated
using (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
  and status = 'DRAFT'
)
with check (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
  and public.teacher_can_teach_context(teacher_id, class_subject_id, subject_group_id, week_start)
);

create policy weekly_submissions_teacher_delete on public.weekly_submissions
for delete to authenticated
using (
  school_id = public.current_school_id()
  and teacher_id in (select public.current_teacher_ids())
  and status = 'DRAFT'
);

create policy weekly_submission_students_teacher_select on public.weekly_submission_students
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.weekly_submissions submission
    where submission.school_id = weekly_submission_students.school_id
      and submission.id = weekly_submission_students.submission_id
      and submission.teacher_id in (select public.current_teacher_ids())
  )
);

create policy weekly_submission_students_teacher_insert on public.weekly_submission_students
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.weekly_submissions submission
    where submission.school_id = weekly_submission_students.school_id
      and submission.id = weekly_submission_students.submission_id
      and submission.teacher_id in (select public.current_teacher_ids())
      and submission.status = 'DRAFT'
      and public.teacher_can_teach_context(
        submission.teacher_id,
        submission.class_subject_id,
        submission.subject_group_id,
        submission.week_start
      )
      and public.student_participates_in_class_subject(
        weekly_submission_students.student_id,
        submission.class_subject_id,
        submission.week_start
      )
      and (
        submission.subject_group_id is null
        or exists (
          select 1 from public.subject_group_memberships membership
          where membership.school_id = submission.school_id
            and membership.class_subject_id = submission.class_subject_id
            and membership.subject_group_id = submission.subject_group_id
            and membership.student_id = weekly_submission_students.student_id
            and membership.starts_on <= submission.week_start
            and (membership.ends_on is null or membership.ends_on >= submission.week_start)
        )
      )
  )
);

create policy weekly_submission_students_teacher_update on public.weekly_submission_students
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.weekly_submissions submission
    where submission.school_id = weekly_submission_students.school_id
      and submission.id = weekly_submission_students.submission_id
      and submission.teacher_id in (select public.current_teacher_ids())
      and submission.status = 'DRAFT'
  )
)
with check (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.weekly_submissions submission
    where submission.school_id = weekly_submission_students.school_id
      and submission.id = weekly_submission_students.submission_id
      and submission.teacher_id in (select public.current_teacher_ids())
      and submission.status = 'DRAFT'
  )
);

create policy weekly_submission_students_teacher_delete on public.weekly_submission_students
for delete to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1 from public.weekly_submissions submission
    where submission.school_id = weekly_submission_students.school_id
      and submission.id = weekly_submission_students.submission_id
      and submission.teacher_id in (select public.current_teacher_ids())
      and submission.status = 'DRAFT'
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
    submission.class_subject_id,
    submission.subject_group_id,
    class_row.name_en,
    class_row.name_ar,
    subject.name_en,
    subject.name_ar,
    subject_group.name_en,
    subject_group.name_ar
  from public.weekly_submissions submission
  join public.class_subjects class_subject
    on class_subject.school_id = submission.school_id
   and class_subject.id = submission.class_subject_id
  join public.classes class_row
    on class_row.school_id = class_subject.school_id
   and class_row.id = class_subject.class_id
  join public.subjects subject
    on subject.school_id = class_subject.school_id
   and subject.id = class_subject.subject_id
  left join public.subject_groups subject_group
    on subject_group.school_id = submission.school_id
   and subject_group.class_subject_id = submission.class_subject_id
   and subject_group.id = submission.subject_group_id
  where submission.school_id = public.current_school_id()
    and submission.id = p_submission_id
    and (
      public.is_admin()
      or submission.teacher_id in (select public.current_teacher_ids())
    )
$$;

-- Explicit-author save path used by the application after the cutover.
create function public.save_weekly_submission(
  p_teacher_id uuid,
  p_submission_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_week_start date,
  p_progress_en text,
  p_progress_ar text,
  p_default_performance public.performance_level,
  p_attendance jsonb,
  p_exceptions jsonb,
  p_submit boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_submission_id uuid := p_submission_id;
  target_status public.session_status;
  roster_count integer;
  attendance_count integer;
begin
  if target_school_id is null
    or p_teacher_id not in (select public.current_teacher_ids())
    or not public.teacher_can_teach_context(
      p_teacher_id, p_class_subject_id, p_subject_group_id, p_week_start
    )
  then
    raise exception 'assigned teaching context required' using errcode = '42501';
  end if;

  if target_submission_id is null then
    insert into public.weekly_submissions (
      school_id, class_subject_id, subject_group_id, teacher_id, week_start
    ) values (
      target_school_id, p_class_subject_id, p_subject_group_id, p_teacher_id, p_week_start
    )
    on conflict on constraint weekly_submissions_one_teacher_context_week do nothing
    returning id into target_submission_id;

    if target_submission_id is null then
      select submission.id into target_submission_id
      from public.weekly_submissions submission
      where submission.school_id = target_school_id
        and submission.class_subject_id = p_class_subject_id
        and submission.subject_group_id is not distinct from p_subject_group_id
        and submission.teacher_id = p_teacher_id
        and submission.week_start = p_week_start;
    end if;
  end if;

  select submission.status into target_status
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = target_submission_id
    and submission.class_subject_id = p_class_subject_id
    and submission.subject_group_id is not distinct from p_subject_group_id
    and submission.teacher_id = p_teacher_id
    and submission.week_start = p_week_start
  for update;

  if target_status is null then
    raise exception 'weekly submission access required' using errcode = '42501';
  end if;
  if target_status = 'SUBMITTED' then
    raise exception 'submitted weekly submissions are immutable' using errcode = '55000';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
      as item(student_id uuid, status public.attendance_status)
    where not exists (
      select 1 from public.get_weekly_submission_roster(
        p_class_subject_id, p_subject_group_id, p_week_start
      ) roster
      where roster.student_id = item.student_id
    )
  ) then
    raise exception 'attendance student is outside the weekly roster' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb))
      as item(
        student_id uuid,
        performance_override public.performance_level,
        comment_en text,
        comment_ar text
      )
    where not exists (
      select 1 from public.get_weekly_submission_roster(
        p_class_subject_id, p_subject_group_id, p_week_start
      ) roster
      where roster.student_id = item.student_id
    )
  ) then
    raise exception 'exception student is outside the weekly roster' using errcode = '42501';
  end if;

  update public.weekly_submissions
  set progress_en = nullif(trim(p_progress_en), ''),
      progress_ar = nullif(trim(p_progress_ar), ''),
      default_performance = p_default_performance
  where school_id = target_school_id
    and id = target_submission_id;

  delete from public.weekly_submission_students
  where school_id = target_school_id
    and submission_id = target_submission_id;

  insert into public.weekly_submission_students (
    school_id, submission_id, student_id, attendance_status
  )
  select target_school_id, target_submission_id, item.student_id, item.status
  from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
    as item(student_id uuid, status public.attendance_status);

  update public.weekly_submission_students student_row
  set performance_override = item.performance_override,
      comment_en = nullif(trim(item.comment_en), ''),
      comment_ar = nullif(trim(item.comment_ar), '')
  from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb))
    as item(
      student_id uuid,
      performance_override public.performance_level,
      comment_en text,
      comment_ar text
    )
  where student_row.school_id = target_school_id
    and student_row.submission_id = target_submission_id
    and student_row.student_id = item.student_id
    and (
      item.performance_override is not null
      or nullif(trim(item.comment_en), '') is not null
      or nullif(trim(item.comment_ar), '') is not null
    );

  if p_submit then
    if nullif(trim(p_progress_en), '') is null
      and nullif(trim(p_progress_ar), '') is null
    then
      raise exception 'progress is required for submission' using errcode = '23514';
    end if;

    select count(*) into roster_count
    from public.get_weekly_submission_roster(
      p_class_subject_id, p_subject_group_id, p_week_start
    );

    select count(distinct student_row.student_id) into attendance_count
    from public.weekly_submission_students student_row
    where student_row.school_id = target_school_id
      and student_row.submission_id = target_submission_id;

    if attendance_count <> roster_count then
      raise exception 'complete attendance is required for submission' using errcode = '23514';
    end if;

    update public.weekly_submissions
    set status = 'SUBMITTED', submitted_at = now()
    where school_id = target_school_id
      and id = target_submission_id;
  end if;

  return target_submission_id;
end;
$$;

revoke all on function public.save_weekly_submission(
  uuid, uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean
) from public;
revoke execute on function public.save_weekly_submission(
  uuid, uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean
) from anon;
grant execute on function public.save_weekly_submission(
  uuid, uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean
) to authenticated;

-- Preserve the original 10-argument RPC for a login that resolves to exactly one
-- capable Teacher in the requested context.
create or replace function public.save_weekly_submission(
  p_submission_id uuid,
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_week_start date,
  p_progress_en text,
  p_progress_ar text,
  p_default_performance public.performance_level,
  p_attendance jsonb,
  p_exceptions jsonb,
  p_submit boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_teacher_id uuid;
  matching_teacher_count integer := 0;
begin
  select candidate.teacher_id, candidate.match_count
  into resolved_teacher_id, matching_teacher_count
  from (
    select current_id as teacher_id, count(*) over ()::integer as match_count
    from public.current_teacher_ids() current_id
    where public.teacher_can_teach_context(
      current_id, p_class_subject_id, p_subject_group_id, p_week_start
    )
  ) candidate
  limit 1;

  if coalesce(matching_teacher_count, 0) <> 1 then
    raise exception 'exactly one Teacher identity is required for this teaching context'
      using errcode = '42501';
  end if;

  return public.save_weekly_submission(
    resolved_teacher_id,
    p_submission_id,
    p_class_subject_id,
    p_subject_group_id,
    p_week_start,
    p_progress_en,
    p_progress_ar,
    p_default_performance,
    p_attendance,
    p_exceptions,
    p_submit
  );
end;
$$;

revoke all on function public.save_weekly_submission(
  uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean
) from public;
revoke execute on function public.save_weekly_submission(
  uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean
) from anon;
grant execute on function public.save_weekly_submission(
  uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean
) to authenticated;

-- Profiles are authenticated/audit identities only after this point.
create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and not public.is_admin()
    and row(
      new.id,
      new.school_id,
      new.auth_user_id,
      new.display_name,
      new.is_active,
      new.created_at
    ) is distinct from row(
      old.id,
      old.school_id,
      old.auth_user_id,
      old.display_name,
      old.is_active,
      old.created_at
    )
  then
    raise exception 'profile fields cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop function if exists public.current_app_role();
drop index if exists public.profiles_school_role_active_idx;
alter table public.profiles drop column role;
