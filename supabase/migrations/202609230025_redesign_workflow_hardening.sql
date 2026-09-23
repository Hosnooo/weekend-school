-- Corrections discovered while wiring migrations 19-24 into complete application workflows.
create function public.protect_submitted_weekly_submission() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='SUBMITTED' and new is distinct from old then raise exception 'submitted weekly submissions are immutable'; end if;
 if new.teacher_profile_id<>old.teacher_profile_id then raise exception 'submission author is immutable'; end if;
 return new;
end $$;
create trigger weekly_submissions_protect_submitted before update on public.weekly_submissions for each row execute function public.protect_submitted_weekly_submission();
revoke all on function public.protect_submitted_weekly_submission() from public;

create function public.change_student_class(p_student_id uuid,p_class_id uuid,p_effective_on date) returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid:=public.current_school_id();v_id uuid;begin
 if not public.is_admin() or not exists(select 1 from public.students where id=p_student_id and school_id=v_school) or not exists(select 1 from public.classes where id=p_class_id and school_id=v_school and is_active) then raise exception 'access denied' using errcode='42501';end if;
 update public.class_enrollments set ends_on=p_effective_on-1 where school_id=v_school and student_id=p_student_id and ends_on is null and starts_on<p_effective_on;
 delete from public.class_enrollments where school_id=v_school and student_id=p_student_id and starts_on=p_effective_on;
 insert into public.class_enrollments(school_id,class_id,student_id,starts_on) values(v_school,p_class_id,p_student_id,p_effective_on) returning id into v_id;
 insert into public.subject_group_memberships(school_id,class_subject_id,subject_group_id,student_id,starts_on)
 select v_school,cs.id,cs.default_group_id,p_student_id,p_effective_on from public.class_subjects cs where cs.school_id=v_school and cs.class_id=p_class_id and cs.is_active and cs.default_group_id is not null and not exists(select 1 from public.subject_exclusions e where e.school_id=v_school and e.class_subject_id=cs.id and e.student_id=p_student_id and p_effective_on between e.starts_on and coalesce(e.ends_on,'infinity'));
 return v_id;end $$;
create function public.move_student_subject_group(p_student_id uuid,p_class_subject_id uuid,p_group_id uuid,p_effective_on date) returns uuid language plpgsql security definer set search_path='' as $$ declare v_school uuid:=public.current_school_id();v_id uuid;begin if not public.is_admin() then raise exception 'access denied' using errcode='42501';end if; if not public.student_participates_in_class_subject(p_student_id,p_class_subject_id,p_effective_on) then raise exception 'student does not participate';end if; update public.subject_group_memberships set ends_on=p_effective_on-1 where school_id=v_school and student_id=p_student_id and class_subject_id=p_class_subject_id and ends_on is null and starts_on<p_effective_on;delete from public.subject_group_memberships where school_id=v_school and student_id=p_student_id and class_subject_id=p_class_subject_id and starts_on=p_effective_on;insert into public.subject_group_memberships(school_id,class_subject_id,subject_group_id,student_id,starts_on) values(v_school,p_class_subject_id,p_group_id,p_student_id,p_effective_on) returning id into v_id;return v_id;end $$;
revoke all on function public.change_student_class(uuid,uuid,date),public.move_student_subject_group(uuid,uuid,uuid,date) from public;grant execute on function public.change_student_class(uuid,uuid,date),public.move_student_subject_group(uuid,uuid,uuid,date) to authenticated;
