create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  first_name_en text not null check (length(trim(first_name_en)) > 0),
  last_name_en text not null check (length(trim(last_name_en)) > 0),
  first_name_ar text check (first_name_ar is null or length(trim(first_name_ar)) > 0),
  last_name_ar text check (last_name_ar is null or length(trim(last_name_ar)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  report_language public.report_language not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.student_guardians (
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  guardian_id uuid not null,
  receives_reports boolean not null default true,
  is_primary boolean not null default false,
  primary key (school_id, student_id, guardian_id),
  foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  foreign key (school_id, guardian_id)
    references public.guardians(school_id, id) on delete restrict
);

create unique index student_guardians_one_primary_idx
  on public.student_guardians (school_id, student_id)
  where is_primary;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text check (name_ar is null or length(trim(name_ar)) > 0),
  parent_group_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, parent_group_id)
    references public.groups(school_id, id) on delete restrict,
  check (parent_group_id is null or parent_group_id <> id)
);

create table public.group_teachers (
  school_id uuid not null references public.schools(id) on delete restrict,
  group_id uuid not null,
  teacher_profile_id uuid not null,
  assignment_type public.assignment_type not null default 'PRIMARY',
  primary key (school_id, group_id, teacher_profile_id),
  foreign key (school_id, group_id)
    references public.groups(school_id, id) on delete restrict,
  foreign key (school_id, teacher_profile_id)
    references public.profiles(school_id, id) on delete restrict
);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  group_id uuid not null,
  student_id uuid not null,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, group_id)
    references public.groups(school_id, id) on delete restrict,
  foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on),
  exclude using gist (
    school_id with =,
    group_id with =,
    student_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  )
);

create index students_school_active_name_idx
  on public.students (school_id, is_active, last_name_en, first_name_en);
create index guardians_school_active_idx on public.guardians (school_id, is_active);
create index groups_school_active_idx on public.groups (school_id, is_active);
create index group_teachers_teacher_idx
  on public.group_teachers (school_id, teacher_profile_id, group_id);
create index group_memberships_roster_idx
  on public.group_memberships (school_id, group_id, starts_on, ends_on);
create index group_memberships_student_idx
  on public.group_memberships (school_id, student_id, starts_on, ends_on);

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();
create trigger guardians_set_updated_at
before update on public.guardians
for each row execute function public.set_updated_at();
create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();
