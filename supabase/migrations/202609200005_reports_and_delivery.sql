create table public.reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  period_start date not null,
  period_end date not null,
  language public.report_language not null,
  status public.report_status not null default 'DRAFT',
  snapshot_json jsonb not null,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, student_id, period_start, period_end, language),
  foreign key (school_id, student_id)
    references public.students(school_id, id) on delete restrict,
  check (period_end >= period_start),
  check (jsonb_typeof(snapshot_json) = 'object'),
  check (status <> 'SENT' or sent_at is not null)
);

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  report_id uuid not null,
  guardian_id uuid not null,
  recipient_email text not null
    check (recipient_email = lower(trim(recipient_email)) and position('@' in recipient_email) > 1),
  provider text not null check (length(trim(provider)) > 0),
  provider_message_id text,
  status public.delivery_status not null default 'PENDING',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, guardian_id),
  foreign key (school_id, report_id)
    references public.reports(school_id, id) on delete restrict,
  foreign key (school_id, guardian_id)
    references public.guardians(school_id, id) on delete restrict,
  check (status not in ('SENT', 'DELIVERED') or sent_at is not null)
);

create index reports_period_status_idx
  on public.reports (school_id, period_start, period_end, status);
create index reports_student_period_idx
  on public.reports (school_id, student_id, period_end desc);
create index email_deliveries_status_idx
  on public.email_deliveries (school_id, status, created_at);

create trigger email_deliveries_set_updated_at
before update on public.email_deliveries
for each row execute function public.set_updated_at();
