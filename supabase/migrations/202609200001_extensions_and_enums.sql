create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum ('ADMIN', 'TEACHER');
create type public.language_code as enum ('en', 'ar');
create type public.report_language as enum ('en', 'ar', 'both');
create type public.assignment_type as enum ('PRIMARY', 'ASSISTANT');
create type public.session_status as enum ('DRAFT', 'SUBMITTED');
create type public.performance_level as enum (
  'EXCELLENT',
  'GOOD',
  'DEVELOPING',
  'NEEDS_SUPPORT'
);
create type public.attendance_status as enum ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
create type public.report_status as enum ('DRAFT', 'READY', 'SENT', 'FAILED');
create type public.delivery_status as enum ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
