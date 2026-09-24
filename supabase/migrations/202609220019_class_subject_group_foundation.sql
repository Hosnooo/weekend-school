-- Forward-only architecture correction. Migrations 1-18 are already applied and immutable.
-- This migration introduces the explicit Class -> Subject -> optional Group model
-- without removing legacy group/session storage.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text check (name_ar is null or length(trim(name_ar)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text check (name_ar is null or length(trim(name_ar)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name_en)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid not null,
  subject_id uuid not null,
  default_group_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, class_id, subject_id),
  constraint class_subjects_class_school_fk
    foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete restrict,
  constraint class_subjects_subject_school_fk
    foreign key (school_id, subject_id)
    references public.subjects(school_id, id) on delete restrict
);

create table public.subject_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_subject_id uuid not null,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text check (name_ar is null or length(trim(name_ar)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, class_subject_id, id),
  unique (school_id, class_subject_id, name_en),
  constraint subject_groups_class_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict
);

alter table public.class_subjects
  add constraint class_subjects_default_group_context_fk
  foreign key (school_id, id, default_group_id)
  references public.subject_groups(school_id, class_subject_id, id)
  on delete restrict;

create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid not null,
  student_id uuid not null,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  constraint class_enrollments_class_school_fk
    foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete restrict,
  constraint class_enrollments_student_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on),
  constraint class_enrollments_one_active_class_per_student
    exclude using gist (
      school_id with =,
      student_id with =,
      daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
    )
);

create table public.subject_exclusions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_subject_id uuid not null,
  student_id uuid not null,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  constraint subject_exclusions_class_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict,
  constraint subject_exclusions_student_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on),
  constraint subject_exclusions_no_overlap
    exclude using gist (
      school_id with =,
      class_subject_id with =,
      student_id with =,
      daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
    )
);

create table public.subject_group_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_subject_id uuid not null,
  subject_group_id uuid not null,
  student_id uuid not null,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  constraint subject_group_memberships_class_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict,
  constraint subject_group_memberships_group_context_fk
    foreign key (school_id, class_subject_id, subject_group_id)
    references public.subject_groups(school_id, class_subject_id, id) on delete restrict,
  constraint subject_group_memberships_student_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on),
  constraint subject_group_memberships_one_group_per_class_subject
    exclude using gist (
      school_id with =,
      class_subject_id with =,
      student_id with =,
      daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
    )
);

create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  teacher_profile_id uuid not null,
  class_subject_id uuid not null,
  subject_group_id uuid,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  constraint teaching_assignments_profile_school_fk
    foreign key (school_id, teacher_profile_id)
    references public.profiles(school_id, id) on delete restrict,
  constraint teaching_assignments_class_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict,
  constraint teaching_assignments_group_context_fk
    foreign key (school_id, class_subject_id, subject_group_id)
    references public.subject_groups(school_id, class_subject_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on),
  constraint teaching_assignments_no_duplicate_overlap
    exclude using gist (
      school_id with =,
      teacher_profile_id with =,
      class_subject_id with =,
      (coalesce(subject_group_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
      daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
    )
);

create index classes_school_active_name_idx
  on public.classes (school_id, is_active, name_en);
create index subjects_school_active_name_idx
  on public.subjects (school_id, is_active, name_en);
create index class_subjects_class_active_idx
  on public.class_subjects (school_id, class_id, is_active);
create index class_subjects_subject_active_idx
  on public.class_subjects (school_id, subject_id, is_active);
create index subject_groups_context_active_idx
  on public.subject_groups (school_id, class_subject_id, is_active, name_en);
create index class_enrollments_class_roster_idx
  on public.class_enrollments (school_id, class_id, starts_on, ends_on);
create index class_enrollments_student_history_idx
  on public.class_enrollments (school_id, student_id, starts_on, ends_on);
create index subject_exclusions_student_idx
  on public.subject_exclusions (school_id, student_id, class_subject_id, starts_on, ends_on);
create index subject_group_memberships_roster_idx
  on public.subject_group_memberships (school_id, class_subject_id, subject_group_id, starts_on, ends_on);
create index subject_group_memberships_student_idx
  on public.subject_group_memberships (school_id, student_id, class_subject_id, starts_on, ends_on);
create index teaching_assignments_teacher_idx
  on public.teaching_assignments (school_id, teacher_profile_id, starts_on, ends_on);
create index teaching_assignments_context_idx
  on public.teaching_assignments (school_id, class_subject_id, subject_group_id, starts_on, ends_on);

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger class_subjects_set_updated_at
before update on public.class_subjects
for each row execute function public.set_updated_at();

create trigger subject_groups_set_updated_at
before update on public.subject_groups
for each row execute function public.set_updated_at();

-- Preserve the existing minimal hosted setup without inventing Subjects.
-- Legacy root groups are represented as Classes with the same IDs and labels.
insert into public.classes (
  id,
  school_id,
  name_en,
  name_ar,
  is_active,
  created_at,
  updated_at
)
select
  groups.id,
  groups.school_id,
  groups.name_en,
  groups.name_ar,
  groups.is_active,
  groups.created_at,
  groups.updated_at
from public.groups
where groups.parent_group_id is null
on conflict (id) do nothing;

create function public.student_participates_in_class_subject(
  p_student_id uuid,
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
    join public.students s
      on s.school_id = cs.school_id
     and s.id = p_student_id
    join public.class_enrollments ce
      on ce.school_id = cs.school_id
     and ce.class_id = cs.class_id
     and ce.student_id = p_student_id
     and ce.starts_on <= p_on_date
     and (ce.ends_on is null or ce.ends_on >= p_on_date)
    where cs.id = p_class_subject_id
      and cs.is_active
      and c.is_active
      and s.is_active
      and (
        auth.uid() is null
        or cs.school_id = public.current_school_id()
      )
      and not exists (
        select 1
        from public.subject_exclusions se
        where se.school_id = cs.school_id
          and se.class_subject_id = cs.id
          and se.student_id = p_student_id
          and se.starts_on <= p_on_date
          and (se.ends_on is null or se.ends_on >= p_on_date)
      )
  )
$$;

create function public.teacher_can_teach_context(
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

create function public.create_subject_group(
  p_class_subject_id uuid,
  p_name_en text,
  p_name_ar text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid;
  new_group_id uuid;
begin
  if p_class_subject_id is null or nullif(trim(p_name_en), '') is null then
    raise exception 'class subject and English group name are required' using errcode = '22023';
  end if;

  select cs.school_id
    into target_school_id
  from public.class_subjects cs
  join public.classes c
    on c.school_id = cs.school_id
   and c.id = cs.class_id
  where cs.id = p_class_subject_id
    and cs.is_active
    and c.is_active
  for update of cs;

  if target_school_id is null then
    raise exception 'active class subject not found' using errcode = 'P0002';
  end if;

  if auth.uid() is not null
     and (
       target_school_id is distinct from public.current_school_id()
       or not public.is_admin()
     ) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  insert into public.subject_groups (
    school_id,
    class_subject_id,
    name_en,
    name_ar
  ) values (
    target_school_id,
    p_class_subject_id,
    trim(p_name_en),
    nullif(trim(p_name_ar), '')
  )
  returning id into new_group_id;

  update public.class_subjects cs
  set default_group_id = new_group_id
  where cs.school_id = target_school_id
    and cs.id = p_class_subject_id
    and cs.default_group_id is null;

  return new_group_id;
end;
$$;

revoke all on function public.student_participates_in_class_subject(uuid, uuid, date) from public;
revoke execute on function public.student_participates_in_class_subject(uuid, uuid, date) from anon;
grant execute on function public.student_participates_in_class_subject(uuid, uuid, date) to authenticated;

revoke all on function public.teacher_can_teach_context(uuid, uuid, uuid, date) from public;
revoke execute on function public.teacher_can_teach_context(uuid, uuid, uuid, date) from anon;
grant execute on function public.teacher_can_teach_context(uuid, uuid, uuid, date) to authenticated;

revoke all on function public.create_subject_group(uuid, text, text) from public;
revoke execute on function public.create_subject_group(uuid, text, text) from anon;
grant execute on function public.create_subject_group(uuid, text, text) to authenticated;
