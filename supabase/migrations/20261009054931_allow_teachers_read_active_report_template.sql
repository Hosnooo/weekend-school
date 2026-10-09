-- Allow an active Teacher to read the school's active reporting configuration.
-- Teacher forms read this template to determine which optional fields exist.
-- Administrators retain write control; inactive templates remain admin-only.
-- A Teacher must have an active Teacher record linked to their current Profile.
create policy report_templates_teacher_read_active
on public.report_templates
for select
to authenticated
using (
  school_id = public.current_school_id()
  and is_active
  and exists (select 1 from public.current_teacher_ids())
);
