-- Add nullable report-level attendance overrides without rewriting source attendance
-- or existing finalized report snapshots.

alter table public.report_student_overrides
  add column if not exists attendance_attended integer,
  add column if not exists attendance_total integer;

alter table public.report_student_overrides
  drop constraint if exists report_student_overrides_attendance_pair_check,
  drop constraint if exists report_student_overrides_attendance_nonnegative_check,
  drop constraint if exists report_student_overrides_attendance_order_check;

alter table public.report_student_overrides
  add constraint report_student_overrides_attendance_pair_check check (
    (attendance_attended is null and attendance_total is null)
    or (attendance_attended is not null and attendance_total is not null)
  ),
  add constraint report_student_overrides_attendance_nonnegative_check check (
    (attendance_attended is null or attendance_attended >= 0)
    and (attendance_total is null or attendance_total >= 0)
  ),
  add constraint report_student_overrides_attendance_order_check check (
    attendance_attended is null
    or attendance_total is null
    or attendance_attended <= attendance_total
  );
