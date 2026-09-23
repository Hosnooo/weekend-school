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
  -- Structural context validity belongs to the composite foreign key. Do not mask
  -- its 23503 result with an authorization error for a mismatched Group.
  if new.subject_group_id is not null and not exists (
    select 1
    from public.subject_groups sg
    where sg.school_id = new.school_id
      and sg.class_subject_id = new.class_subject_id
      and sg.id = new.subject_group_id
  ) then
    return new;
  end if;

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

create function public.get_weekly_submission_roster(
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_on_date date
)
returns table (
  student_id uuid,
  first_name_en text,
  last_name_en text,
  first_name_ar text,
  last_name_ar text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();
begin
  if target_school_id is null
    or target_profile_id is null
    or not public.teacher_can_teach_context(
      target_profile_id,
      p_class_subject_id,
      p_subject_group_id,
      p_on_date
    )
  then
    raise exception 'assigned teaching context required' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.first_name_en,
    s.last_name_en,
    s.first_name_ar,
    s.last_name_ar
  from public.students s
  where s.school_id = target_school_id
    and s.is_active
    and public.student_participates_in_class_subject(
      s.id,
      p_class_subject_id,
      p_on_date
    )
    and (
      p_subject_group_id is null
      or exists (
        select 1
        from public.subject_group_memberships sgm
        join public.subject_groups sg
          on sg.school_id = sgm.school_id
         and sg.class_subject_id = sgm.class_subject_id
         and sg.id = sgm.subject_group_id
        where sgm.school_id = target_school_id
          and sgm.class_subject_id = p_class_subject_id
          and sgm.subject_group_id = p_subject_group_id
          and sgm.student_id = s.id
          and sgm.starts_on <= p_on_date
          and (sgm.ends_on is null or sgm.ends_on >= p_on_date)
          and sg.is_active
      )
    )
  order by s.last_name_en, s.first_name_en, s.id;
end;
$$;

revoke all on function public.get_weekly_submission_roster(uuid, uuid, date) from public;
revoke execute on function public.get_weekly_submission_roster(uuid, uuid, date) from anon;
grant execute on function public.get_weekly_submission_roster(uuid, uuid, date) to authenticated;

create function public.save_weekly_submission(
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
  target_profile_id uuid := public.current_profile_id();
  target_submission_id uuid := p_submission_id;
  target_status public.session_status;
  roster_count integer;
  attendance_count integer;
begin
  if target_school_id is null
    or target_profile_id is null
    or not public.teacher_can_teach_context(
      target_profile_id,
      p_class_subject_id,
      p_subject_group_id,
      p_week_start
    )
  then
    raise exception 'assigned teaching context required' using errcode = '42501';
  end if;

  if target_submission_id is null then
    insert into public.weekly_submissions (
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_profile_id,
      week_start
    ) values (
      target_school_id,
      p_class_subject_id,
      p_subject_group_id,
      target_profile_id,
      p_week_start
    )
    on conflict on constraint weekly_submissions_one_teacher_context_week do nothing
    returning id into target_submission_id;

    if target_submission_id is null then
      select ws.id into target_submission_id
      from public.weekly_submissions ws
      where ws.school_id = target_school_id
        and ws.class_subject_id = p_class_subject_id
        and ws.subject_group_id is not distinct from p_subject_group_id
        and ws.teacher_profile_id = target_profile_id
        and ws.week_start = p_week_start;
    end if;
  end if;

  select ws.status into target_status
  from public.weekly_submissions ws
  where ws.school_id = target_school_id
    and ws.id = target_submission_id
    and ws.class_subject_id = p_class_subject_id
    and ws.subject_group_id is not distinct from p_subject_group_id
    and ws.teacher_profile_id = target_profile_id
    and ws.week_start = p_week_start
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
      select 1
      from public.get_weekly_submission_roster(
        p_class_subject_id,
        p_subject_group_id,
        p_week_start
      ) roster
      where roster.student_id = item.student_id
    )
  ) then
    raise exception 'attendance student is outside the weekly roster' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb))
      as item(student_id uuid, performance_override public.performance_level, comment_en text, comment_ar text)
    where not exists (
      select 1
      from public.get_weekly_submission_roster(
        p_class_subject_id,
        p_subject_group_id,
        p_week_start
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
    school_id,
    submission_id,
    student_id,
    attendance_status
  )
  select
    target_school_id,
    target_submission_id,
    item.student_id,
    item.status
  from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb))
    as item(student_id uuid, status public.attendance_status);

  update public.weekly_submission_students wss
  set performance_override = item.performance_override,
      comment_en = nullif(trim(item.comment_en), ''),
      comment_ar = nullif(trim(item.comment_ar), '')
  from jsonb_to_recordset(coalesce(p_exceptions, '[]'::jsonb))
    as item(student_id uuid, performance_override public.performance_level, comment_en text, comment_ar text)
  where wss.school_id = target_school_id
    and wss.submission_id = target_submission_id
    and wss.student_id = item.student_id
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
      p_class_subject_id,
      p_subject_group_id,
      p_week_start
    );

    select count(distinct wss.student_id) into attendance_count
    from public.weekly_submission_students wss
    where wss.school_id = target_school_id
      and wss.submission_id = target_submission_id;

    if attendance_count <> roster_count then
      raise exception 'complete attendance is required for submission' using errcode = '23514';
    end if;

    update public.weekly_submissions
    set status = 'SUBMITTED',
        submitted_at = now()
    where school_id = target_school_id
      and id = target_submission_id;
  end if;

  return target_submission_id;
end;
$$;

revoke all on function public.save_weekly_submission(uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean) from public;
revoke execute on function public.save_weekly_submission(uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean) from anon;
grant execute on function public.save_weekly_submission(uuid, uuid, uuid, date, text, text, public.performance_level, jsonb, jsonb, boolean) to authenticated;
