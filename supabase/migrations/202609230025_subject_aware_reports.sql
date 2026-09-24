-- Subject-aware reporting metadata and report revision foundation.
-- Forward-only: preserve all existing report IDs, snapshots, and delivery rows.

create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  intro_en text,
  intro_ar text,
  closing_en text,
  closing_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name)
);

create table public.report_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  scope_type text not null check (scope_type in ('CLASS', 'SUBJECT', 'GROUP')),
  class_id uuid not null,
  class_subject_id uuid,
  subject_group_id uuid,
  period_start date not null,
  period_end date not null,
  template_id uuid,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'REVIEW', 'FINALIZED')),
  created_by_profile_id uuid not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  constraint report_batches_class_school_fk
    foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete restrict,
  constraint report_batches_class_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict,
  constraint report_batches_group_context_fk
    foreign key (school_id, class_subject_id, subject_group_id)
    references public.subject_groups(school_id, class_subject_id, id) on delete restrict,
  constraint report_batches_template_school_fk
    foreign key (school_id, template_id)
    references public.report_templates(school_id, id) on delete restrict,
  constraint report_batches_creator_school_fk
    foreign key (school_id, created_by_profile_id)
    references public.profiles(school_id, id) on delete restrict,
  constraint report_batches_period_check check (period_end >= period_start),
  constraint report_batches_scope_check check (
    (scope_type = 'CLASS' and class_subject_id is null and subject_group_id is null)
    or (scope_type = 'SUBJECT' and class_subject_id is not null and subject_group_id is null)
    or (scope_type = 'GROUP' and class_subject_id is not null and subject_group_id is not null)
  ),
  constraint report_batches_finalized_timestamp_check check (
    (status = 'FINALIZED' and finalized_at is not null)
    or (status <> 'FINALIZED' and finalized_at is null)
  )
);

create table public.report_section_approvals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  batch_id uuid not null,
  class_subject_id uuid not null,
  subject_group_id uuid,
  approved_progress_en text,
  approved_progress_ar text,
  performance public.performance_level,
  comment_en text,
  comment_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  constraint report_section_approvals_batch_school_fk
    foreign key (school_id, batch_id)
    references public.report_batches(school_id, id) on delete cascade,
  constraint report_section_approvals_subject_school_fk
    foreign key (school_id, class_subject_id)
    references public.class_subjects(school_id, id) on delete restrict,
  constraint report_section_approvals_group_context_fk
    foreign key (school_id, class_subject_id, subject_group_id)
    references public.subject_groups(school_id, class_subject_id, id) on delete restrict,
  constraint report_section_approvals_one_context
    unique nulls not distinct (school_id, batch_id, class_subject_id, subject_group_id)
);

create table public.report_section_sources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  approval_id uuid not null,
  weekly_submission_id uuid not null,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, approval_id, weekly_submission_id),
  constraint report_section_sources_approval_school_fk
    foreign key (school_id, approval_id)
    references public.report_section_approvals(school_id, id) on delete cascade,
  constraint report_section_sources_submission_school_fk
    foreign key (school_id, weekly_submission_id)
    references public.weekly_submissions(school_id, id) on delete restrict
);

create table public.report_student_overrides (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  approval_id uuid not null,
  student_id uuid not null,
  progress_en text,
  progress_ar text,
  performance public.performance_level,
  comment_en text,
  comment_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, approval_id, student_id),
  constraint report_student_overrides_approval_school_fk
    foreign key (school_id, approval_id)
    references public.report_section_approvals(school_id, id) on delete cascade,
  constraint report_student_overrides_student_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict
);

alter table public.reports
  add column batch_id uuid,
  add column revision integer not null default 1,
  add column supersedes_report_id uuid,
  add column snapshot_version smallint not null default 1,
  add column finalized_at timestamptz,
  add constraint reports_batch_school_fk
    foreign key (school_id, batch_id)
    references public.report_batches(school_id, id) on delete restrict,
  add constraint reports_supersedes_school_fk
    foreign key (school_id, supersedes_report_id)
    references public.reports(school_id, id) on delete restrict,
  add constraint reports_revision_positive_check check (revision > 0),
  add constraint reports_snapshot_version_check check (snapshot_version in (1, 2));

-- PostgreSQL preserves the _key suffix and truncates the column-name portion
-- when generating this identifier to fit the 63-byte identifier limit.
alter table public.reports
  drop constraint reports_school_id_student_id_period_start_period_end_langua_key;

alter table public.reports
  add constraint reports_student_period_language_revision_key
  unique (school_id, student_id, period_start, period_end, language, revision);

create index report_batches_period_status_idx
  on public.report_batches (school_id, period_start, period_end, status);
create index report_batches_scope_idx
  on public.report_batches (school_id, class_id, class_subject_id, subject_group_id);
create index report_section_approvals_batch_idx
  on public.report_section_approvals (school_id, batch_id, class_subject_id, subject_group_id);
create index report_section_sources_submission_idx
  on public.report_section_sources (school_id, weekly_submission_id);
create index report_student_overrides_student_idx
  on public.report_student_overrides (school_id, student_id, approval_id);
create index reports_batch_revision_idx
  on public.reports (school_id, batch_id, student_id, revision desc);
create index reports_supersedes_idx
  on public.reports (school_id, supersedes_report_id);

create trigger report_templates_set_updated_at
before update on public.report_templates
for each row execute function public.set_updated_at();

create trigger report_batches_set_updated_at
before update on public.report_batches
for each row execute function public.set_updated_at();

create trigger report_section_approvals_set_updated_at
before update on public.report_section_approvals
for each row execute function public.set_updated_at();

create trigger report_student_overrides_set_updated_at
before update on public.report_student_overrides
for each row execute function public.set_updated_at();

alter table public.report_templates enable row level security;
alter table public.report_batches enable row level security;
alter table public.report_section_approvals enable row level security;
alter table public.report_section_sources enable row level security;
alter table public.report_student_overrides enable row level security;

alter table public.report_templates force row level security;
alter table public.report_batches force row level security;
alter table public.report_section_approvals force row level security;
alter table public.report_section_sources force row level security;
alter table public.report_student_overrides force row level security;

create policy report_templates_admin_all on public.report_templates
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy report_batches_admin_all on public.report_batches
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy report_section_approvals_admin_all on public.report_section_approvals
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy report_section_sources_admin_all on public.report_section_sources
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

create policy report_student_overrides_admin_all on public.report_student_overrides
for all to authenticated
using (school_id = public.current_school_id() and public.is_admin())
with check (school_id = public.current_school_id() and public.is_admin());

revoke all on table public.report_templates from anon;
revoke all on table public.report_batches from anon;
revoke all on table public.report_section_approvals from anon;
revoke all on table public.report_section_sources from anon;
revoke all on table public.report_student_overrides from anon;

revoke all on table public.report_templates from authenticated;
revoke all on table public.report_batches from authenticated;
revoke all on table public.report_section_approvals from authenticated;
revoke all on table public.report_section_sources from authenticated;
revoke all on table public.report_student_overrides from authenticated;

grant select, insert, update on table public.report_templates to authenticated;
grant select, insert, update on table public.report_batches to authenticated;
grant select, insert, update on table public.report_section_approvals to authenticated;
grant select, insert, update on table public.report_section_sources to authenticated;
grant select, insert, update on table public.report_student_overrides to authenticated;

-- Finalized v2 report snapshots may update delivery state, but their report content and
-- identity are immutable. Corrections create a new finalized revision instead.
create function public.protect_finalized_report_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finalized_at is not null and (
    new.school_id is distinct from old.school_id
    or new.student_id is distinct from old.student_id
    or new.period_start is distinct from old.period_start
    or new.period_end is distinct from old.period_end
    or new.language is distinct from old.language
    or new.snapshot_json is distinct from old.snapshot_json
    or new.generated_at is distinct from old.generated_at
    or new.created_at is distinct from old.created_at
    or new.batch_id is distinct from old.batch_id
    or new.revision is distinct from old.revision
    or new.supersedes_report_id is distinct from old.supersedes_report_id
    or new.snapshot_version is distinct from old.snapshot_version
    or new.finalized_at is distinct from old.finalized_at
  ) then
    raise exception 'finalized report snapshots are immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_finalized_report_snapshot() from public;
revoke execute on function public.protect_finalized_report_snapshot() from anon;
revoke execute on function public.protect_finalized_report_snapshot() from authenticated;

create trigger reports_finalized_snapshot_immutable
before update on public.reports
for each row execute function public.protect_finalized_report_snapshot();

create function public.finalize_report_batch(
  p_batch_id uuid,
  p_reports jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  target_batch public.report_batches%rowtype;
  inserted_count integer;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  select * into target_batch
  from public.report_batches
  where school_id = target_school_id
    and id = p_batch_id
  for update;

  if not found then
    raise exception 'report batch not found' using errcode = 'P0002';
  end if;
  if target_batch.status <> 'REVIEW' then
    raise exception 'report batch must be in review before finalization' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_reports, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_reports) = 0
  then
    raise exception 'finalized reports must be a non-empty array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_reports) as item(
      student_id uuid,
      language public.report_language,
      snapshot_json jsonb
    )
    where item.student_id is null
      or item.language is null
      or coalesce(jsonb_typeof(item.snapshot_json), '') <> 'object'
      or item.snapshot_json ->> 'version' <> '2'
      or not exists (
        select 1
        from public.students student
        where student.school_id = target_school_id
          and student.id = item.student_id
      )
  ) then
    raise exception 'invalid finalized report snapshot input' using errcode = '23514';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(p_reports) as item(
      student_id uuid,
      language public.report_language,
      snapshot_json jsonb
    )
  ) <> (
    select count(distinct (item.student_id, item.language))
    from jsonb_to_recordset(p_reports) as item(
      student_id uuid,
      language public.report_language,
      snapshot_json jsonb
    )
  ) then
    raise exception 'duplicate student report language in batch' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.weekly_submission_students wss
    join public.weekly_submissions ws
      on ws.school_id = wss.school_id
     and ws.id = wss.submission_id
    join public.class_subjects cs
      on cs.school_id = ws.school_id
     and cs.id = ws.class_subject_id
    where ws.school_id = target_school_id
      and ws.status = 'SUBMITTED'
      and ws.week_start between target_batch.period_start and target_batch.period_end
      and cs.class_id = target_batch.class_id
      and (
        target_batch.scope_type = 'CLASS'
        or (
          target_batch.scope_type = 'SUBJECT'
          and ws.class_subject_id = target_batch.class_subject_id
        )
        or (
          target_batch.scope_type = 'GROUP'
          and ws.class_subject_id = target_batch.class_subject_id
          and ws.subject_group_id is not distinct from target_batch.subject_group_id
        )
      )
    group by ws.class_subject_id, ws.subject_group_id, ws.week_start, wss.student_id
    having count(distinct wss.attendance_status) > 1
      and not exists (
        select 1
        from public.attendance_resolutions resolution
        where resolution.school_id = target_school_id
          and resolution.class_subject_id = ws.class_subject_id
          and resolution.subject_group_id is not distinct from ws.subject_group_id
          and resolution.week_start = ws.week_start
          and resolution.student_id = wss.student_id
      )
  ) then
    raise exception 'unresolved attendance conflicts block report finalization' using errcode = '23514';
  end if;

  insert into public.reports (
    school_id,
    student_id,
    period_start,
    period_end,
    language,
    status,
    snapshot_json,
    batch_id,
    revision,
    supersedes_report_id,
    snapshot_version,
    finalized_at
  )
  select
    target_school_id,
    item.student_id,
    target_batch.period_start,
    target_batch.period_end,
    item.language,
    'READY',
    item.snapshot_json,
    target_batch.id,
    coalesce(previous.revision, 0) + 1,
    previous.id,
    2,
    now()
  from jsonb_to_recordset(p_reports) as item(
    student_id uuid,
    language public.report_language,
    snapshot_json jsonb
  )
  left join lateral (
    select report.id, report.revision
    from public.reports report
    where report.school_id = target_school_id
      and report.student_id = item.student_id
      and report.period_start = target_batch.period_start
      and report.period_end = target_batch.period_end
      and report.language = item.language
    order by report.revision desc
    limit 1
  ) previous on true;

  get diagnostics inserted_count = row_count;

  update public.report_batches
  set status = 'FINALIZED',
      finalized_at = now()
  where school_id = target_school_id
    and id = target_batch.id;

  return inserted_count;
end;
$$;

revoke all on function public.finalize_report_batch(uuid, jsonb) from public;
revoke execute on function public.finalize_report_batch(uuid, jsonb) from anon;
grant execute on function public.finalize_report_batch(uuid, jsonb) to authenticated;

create function public.create_report_revision(
  p_report_id uuid,
  p_snapshot_json jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  source_report public.reports%rowtype;
  new_report_id uuid;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  select * into source_report
  from public.reports
  where school_id = target_school_id
    and id = p_report_id
  for update;

  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  if source_report.finalized_at is null or source_report.snapshot_version <> 2 then
    raise exception 'only finalized v2 reports can be revised' using errcode = '23514';
  end if;
  if coalesce(jsonb_typeof(p_snapshot_json), '') <> 'object'
    or p_snapshot_json ->> 'version' <> '2'
  then
    raise exception 'revision snapshot must be a v2 object' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.reports newer
    where newer.school_id = target_school_id
      and newer.student_id = source_report.student_id
      and newer.period_start = source_report.period_start
      and newer.period_end = source_report.period_end
      and newer.language = source_report.language
      and newer.revision > source_report.revision
  ) then
    raise exception 'corrections must supersede the latest report revision' using errcode = '23514';
  end if;

  insert into public.reports (
    school_id,
    student_id,
    period_start,
    period_end,
    language,
    status,
    snapshot_json,
    batch_id,
    revision,
    supersedes_report_id,
    snapshot_version,
    finalized_at
  ) values (
    target_school_id,
    source_report.student_id,
    source_report.period_start,
    source_report.period_end,
    source_report.language,
    'READY',
    p_snapshot_json,
    source_report.batch_id,
    source_report.revision + 1,
    source_report.id,
    2,
    now()
  )
  returning id into new_report_id;

  return new_report_id;
end;
$$;

revoke all on function public.create_report_revision(uuid, jsonb) from public;
revoke execute on function public.create_report_revision(uuid, jsonb) from anon;
grant execute on function public.create_report_revision(uuid, jsonb) to authenticated;

-- Migration 025 made logical report identity revision-aware. Keep the legacy v1
-- generator callable until the admin page is fully switched to the v2 batch flow.
create or replace function public.generate_report_snapshots(p_reports jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid := public.current_school_id();
  inserted_count integer;
begin
  if target_school_id is null or not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_reports,'[]'::jsonb)) <> 'array' then
    raise exception 'reports must be an array' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_reports,'[]'::jsonb)) as item(student_id uuid,period_start date,period_end date,language public.report_language,snapshot_json jsonb)
    where not exists (select 1 from public.students where students.school_id=target_school_id and students.id=item.student_id)
      or item.period_end < item.period_start
      or jsonb_typeof(item.snapshot_json) <> 'object'
  ) then raise exception 'invalid report snapshot input' using errcode = '23514'; end if;

  insert into public.reports (school_id,student_id,period_start,period_end,language,status,snapshot_json,revision,snapshot_version)
  select target_school_id,item.student_id,item.period_start,item.period_end,item.language,'READY',item.snapshot_json,1,1
  from jsonb_to_recordset(coalesce(p_reports,'[]'::jsonb)) as item(student_id uuid,period_start date,period_end date,language public.report_language,snapshot_json jsonb)
  on conflict (school_id, student_id, period_start, period_end, language, revision) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.generate_report_snapshots(jsonb) from public;
revoke execute on function public.generate_report_snapshots(jsonb) from anon;
grant execute on function public.generate_report_snapshots(jsonb) to authenticated;
