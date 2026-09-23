create type public.observed_attendance as enum('PRESENT','ABSENT');
create table public.weekly_submissions(
 id uuid primary key default gen_random_uuid(), school_id uuid not null, class_subject_id uuid not null, subject_group_id uuid, teacher_profile_id uuid not null,
 week_start date not null, status public.session_status not null default 'DRAFT', progress_en text, progress_ar text, default_performance public.performance_level,
 submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(school_id,id),
 foreign key(school_id,class_subject_id) references public.class_subjects(school_id,id), foreign key(school_id,subject_group_id) references public.subject_groups(school_id,id), foreign key(school_id,teacher_profile_id) references public.profiles(school_id,id),
 unique nulls not distinct(school_id,class_subject_id,subject_group_id,teacher_profile_id,week_start), check(extract(isodow from week_start)=1), check(status<>'SUBMITTED' or submitted_at is not null)
);
create trigger weekly_submission_group_check before insert or update on public.weekly_submissions for each row execute function public.validate_academic_group_links();
create trigger weekly_submissions_updated before update on public.weekly_submissions for each row execute function public.set_updated_at();
create table public.weekly_submission_students(
 id uuid primary key default gen_random_uuid(), school_id uuid not null, submission_id uuid not null, student_id uuid not null,
 attendance_status public.observed_attendance not null, performance_override public.performance_level, comment_en text, comment_ar text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(school_id,id), unique(submission_id,student_id),
 foreign key(school_id,submission_id) references public.weekly_submissions(school_id,id), foreign key(school_id,student_id) references public.students(school_id,id)
);
create trigger weekly_submission_students_updated before update on public.weekly_submission_students for each row execute function public.set_updated_at();
alter table public.weekly_submissions enable row level security; alter table public.weekly_submissions force row level security;
alter table public.weekly_submission_students enable row level security; alter table public.weekly_submission_students force row level security;
create policy weekly_admin on public.weekly_submissions for all to authenticated using(school_id=public.current_school_id() and public.is_admin()) with check(school_id=public.current_school_id() and public.is_admin());
create policy weekly_teacher on public.weekly_submissions for all to authenticated using(school_id=public.current_school_id() and teacher_profile_id=public.current_profile_id()) with check(school_id=public.current_school_id() and teacher_profile_id=public.current_profile_id() and public.teacher_can_teach_context(teacher_profile_id,class_subject_id,subject_group_id,week_start));
create policy weekly_students_admin on public.weekly_submission_students for all to authenticated using(school_id=public.current_school_id() and public.is_admin()) with check(school_id=public.current_school_id() and public.is_admin());
create policy weekly_students_teacher on public.weekly_submission_students for all to authenticated using(school_id=public.current_school_id() and exists(select 1 from public.weekly_submissions s where s.id=submission_id and s.teacher_profile_id=public.current_profile_id())) with check(school_id=public.current_school_id() and exists(select 1 from public.weekly_submissions s where s.id=submission_id and s.teacher_profile_id=public.current_profile_id() and s.status='DRAFT'));
