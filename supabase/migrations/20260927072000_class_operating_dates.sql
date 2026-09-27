-- Add an explicit operating period to Classes.
-- Student enrollment dates remain independent per-student history.

alter table public.classes
  add column starts_on date,
  add column ends_on date;

update public.classes class_row
set starts_on = coalesce(
  (
    select min(enrollment.starts_on)
    from public.class_enrollments enrollment
    where enrollment.school_id = class_row.school_id
      and enrollment.class_id = class_row.id
  ),
  (
    select min(assignment.starts_on)
    from public.class_subjects class_subject
    join public.teaching_assignments assignment
      on assignment.school_id = class_subject.school_id
     and assignment.class_subject_id = class_subject.id
    where class_subject.school_id = class_row.school_id
      and class_subject.class_id = class_row.id
  ),
  current_date
)
where class_row.starts_on is null;

alter table public.classes
  alter column starts_on set not null,
  alter column starts_on set default current_date;

alter table public.classes
  add constraint classes_operating_dates_check
  check (ends_on is null or ends_on >= starts_on);
