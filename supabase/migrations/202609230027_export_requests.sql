-- Short-lived, school-owned export request metadata. Generated artifacts are not persisted;
-- the protected download route regenerates them on demand while this request is valid.

create table public.export_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  requested_by_profile_id uuid not null,
  request jsonb not null check (jsonb_typeof(request) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  constraint export_requests_profile_school_fk
    foreign key (school_id, requested_by_profile_id)
    references public.profiles(school_id, id) on delete restrict,
  constraint export_requests_future_expiry_check
    check (expires_at > created_at)
);

create index export_requests_school_expiry_idx
  on public.export_requests (school_id, expires_at);

alter table public.export_requests enable row level security;
alter table public.export_requests force row level security;

create policy export_requests_admin_select on public.export_requests
for select to authenticated
using (
  school_id = public.current_school_id()
  and public.is_admin()
);

create policy export_requests_admin_insert on public.export_requests
for insert to authenticated
with check (
  school_id = public.current_school_id()
  and requested_by_profile_id = public.current_profile_id()
  and public.is_admin()
  and expires_at > now()
);

create policy export_requests_admin_delete on public.export_requests
for delete to authenticated
using (
  school_id = public.current_school_id()
  and public.is_admin()
);

revoke all on table public.export_requests from anon;
revoke all on table public.export_requests from authenticated;
grant select, insert, delete on table public.export_requests to authenticated;
