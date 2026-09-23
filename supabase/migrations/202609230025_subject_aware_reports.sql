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

-- PostgreSQL truncates the original auto-generated 65-character unique
-- constraint name to 63 characters.
alter table public.reports
  drop constraint reports_school_id_student_id_period_start_period_end_language_k;

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
