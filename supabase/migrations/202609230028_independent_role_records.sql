-- Forward-only identity correction. Migrations 1-27 are already applied and immutable.
-- Business roles are independent records. Matching names/emails never imply identity or capability.
-- This migration is intentionally additive in Task 1; authorization cutover follows in later tasks.

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
