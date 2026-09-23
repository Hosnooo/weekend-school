create table public.attendance_resolutions(
 id uuid primary key default gen_random_uuid(), school_id uuid not null, class_subject_id uuid not null, subject_group_id uuid, week_start date not null, student_id uuid not null,
 status public.observed_attendance not null, resolved_by uuid not null, resolved_at timestamptz not null default now(), note text, unique(school_id,id),
 foreign key(school_id,class_subject_id) references public.class_subjects(school_id,id), foreign key(school_id,subject_group_id) references public.subject_groups(school_id,id), foreign key(school_id,student_id) references public.students(school_id,id), foreign key(school_id,resolved_by) references public.profiles(school_id,id),
 unique nulls not distinct(school_id,class_subject_id,subject_group_id,week_start,student_id)
);
create trigger attendance_resolution_group_check before insert or update on public.attendance_resolutions for each row execute function public.validate_academic_group_links();
alter table public.attendance_resolutions enable row level security; alter table public.attendance_resolutions force row level security;
create policy attendance_resolution_admin on public.attendance_resolutions for all to authenticated using(school_id=public.current_school_id() and public.is_admin()) with check(school_id=public.current_school_id() and public.is_admin() and resolved_by=public.current_profile_id());
create policy attendance_resolution_teacher_read on public.attendance_resolutions for select to authenticated using(school_id=public.current_school_id() and public.teacher_can_teach_context(public.current_profile_id(),class_subject_id,subject_group_id,week_start));
