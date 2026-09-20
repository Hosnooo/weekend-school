create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  group_id uuid not null,
  session_date date not null,
  status public.session_status not null default 'DRAFT',
  created_by uuid not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, group_id, session_date),
  foreign key (school_id, group_id)
    references public.groups(school_id, id) on delete restrict,
  foreign key (school_id, created_by)
    references public.profiles(school_id, id) on delete restrict,
  check (
    (status = 'DRAFT' and submitted_at is null)
    or (status = 'SUBMITTED' and submitted_at is not null)
  )
);

create table public.group_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  session_id uuid not null,
  progress_en text check (progress_en is null or length(trim(progress_en)) > 0),
  progress_ar text check (progress_ar is null or length(trim(progress_ar)) > 0),
  default_performance public.performance_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, session_id),
  foreign key (school_id, session_id)
    references public.sessions(school_id, id) on delete restrict
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  session_id uuid not null,
  student_id uuid not null,
  status public.attendance_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, session_id, student_id),
  foreign key (school_id, session_id)
    references public.sessions(school_id, id) on delete restrict,
  foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict
);

create table public.student_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  session_id uuid not null,
  student_id uuid not null,
  performance_override public.performance_level,
  comment_en text check (comment_en is null or length(trim(comment_en)) > 0),
  comment_ar text check (comment_ar is null or length(trim(comment_ar)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, session_id, student_id),
  foreign key (school_id, session_id)
    references public.sessions(school_id, id) on delete restrict,
  foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  check (
    performance_override is not null
    or comment_en is not null
    or comment_ar is not null
  )
);

create index sessions_group_date_idx
  on public.sessions (school_id, group_id, session_date desc);
create index sessions_status_date_idx
  on public.sessions (school_id, status, session_date desc);
create index attendance_student_session_idx
  on public.attendance (school_id, student_id, session_id);
create index student_progress_student_session_idx
  on public.student_progress (school_id, student_id, session_id);

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();
create trigger group_progress_set_updated_at
before update on public.group_progress
for each row execute function public.set_updated_at();
create trigger attendance_set_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();
create trigger student_progress_set_updated_at
before update on public.student_progress
for each row execute function public.set_updated_at();
