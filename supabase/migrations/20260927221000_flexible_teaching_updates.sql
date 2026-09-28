-- Flexible Teaching Updates.
--
-- Keep weekly_submissions as the physical source table so historical IDs and
-- report_section_sources.weekly_submission_id remain stable.
--
-- DRAFT is the physical OPEN state during this compatibility phase.
-- Valid lifecycle states are therefore DRAFT (OPEN), SUBMITTED, DISMISSED.

-------------------------------------------------------------------------------
-- New Teacher assignment writes are Subject-only.
--
-- Historical Group-scoped rows remain intact and may still have their dates
-- maintained. Only a new Group-scoped assignment, or changing an existing
-- assignment into a new Group scope, is rejected.
-------------------------------------------------------------------------------

create or replace function public.enforce_subject_only_assignment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Enforce the forward-only Subject assignment contract at the application
  -- boundary. Privileged SQL must remain able to restore, migrate, and test
  -- historical Group-scoped assignment rows even if a JWT GUC remains set.
  if current_user = 'authenticated'
    and new.subject_group_id is not null
    and (
      tg_op = 'INSERT'
      or old.subject_group_id is distinct from new.subject_group_id
    )
  then
    raise exception 'new Teacher assignments must be Subject-only'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists
  teaching_assignments_subject_only_new_writes
on public.teaching_assignments;

create trigger teaching_assignments_subject_only_new_writes
before insert or update of subject_group_id
on public.teaching_assignments
for each row
execute function public.enforce_subject_only_assignment_write();

-------------------------------------------------------------------------------
-- Admin request-set identity
-------------------------------------------------------------------------------

create table public.teaching_update_request_sets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null
    references public.schools(id) on delete restrict,
  class_subject_id uuid not null,
  coverage_kind text not null,
  period_start date not null,
  period_end date not null,
  requested_by_profile_id uuid not null,
  admin_note text,
  created_at timestamptz not null default now(),

  unique (school_id, id),

  constraint teaching_update_request_sets_class_subject_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id)
    on delete restrict,

  constraint teaching_update_request_sets_requester_fk
    foreign key (school_id, requested_by_profile_id)
    references public.profiles(school_id, id)
    on delete restrict,

  constraint teaching_update_request_sets_coverage_kind_check
    check (coverage_kind in ('RANGE', 'DATES')),

  constraint teaching_update_request_sets_period_check
    check (period_end >= period_start)
);

create index teaching_update_request_sets_context_idx
  on public.teaching_update_request_sets (
    school_id,
    class_subject_id,
    period_start,
    period_end
  );

-------------------------------------------------------------------------------
-- Evolve weekly_submissions into the Teaching Update source record.
-------------------------------------------------------------------------------

alter table public.weekly_submissions
  alter column teacher_id drop not null;

alter table public.weekly_submissions
  add column coverage_kind text not null default 'RANGE',
  add column period_start date,
  add column period_end date,
  add column request_set_id uuid,
  add column created_by_profile_id uuid,
  add column requested_by_profile_id uuid,
  add column admin_note text,
  add column dismissed_at timestamptz,
  add column dismissed_by_profile_id uuid,
  add column dismissal_reason text,
  add column version integer not null default 1;

-- Historical weekly rows become RANGE: week_start through week_start + 6.
update public.weekly_submissions
set
  coverage_kind = 'RANGE',
  period_start = week_start,
  period_end = week_start + 6
where period_start is null
   or period_end is null;

-- Best-effort attribution of historical Teacher-authored rows to an existing
-- account Profile. Historical rows without such a link remain valid.
update public.weekly_submissions submission
set created_by_profile_id = (
  select account_link.profile_id
  from public.teacher_accounts account_link
  where account_link.school_id = submission.school_id
    and account_link.teacher_id = submission.teacher_id
  order by account_link.profile_id
  limit 1
)
where submission.created_by_profile_id is null
  and submission.teacher_id is not null;

alter table public.weekly_submissions
  alter column period_start set not null,
  alter column period_end set not null;

alter table public.weekly_submissions
  add constraint weekly_submissions_request_set_fk
    foreign key (school_id, request_set_id)
    references public.teaching_update_request_sets(school_id, id)
    on delete restrict,

  add constraint weekly_submissions_creator_profile_fk
    foreign key (school_id, created_by_profile_id)
    references public.profiles(school_id, id)
    on delete restrict,

  add constraint weekly_submissions_requester_profile_fk
    foreign key (school_id, requested_by_profile_id)
    references public.profiles(school_id, id)
    on delete restrict,

  add constraint weekly_submissions_dismissed_by_profile_fk
    foreign key (school_id, dismissed_by_profile_id)
    references public.profiles(school_id, id)
    on delete restrict,

  add constraint weekly_submissions_coverage_kind_check
    check (coverage_kind in ('RANGE', 'DATES')),

  add constraint weekly_submissions_period_check
    check (period_end >= period_start),

  add constraint weekly_submissions_version_check
    check (version > 0);

-- Legitimate overlapping Teaching Updates are allowed.
alter table public.weekly_submissions
  drop constraint if exists
    weekly_submissions_one_teacher_context_week;

-- Replace the legacy DRAFT/SUBMITTED-only lifecycle constraint.
alter table public.weekly_submissions
  drop constraint if exists
    weekly_submissions_status_timestamp_check;

alter table public.weekly_submissions
  add constraint weekly_submissions_status_timestamp_check
  check (
    (
      status = 'DRAFT'
      and submitted_at is null
      and dismissed_at is null
      and dismissed_by_profile_id is null
    )
    or
    (
      status = 'SUBMITTED'
      and submitted_at is not null
      and dismissed_at is null
      and dismissed_by_profile_id is null
    )
    or
    (
      status = 'DISMISSED'
      and submitted_at is null
      and dismissed_at is not null
      and dismissed_by_profile_id is not null
    )
  );

create index weekly_submissions_period_idx
  on public.weekly_submissions (
    school_id,
    class_subject_id,
    subject_group_id,
    period_start,
    period_end
  );

create index weekly_submissions_request_set_idx
  on public.weekly_submissions (
    school_id,
    request_set_id,
    status
  )
  where request_set_id is not null;

-------------------------------------------------------------------------------
-- Exact non-consecutive coverage dates
-------------------------------------------------------------------------------

create table public.weekly_submission_dates (
  school_id uuid not null,
  submission_id uuid not null,
  covered_on date not null,
  created_at timestamptz not null default now(),

  primary key (school_id, submission_id, covered_on),

  constraint weekly_submission_dates_submission_fk
    foreign key (school_id, submission_id)
    references public.weekly_submissions(school_id, id)
    on delete cascade
);

create index weekly_submission_dates_covered_on_idx
  on public.weekly_submission_dates (
    school_id,
    covered_on,
    submission_id
  );

-------------------------------------------------------------------------------
-- Teaching Update structural/context validation
-------------------------------------------------------------------------------

create or replace function public.validate_weekly_submission_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Keep old direct weekly inserts compatible.
  if new.coverage_kind is null then
    new.coverage_kind := 'RANGE';
  end if;

  new.coverage_kind := upper(trim(new.coverage_kind));

  if new.period_start is null then
    new.period_start := new.week_start;
  end if;

  if new.period_end is null then
    new.period_end := new.week_start + 6;
  end if;

  if new.week_start is null then
    new.week_start := new.period_start;
  end if;

  if new.coverage_kind not in ('RANGE', 'DATES') then
    raise exception 'invalid Teaching Update coverage kind'
      using errcode = '23514';
  end if;

  if new.period_start is null
    or new.period_end is null
    or new.period_end < new.period_start
  then
    raise exception 'invalid Teaching Update coverage period'
      using errcode = '23514';
  end if;

  if new.version is null or new.version < 1 then
    new.version := 1;
  end if;

  if new.created_by_profile_id is null
    and auth.uid() is not null
  then
    new.created_by_profile_id := public.current_profile_id();
  end if;

  -- Structural Group validity still belongs to the composite FK so a wrong
  -- Class Subject / Group pairing retains its normal FK error.
  if new.subject_group_id is not null
    and not exists (
      select 1
      from public.subject_groups subject_group
      where subject_group.school_id = new.school_id
        and subject_group.class_subject_id =
          new.class_subject_id
        and subject_group.id = new.subject_group_id
    )
  then
    return new;
  end if;

  -- An unclaimed row is valid only when it is an Admin-request item.
  if new.teacher_id is null then
    if new.request_set_id is null then
      raise exception 'Teacher identity or Admin request is required'
        using errcode = '23514';
    end if;

    if auth.uid() is not null and not public.is_admin() then
      raise exception 'administrator access required for unclaimed request'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if not public.teacher_can_teach_period_context(
    new.teacher_id,
    new.class_subject_id,
    new.subject_group_id,
    new.period_start,
    new.period_end
  ) then
    raise exception 'teacher is not assigned to this teaching context'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists
  weekly_submissions_validate_context
on public.weekly_submissions;

create trigger weekly_submissions_validate_context
before insert or update of
  school_id,
  class_subject_id,
  subject_group_id,
  teacher_id,
  week_start,
  coverage_kind,
  period_start,
  period_end,
  request_set_id,
  created_by_profile_id
on public.weekly_submissions
for each row
execute function public.validate_weekly_submission_context();

-------------------------------------------------------------------------------
-- Preserve finalized history protections and extend them to DISMISSED.
-------------------------------------------------------------------------------

create or replace function public.protect_submitted_weekly_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting(
      'app.permanent_delete_managed_entity',
      true
    ) = 'on'
    and public.is_admin()
  then
    return old;
  end if;

  if old.status = 'SUBMITTED' then
    if tg_op = 'UPDATE'
      and new.status = 'DRAFT'
      and new.submitted_at is null
      and coalesce(
        current_setting(
          'app.reopening_weekly_submission',
          true
        ),
        ''
      ) = 'on'
    then
      return new;
    end if;

    raise exception 'submitted weekly submissions are immutable';
  end if;

  if old.status = 'DISMISSED' then
    raise exception 'dismissed Teaching Updates are immutable';
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

create or replace function
public.protect_submitted_weekly_submission_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid;
  target_submission_id uuid;
  target_student_id uuid;
  target_status public.session_status;
begin
  target_school_id :=
    case when tg_op = 'DELETE'
      then old.school_id else new.school_id
    end;

  target_submission_id :=
    case when tg_op = 'DELETE'
      then old.submission_id else new.submission_id
    end;

  target_student_id :=
    case when tg_op = 'DELETE'
      then old.student_id else new.student_id
    end;

  if tg_op = 'DELETE'
    and (
      current_setting(
        'app.permanent_delete_managed_entity',
        true
      ) = 'on'
      or current_setting(
        'app.permanent_delete_student_id',
        true
      ) = target_student_id::text
    )
    and public.is_admin()
  then
    return old;
  end if;

  select submission.status
  into target_status
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = target_submission_id;

  if target_status in ('SUBMITTED', 'DISMISSED') then
    raise exception
      'completed Teaching Update students are immutable';
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

create or replace function
public.protect_weekly_submission_date_change()
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
  target_school_id :=
    case when tg_op = 'DELETE'
      then old.school_id else new.school_id
    end;

  target_submission_id :=
    case when tg_op = 'DELETE'
      then old.submission_id else new.submission_id
    end;

  select submission.status
  into target_status
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = target_submission_id;

  if target_status in ('SUBMITTED', 'DISMISSED') then
    raise exception
      'completed Teaching Update coverage is immutable';
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

create trigger weekly_submission_dates_protect_completed
before insert or update or delete
on public.weekly_submission_dates
for each row
execute function public.protect_weekly_submission_date_change();

-------------------------------------------------------------------------------
-- Admin request creation
-------------------------------------------------------------------------------

create or replace function public.request_teaching_update(
  p_class_subject_id uuid,
  p_coverage_kind text,
  p_period_start date,
  p_period_end date,
  p_dates date[],
  p_admin_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();

  normalized_kind text := upper(trim(p_coverage_kind));
  normalized_dates date[];

  coverage_start date;
  coverage_end date;

  new_request_set_id uuid;
  new_submission_id uuid;

  target_group_id uuid;
  group_count integer := 0;
begin
  if target_school_id is null
    or target_profile_id is null
    or not public.is_admin()
  then
    raise exception 'administrator access required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.class_subjects class_subject
    join public.classes class_row
      on class_row.school_id = class_subject.school_id
     and class_row.id = class_subject.class_id
    join public.subjects subject
      on subject.school_id = class_subject.school_id
     and subject.id = class_subject.subject_id
    where class_subject.school_id = target_school_id
      and class_subject.id = p_class_subject_id
      and class_subject.is_active
      and class_row.is_active
      and subject.is_active
  ) then
    raise exception 'active Class Subject not found'
      using errcode = 'P0002';
  end if;

  if normalized_kind = 'RANGE' then
    if p_period_start is null
      or p_period_end is null
      or p_period_end < p_period_start
    then
      raise exception 'valid RANGE coverage is required'
        using errcode = '23514';
    end if;

    coverage_start := p_period_start;
    coverage_end := p_period_end;
    normalized_dates := null;

  elsif normalized_kind = 'DATES' then
    select
      array_agg(distinct covered_on order by covered_on),
      min(covered_on),
      max(covered_on)
    into
      normalized_dates,
      coverage_start,
      coverage_end
    from unnest(
      coalesce(p_dates, '{}'::date[])
    ) covered_on;

    if normalized_dates is null
      or cardinality(normalized_dates) = 0
    then
      raise exception 'at least one covered date is required'
        using errcode = '23514';
    end if;

  else
    raise exception 'invalid Teaching Update coverage kind'
      using errcode = '23514';
  end if;

  insert into public.teaching_update_request_sets (
    school_id,
    class_subject_id,
    coverage_kind,
    period_start,
    period_end,
    requested_by_profile_id,
    admin_note
  )
  values (
    target_school_id,
    p_class_subject_id,
    normalized_kind,
    coverage_start,
    coverage_end,
    target_profile_id,
    nullif(trim(p_admin_note), '')
  )
  returning id into new_request_set_id;

  for target_group_id in
    select subject_group.id
    from public.subject_groups subject_group
    where subject_group.school_id = target_school_id
      and subject_group.class_subject_id =
        p_class_subject_id
      and subject_group.is_active
    order by subject_group.id
  loop
    group_count := group_count + 1;

    insert into public.weekly_submissions (
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_id,
      week_start,
      coverage_kind,
      period_start,
      period_end,
      request_set_id,
      created_by_profile_id,
      requested_by_profile_id,
      admin_note
    )
    values (
      target_school_id,
      p_class_subject_id,
      target_group_id,
      null,
      coverage_start,
      normalized_kind,
      coverage_start,
      coverage_end,
      new_request_set_id,
      target_profile_id,
      target_profile_id,
      nullif(trim(p_admin_note), '')
    )
    returning id into new_submission_id;

    if normalized_kind = 'DATES' then
      insert into public.weekly_submission_dates (
        school_id,
        submission_id,
        covered_on
      )
      select
        target_school_id,
        new_submission_id,
        covered_on
      from unnest(normalized_dates) covered_on;
    end if;
  end loop;

  -- A Subject with no active Groups gets one whole-Subject request item.
  if group_count = 0 then
    insert into public.weekly_submissions (
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_id,
      week_start,
      coverage_kind,
      period_start,
      period_end,
      request_set_id,
      created_by_profile_id,
      requested_by_profile_id,
      admin_note
    )
    values (
      target_school_id,
      p_class_subject_id,
      null,
      null,
      coverage_start,
      normalized_kind,
      coverage_start,
      coverage_end,
      new_request_set_id,
      target_profile_id,
      target_profile_id,
      nullif(trim(p_admin_note), '')
    )
    returning id into new_submission_id;

    if normalized_kind = 'DATES' then
      insert into public.weekly_submission_dates (
        school_id,
        submission_id,
        covered_on
      )
      select
        target_school_id,
        new_submission_id,
        covered_on
      from unnest(normalized_dates) covered_on;
    end if;
  end if;

  return new_request_set_id;
end;
$$;

-------------------------------------------------------------------------------
-- Overlap warning lookup
--
-- Overlap is informational only. No uniqueness constraint is introduced.
-------------------------------------------------------------------------------

create or replace function
public.find_overlapping_teaching_updates(
  p_class_subject_id uuid,
  p_subject_group_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  id uuid,
  subject_group_id uuid,
  coverage_kind text,
  period_start date,
  period_end date,
  status public.session_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
begin
  if target_school_id is null then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  if p_period_start is null
    or p_period_end is null
    or p_period_end < p_period_start
  then
    raise exception 'valid overlap period is required'
      using errcode = '23514';
  end if;

  if not public.is_admin()
    and not exists (
      select 1
      from public.current_teacher_ids() teacher_id
      where public.teacher_can_teach_period_context(
        teacher_id,
        p_class_subject_id,
        p_subject_group_id,
        p_period_start,
        p_period_end
      )
    )
  then
    raise exception 'Teaching Update access required'
      using errcode = '42501';
  end if;

  return query
  select
    submission.id,
    submission.subject_group_id,
    submission.coverage_kind,
    submission.period_start,
    submission.period_end,
    submission.status
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.class_subject_id = p_class_subject_id
    and submission.status <> 'DISMISSED'
    and submission.period_start <= p_period_end
    and submission.period_end >= p_period_start
    and (
      p_subject_group_id is null
      or submission.subject_group_id is null
      or submission.subject_group_id = p_subject_group_id
    )
  order by
    submission.period_start,
    submission.created_at,
    submission.id;
end;
$$;

-------------------------------------------------------------------------------
-- Atomic first-successful submission
-------------------------------------------------------------------------------

create or replace function public.submit_teaching_update(
  p_submission_id uuid,
  p_teacher_id uuid,
  p_expected_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_submission public.weekly_submissions%rowtype;
  school_today date;
begin
  if target_school_id is null
    or p_teacher_id not in (
      select public.current_teacher_ids()
    )
  then
    raise exception 'Teacher access required'
      using errcode = '42501';
  end if;

  select submission.*
  into target_submission
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Teaching Update not found'
      using errcode = 'P0002';
  end if;

  if target_submission.status <> 'DRAFT' then
    raise exception 'Teaching Update is already completed'
      using errcode = '55000';
  end if;

  if target_submission.version <> p_expected_version then
    raise exception 'Teaching Update version conflict'
      using errcode = '40001';
  end if;

  if target_submission.teacher_id is not null
    and target_submission.teacher_id <> p_teacher_id
  then
    raise exception 'Teaching Update already belongs to another Teacher'
      using errcode = '42501';
  end if;

  if not public.teacher_can_teach_period_context(
    p_teacher_id,
    target_submission.class_subject_id,
    target_submission.subject_group_id,
    target_submission.period_start,
    target_submission.period_end
  ) then
    raise exception 'assigned Class Subject required'
      using errcode = '42501';
  end if;

  select
    (now() at time zone school.timezone)::date
  into school_today
  from public.schools school
  where school.id = target_school_id;

  if target_submission.period_end > school_today then
    raise exception
      'Teaching Update cannot be submitted before all covered dates occur'
      using errcode = '23514';
  end if;

  update public.weekly_submissions
  set
    teacher_id = p_teacher_id,
    status = 'SUBMITTED',
    submitted_at = now(),
    version = version + 1
  where school_id = target_school_id
    and id = p_submission_id
    and status = 'DRAFT'
    and version = p_expected_version;

  if not found then
    raise exception 'Teaching Update submission conflict'
      using errcode = '40001';
  end if;

  return true;
end;
$$;

-------------------------------------------------------------------------------
-- Audited dismissal
-------------------------------------------------------------------------------

create or replace function public.dismiss_teaching_update(
  p_submission_id uuid,
  p_reason text,
  p_expected_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_profile_id uuid := public.current_profile_id();
  target_submission public.weekly_submissions%rowtype;
  actor_is_admin boolean;
  actor_is_teacher boolean;
begin
  if target_school_id is null
    or target_profile_id is null
  then
    raise exception 'authenticated school context required'
      using errcode = '42501';
  end if;

  select submission.*
  into target_submission
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Teaching Update not found'
      using errcode = 'P0002';
  end if;

  if target_submission.status <> 'DRAFT' then
    raise exception 'only OPEN Teaching Updates may be dismissed'
      using errcode = '55000';
  end if;

  if target_submission.version <> p_expected_version then
    raise exception 'Teaching Update version conflict'
      using errcode = '40001';
  end if;

  actor_is_admin := public.is_admin();

  actor_is_teacher := exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_period_context(
      teacher_id,
      target_submission.class_subject_id,
      target_submission.subject_group_id,
      target_submission.period_start,
      target_submission.period_end
    )
  );

  if not actor_is_admin and not actor_is_teacher then
    raise exception 'Teaching Update access required'
      using errcode = '42501';
  end if;

  -- Teacher dismissal of an Admin request always requires a reason.
  if not actor_is_admin
    and target_submission.request_set_id is not null
    and nullif(trim(p_reason), '') is null
  then
    raise exception
      'dismissal reason is required for an Admin-requested Teaching Update'
      using errcode = '23514';
  end if;

  update public.weekly_submissions
  set
    status = 'DISMISSED',
    submitted_at = null,
    dismissed_at = now(),
    dismissed_by_profile_id = target_profile_id,
    dismissal_reason = nullif(trim(p_reason), ''),
    version = version + 1
  where school_id = target_school_id
    and id = p_submission_id
    and status = 'DRAFT'
    and version = p_expected_version;

  if not found then
    raise exception 'Teaching Update dismissal conflict'
      using errcode = '40001';
  end if;

  return true;
end;
$$;

-------------------------------------------------------------------------------
-- RLS: request sets
-------------------------------------------------------------------------------

alter table public.teaching_update_request_sets
  enable row level security;

alter table public.teaching_update_request_sets
  force row level security;

create policy teaching_update_request_sets_admin_all
on public.teaching_update_request_sets
for all to authenticated
using (
  school_id = public.current_school_id()
  and public.is_admin()
)
with check (
  school_id = public.current_school_id()
  and public.is_admin()
);

create policy teaching_update_request_sets_teacher_select
on public.teaching_update_request_sets
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.current_teacher_ids() teacher_id
    where public.teacher_can_teach_period_context(
      teacher_id,
      class_subject_id,
      null,
      period_start,
      period_end
    )
  )
);

-------------------------------------------------------------------------------
-- RLS: evolved Teaching Updates
-------------------------------------------------------------------------------

drop policy if exists
  weekly_submissions_teacher_select
on public.weekly_submissions;

drop policy if exists
  weekly_submissions_teacher_insert
on public.weekly_submissions;

drop policy if exists
  weekly_submissions_teacher_update
on public.weekly_submissions;

drop policy if exists
  weekly_submissions_teacher_delete
on public.weekly_submissions;

create policy weekly_submissions_teacher_select
on public.weekly_submissions
for select to authenticated
using (
  school_id = public.current_school_id()
  and (
    (
      request_set_id is null
      and teacher_id in (
        select public.current_teacher_ids()
      )
    )
    or
    (
      request_set_id is not null
      and exists (
        select 1
        from public.current_teacher_ids() current_teacher_id
        where public.teacher_can_teach_period_context(
          current_teacher_id,
          class_subject_id,
          subject_group_id,
          period_start,
          period_end
        )
      )
    )
  )
);

-- Teachers may directly create only their own non-request Teaching Updates.
create policy weekly_submissions_teacher_insert
on public.weekly_submissions
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and request_set_id is null
  and teacher_id in (
    select public.current_teacher_ids()
  )
  and public.teacher_can_teach_period_context(
    teacher_id,
    class_subject_id,
    subject_group_id,
    period_start,
    period_end
  )
);

-- OPEN Admin-request items are shared work among assigned Teachers.
create policy weekly_submissions_teacher_update
on public.weekly_submissions
for update to authenticated
using (
  school_id = public.current_school_id()
  and status = 'DRAFT'
  and (
    (
      request_set_id is null
      and teacher_id in (
        select public.current_teacher_ids()
      )
    )
    or
    (
      request_set_id is not null
      and exists (
        select 1
        from public.current_teacher_ids() current_teacher_id
        where public.teacher_can_teach_period_context(
          current_teacher_id,
          class_subject_id,
          subject_group_id,
          period_start,
          period_end
        )
      )
    )
  )
)
with check (
  school_id = public.current_school_id()
  and status = 'DRAFT'
  and (
    (
      request_set_id is null
      and teacher_id in (
        select public.current_teacher_ids()
      )
    )
    or
    (
      request_set_id is not null
      and exists (
        select 1
        from public.current_teacher_ids() current_teacher_id
        where public.teacher_can_teach_period_context(
          current_teacher_id,
          class_subject_id,
          subject_group_id,
          period_start,
          period_end
        )
      )
    )
  )
);

-- Admin-requested items use audited dismissal rather than deletion.
create policy weekly_submissions_teacher_delete
on public.weekly_submissions
for delete to authenticated
using (
  school_id = public.current_school_id()
  and request_set_id is null
  and status = 'DRAFT'
  and teacher_id in (
    select public.current_teacher_ids()
  )
);

-------------------------------------------------------------------------------
-- RLS: exact dates
-------------------------------------------------------------------------------

alter table public.weekly_submission_dates
  enable row level security;

alter table public.weekly_submission_dates
  force row level security;

create policy weekly_submission_dates_admin_all
on public.weekly_submission_dates
for all to authenticated
using (
  school_id = public.current_school_id()
  and public.is_admin()
)
with check (
  school_id = public.current_school_id()
  and public.is_admin()
);

create policy weekly_submission_dates_teacher_select
on public.weekly_submission_dates
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_dates.school_id
      and submission.id =
        weekly_submission_dates.submission_id
      and (
        (
          submission.request_set_id is null
          and submission.teacher_id in (
            select public.current_teacher_ids()
          )
        )
        or
        (
          submission.request_set_id is not null
          and exists (
            select 1
            from public.current_teacher_ids()
              current_teacher_id
            where public.teacher_can_teach_period_context(
              current_teacher_id,
              submission.class_subject_id,
              submission.subject_group_id,
              submission.period_start,
              submission.period_end
            )
          )
        )
      )
  )
);

create policy weekly_submission_dates_teacher_insert
on public.weekly_submission_dates
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_dates.school_id
      and submission.id =
        weekly_submission_dates.submission_id
      and submission.status = 'DRAFT'
      and (
        (
          submission.request_set_id is null
          and submission.teacher_id in (
            select public.current_teacher_ids()
          )
        )
        or
        (
          submission.request_set_id is not null
          and exists (
            select 1
            from public.current_teacher_ids()
              current_teacher_id
            where public.teacher_can_teach_period_context(
              current_teacher_id,
              submission.class_subject_id,
              submission.subject_group_id,
              submission.period_start,
              submission.period_end
            )
          )
        )
      )
  )
);

create policy weekly_submission_dates_teacher_update
on public.weekly_submission_dates
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_dates.school_id
      and submission.id =
        weekly_submission_dates.submission_id
      and submission.status = 'DRAFT'
      and (
        submission.teacher_id in (
          select public.current_teacher_ids()
        )
        or submission.request_set_id is not null
      )
  )
)
with check (
  school_id = public.current_school_id()
);

create policy weekly_submission_dates_teacher_delete
on public.weekly_submission_dates
for delete to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_dates.school_id
      and submission.id =
        weekly_submission_dates.submission_id
      and submission.status = 'DRAFT'
      and (
        submission.teacher_id in (
          select public.current_teacher_ids()
        )
        or submission.request_set_id is not null
      )
  )
);

-------------------------------------------------------------------------------
-- Child Teaching Update rows need the same shared-request access.
-------------------------------------------------------------------------------

drop policy if exists
  weekly_submission_students_teacher_select
on public.weekly_submission_students;

drop policy if exists
  weekly_submission_students_teacher_insert
on public.weekly_submission_students;

drop policy if exists
  weekly_submission_students_teacher_update
on public.weekly_submission_students;

drop policy if exists
  weekly_submission_students_teacher_delete
on public.weekly_submission_students;

create policy weekly_submission_students_teacher_select
on public.weekly_submission_students
for select to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_students.school_id
      and submission.id =
        weekly_submission_students.submission_id
      and (
        submission.teacher_id in (
          select public.current_teacher_ids()
        )
        or (
          submission.request_set_id is not null
          and exists (
            select 1
            from public.current_teacher_ids()
              current_teacher_id
            where public.teacher_can_teach_period_context(
              current_teacher_id,
              submission.class_subject_id,
              submission.subject_group_id,
              submission.period_start,
              submission.period_end
            )
          )
        )
      )
  )
);

create policy weekly_submission_students_teacher_insert
on public.weekly_submission_students
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_students.school_id
      and submission.id =
        weekly_submission_students.submission_id
      and submission.status = 'DRAFT'
      and (
        submission.teacher_id in (
          select public.current_teacher_ids()
        )
        or (
          submission.request_set_id is not null
          and exists (
            select 1
            from public.current_teacher_ids()
              current_teacher_id
            where public.teacher_can_teach_period_context(
              current_teacher_id,
              submission.class_subject_id,
              submission.subject_group_id,
              submission.period_start,
              submission.period_end
            )
          )
        )
      )
      and public.student_participates_in_class_subject(
        weekly_submission_students.student_id,
        submission.class_subject_id,
        submission.period_start
      )
      and (
        submission.subject_group_id is null
        or exists (
          select 1
          from public.subject_group_memberships membership
          where membership.school_id = submission.school_id
            and membership.class_subject_id =
              submission.class_subject_id
            and membership.subject_group_id =
              submission.subject_group_id
            and membership.student_id =
              weekly_submission_students.student_id
            and membership.starts_on <=
              submission.period_end
            and (
              membership.ends_on is null
              or membership.ends_on >=
                submission.period_start
            )
        )
      )
  )
);

create policy weekly_submission_students_teacher_update
on public.weekly_submission_students
for update to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_students.school_id
      and submission.id =
        weekly_submission_students.submission_id
      and submission.status = 'DRAFT'
      and (
        submission.teacher_id in (
          select public.current_teacher_ids()
        )
        or submission.request_set_id is not null
      )
  )
)
with check (
  school_id = public.current_school_id()
);

create policy weekly_submission_students_teacher_delete
on public.weekly_submission_students
for delete to authenticated
using (
  school_id = public.current_school_id()
  and exists (
    select 1
    from public.weekly_submissions submission
    where submission.school_id =
      weekly_submission_students.school_id
      and submission.id =
        weekly_submission_students.submission_id
      and submission.status = 'DRAFT'
      and (
        submission.teacher_id in (
          select public.current_teacher_ids()
        )
        or submission.request_set_id is not null
      )
  )
);

-------------------------------------------------------------------------------
-- Backward-compatible legacy weekly save.
--
-- Remove the old ON CONFLICT dependency on the deleted one-week uniqueness
-- constraint. A null p_submission_id now intentionally creates another update.
-------------------------------------------------------------------------------

create or replace function public.save_weekly_submission(
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
  school_today date;
begin
  if target_school_id is null
    or p_teacher_id not in (
      select public.current_teacher_ids()
    )
    or not public.teacher_can_teach_week_context(
      p_teacher_id,
      p_class_subject_id,
      p_subject_group_id,
      p_week_start
    )
  then
    raise exception 'assigned teaching context required'
      using errcode = '42501';
  end if;

  if target_submission_id is null then
    insert into public.weekly_submissions (
      school_id,
      class_subject_id,
      subject_group_id,
      teacher_id,
      week_start,
      coverage_kind,
      period_start,
      period_end
    )
    values (
      target_school_id,
      p_class_subject_id,
      p_subject_group_id,
      p_teacher_id,
      p_week_start,
      'RANGE',
      p_week_start,
      p_week_start + 6
    )
    returning id into target_submission_id;
  end if;

  select submission.status
  into target_status
  from public.weekly_submissions submission
  where submission.school_id = target_school_id
    and submission.id = target_submission_id
    and submission.class_subject_id =
      p_class_subject_id
    and submission.subject_group_id
      is not distinct from p_subject_group_id
    and submission.teacher_id = p_teacher_id
    and submission.week_start = p_week_start
  for update;

  if target_status is null then
    raise exception 'weekly submission access required'
      using errcode = '42501';
  end if;

  if target_status <> 'DRAFT' then
    raise exception 'completed Teaching Updates are immutable'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(
      coalesce(p_attendance, '[]'::jsonb)
    )
      as item(
        student_id uuid,
        status public.attendance_status
      )
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
    raise exception
      'attendance student is outside the weekly roster'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(
      coalesce(p_exceptions, '[]'::jsonb)
    )
      as item(
        student_id uuid,
        performance_override public.performance_level,
        comment_en text,
        comment_ar text
      )
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
    raise exception
      'exception student is outside the weekly roster'
      using errcode = '42501';
  end if;

  update public.weekly_submissions
  set
    progress_en = nullif(trim(p_progress_en), ''),
    progress_ar = nullif(trim(p_progress_ar), ''),
    default_performance = p_default_performance,
    version = version + 1
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
  from jsonb_to_recordset(
    coalesce(p_attendance, '[]'::jsonb)
  )
    as item(
      student_id uuid,
      status public.attendance_status
    );

  update public.weekly_submission_students student_row
  set
    performance_override =
      item.performance_override,
    comment_en =
      nullif(trim(item.comment_en), ''),
    comment_ar =
      nullif(trim(item.comment_ar), '')
  from jsonb_to_recordset(
    coalesce(p_exceptions, '[]'::jsonb)
  )
    as item(
      student_id uuid,
      performance_override public.performance_level,
      comment_en text,
      comment_ar text
    )
  where student_row.school_id = target_school_id
    and student_row.submission_id =
      target_submission_id
    and student_row.student_id =
      item.student_id
    and (
      item.performance_override is not null
      or nullif(trim(item.comment_en), '') is not null
      or nullif(trim(item.comment_ar), '') is not null
    );

  if p_submit then
    if nullif(trim(p_progress_en), '') is null
      and nullif(trim(p_progress_ar), '') is null
    then
      raise exception 'progress is required for submission'
        using errcode = '23514';
    end if;

    select
      (now() at time zone school.timezone)::date
    into school_today
    from public.schools school
    where school.id = target_school_id;

    if (p_week_start + 6) > school_today then
      raise exception
        'Teaching Update cannot be submitted before all covered dates occur'
        using errcode = '23514';
    end if;

    select count(*)
    into roster_count
    from public.get_weekly_submission_roster(
      p_class_subject_id,
      p_subject_group_id,
      p_week_start
    );

    select count(distinct student_row.student_id)
    into attendance_count
    from public.weekly_submission_students student_row
    where student_row.school_id = target_school_id
      and student_row.submission_id =
        target_submission_id;

    if attendance_count <> roster_count then
      raise exception
        'complete attendance is required for submission'
        using errcode = '23514';
    end if;

    update public.weekly_submissions
    set
      status = 'SUBMITTED',
      submitted_at = now(),
      version = version + 1
    where school_id = target_school_id
      and id = target_submission_id;
  end if;

  return target_submission_id;
end;
$$;

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
  select
    candidate.teacher_id,
    candidate.match_count
  into
    resolved_teacher_id,
    matching_teacher_count
  from (
    select
      current_id as teacher_id,
      count(*) over ()::integer as match_count
    from public.current_teacher_ids() current_id
    where public.teacher_can_teach_week_context(
      current_id,
      p_class_subject_id,
      p_subject_group_id,
      p_week_start
    )
  ) candidate
  limit 1;

  if coalesce(matching_teacher_count, 0) <> 1 then
    raise exception
      'exactly one Teacher identity is required for this teaching context'
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

-------------------------------------------------------------------------------
-- Permissions
-------------------------------------------------------------------------------

revoke all on function public.request_teaching_update(
  uuid, text, date, date, date[], text
) from public;
revoke execute on function public.request_teaching_update(
  uuid, text, date, date, date[], text
) from anon;
grant execute on function public.request_teaching_update(
  uuid, text, date, date, date[], text
) to authenticated;

revoke all on function public.find_overlapping_teaching_updates(
  uuid, uuid, date, date
) from public;
revoke execute on function public.find_overlapping_teaching_updates(
  uuid, uuid, date, date
) from anon;
grant execute on function public.find_overlapping_teaching_updates(
  uuid, uuid, date, date
) to authenticated;

revoke all on function public.submit_teaching_update(
  uuid, uuid, integer
) from public;
revoke execute on function public.submit_teaching_update(
  uuid, uuid, integer
) from anon;
grant execute on function public.submit_teaching_update(
  uuid, uuid, integer
) to authenticated;

revoke all on function public.dismiss_teaching_update(
  uuid, text, integer
) from public;
revoke execute on function public.dismiss_teaching_update(
  uuid, text, integer
) from anon;
grant execute on function public.dismiss_teaching_update(
  uuid, text, integer
) to authenticated;

grant select
on public.teaching_update_request_sets
to authenticated;

grant select, insert, update, delete
on public.weekly_submission_dates
to authenticated;
