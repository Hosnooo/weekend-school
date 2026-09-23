-- Independent teacher-authored weekly submissions for Class -> Subject -> optional Group contexts.
-- This is additive: legacy sessions remain readable until the application routes are migrated.

create table public.weekly_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_subject_id uuid not null,
  subject_group_id uuid,
  teacher_profile_id uuid not null,
  week_start date not null,
  status public.session_status not null default 'DRAFT',
  progress_en text,
  progress_ar text,
  default_performance public.performance_level,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  constraint weekly_submissions_class_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict,
  constraint weekly_submissions_group_context_fk
    foreign key (school_id, class_subject_id, subject_group_id)
    references public.subject_groups(school_id, class_subject_id, id) on delete restrict,
  constraint weekly_submissions_teacher_school_fk
    foreign key (school_id, teacher_profile_id)
    references public.profiles(school_id, id) on delete restrict,
  constraint weekly_submissions_status_timestamp_check check (
    (status = 'DRAFT' and submitted_at is null)
    or (status = 'SUBMITTED' and submitted_at is not null)
  ),
  constraint weekly_submissions_one_teacher_context_week
    unique nulls not distinct (
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_profile_id,
      week_start
    )
);

create table public.weekly_submission_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  submission_id uuid not null,
  student_id uuid not null,
  attendance_status public.attendance_status not null,
  performance_override public.performance_level,
  comment_en text,
  comment_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  constraint weekly_submission_students_submission_school_fk
    foreign key (school_id, submission_id)
    references public.weekly_submissions(school_id, id) on delete cascade,
  constraint weekly_submission_students_student_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  constraint weekly_submission_students_one_student_per_submission
    unique (school_id, submission_id, student_id),
  constraint weekly_submission_students_attendance_check
    check (attendance_status in ('PRESENT', 'ABSENT'))
);

create index weekly_submissions_teacher_week_idx
  on public.weekly_submissions (school_id, teacher_profile_id, week_start desc);
create index weekly_submissions_context_week_idx
  on public.weekly_submissions (school_id, class_subject_id, subject_group_id, week_start desc);
create index weekly_submission_students_submission_idx
  on public.weekly_submission_students (school_id, submission_id, student_id);

create trigger weekly_submissions_set_updated_at
before update on public.weekly_submissions
for each row execute function public.set_updated_at();

create trigger weekly_submission_students_set_updated_at
before update on public.weekly_submission_students
for each row execute function public.set_updated_at();

create function public.validate_weekly_submission_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.teacher_can_teach_context(
    new.teacher_profile_id,
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
before insert or update of school_id, class_subject_id, subject_group_id, teacher_profile_id, week_start
on public.weekly_submissions
for each row execute function public.validate_weekly_submission_context();

create function public.protect_submitted_weekly_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'SUBMITTED' then
    raise exception 'submitted weekly submissions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.protect_submitted_weekly_submission() from public;
revoke execute on function public.protect_submitted_weekly_submission() from anon;
revoke execute on function public.protect_submitted_weekly_submission() from authenticated;

create trigger weekly_submissions_protect_submitted
before update or delete on public.weekly_submissions
for each row execute function public.protect_submitted_weekly_submission();

create function public.protect_submitted_weekly_submission_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid;
  target_submission_id uuid;
  target_status public.session_status;
begin
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;
  target_submission_id := case when tg_op = 'DELETE' then old.submission_id else new.submission_id end;

  select ws.status into target_status
  from public.weekly_submissions ws
  where ws.school_id = target_school_id
    and ws.id = target_submission_id;

  if target_status = 'SUBMITTED' then
    raise exception 'submitted weekly submission students are immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.protect_submitted_weekly_submission_student() from public;
revoke execute on function public.protect_submitted_weekly_submission_student() from anon;
revoke execute on function public.protect_submitted_weekly_submission_student() from authenticated;

create trigger weekly_submission_students_protect_submitted
before insert or update or delete on public.weekly_submission_students
for each row execute function public.protect_submitted_weekly_submission_student();

alter table public.weekly_submissions enable row level security;
alter table public.weekly_submission_students enable row level security;
alter table public.weekly_submissions force row level security;
alter table public.weekly_submission_students force row level security;

create policy weekly_submissions_admin_all on public.weekly_submissions
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy weekly_submissions_teacher_select on public.weekly_submissions
for select to authenticated
using (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and public.teacher_can_teach_context(
    public.current_profile_id(),
    class_subject_id,
    subject_group_id,
    week_start
  )
);

create policy weekly_submissions_teacher_insert on public.weekly_submissions
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and public.teacher_can_teach_context(
    public.current_profile_id(),
    class_subject_id,
    subject_group_id,
    week_start
  )
);

create policy weekly_submissions_teacher_update on public.weekly_submissions
for update to authenticated
using (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and status = 'DRAFT'
)
with check (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and public.teacher_can_teach_context(
    public.current_profile_id(),
    class_subject_id,
    subject_group_id,
    week_start
  )
);

create policy weekly_submissions_teacher_delete on public.weekly_submissions
for delete to authenticated
using (
  school_id = public.current_school_id()
  and teacher_profile_id = public.current_profile_id()
  and status = 'DRAFT'
);

create policy weekly_submission_students_admin_all on public.weekly_submission_students
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy weekly_submission_students_teacher_select on public.weekly_submission_students
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
  )
);

create policy weekly_submission_students_teacher_insert on public.weekly_submission_students
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
      and ws.status = 'DRAFT'
      and public.teacher_can_teach_context(
        public.current_profile_id(),
        ws.class_subject_id,
        ws.subject_group_id,
        ws.week_start
      )
      and public.student_participates_in_class_subject(
        weekly_submission_students.student_id,
        ws.class_subject_id,
        ws.week_start
      )
      and (
        ws.subject_group_id is null
        or exists (
          select 1
          from public.subject_group_memberships sgm
          where sgm.school_id = ws.school_id
            and sgm.class_subject_id = ws.class_subject_id
            and sgm.subject_group_id = ws.subject_group_id
            and sgm.student_id = weekly_submission_students.student_id
            and sgm.starts_on <= ws.week_start
            and (sgm.ends_on is null or sgm.ends_on >= ws.week_start)
        )
      )
  )
);

create policy weekly_submission_students_teacher_update on public.weekly_submission_students
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
      and ws.status = 'DRAFT'
  )
)
with check (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
      and ws.status = 'DRAFT'
  )
);

create policy weekly_submission_students_teacher_delete on public.weekly_submission_students
for delete to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions ws
    where ws.school_id = weekly_submission_students.school_id
      and ws.id = weekly_submission_students.submission_id
      and ws.teacher_profile_id = public.current_profile_id()
      and ws.status = 'DRAFT'
  )
);
