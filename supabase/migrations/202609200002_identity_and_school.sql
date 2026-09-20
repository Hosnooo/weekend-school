create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  timezone text not null default 'America/Edmonton' check (length(trim(timezone)) > 0),
  default_language public.language_code not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) > 0),
  role public.app_role not null,
  preferred_language public.language_code not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create index profiles_school_role_active_idx
  on public.profiles (school_id, role, is_active);

create trigger schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
