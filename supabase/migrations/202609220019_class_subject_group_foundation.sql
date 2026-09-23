-- Forward-only Class -> Subject -> optional Group foundation.
create table public.classes (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
 name_en text not null check(length(trim(name_en))>0), name_ar text, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(school_id,id)
);
create table public.subjects (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
 name_en text not null check(length(trim(name_en))>0), name_ar text, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(school_id,id), unique(school_id,name_en)
);
create table public.class_subjects (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, class_id uuid not null, subject_id uuid not null,
 default_group_id uuid, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(school_id,id), unique(school_id,class_id,subject_id), foreign key(school_id,class_id) references public.classes(school_id,id),
 foreign key(school_id,subject_id) references public.subjects(school_id,id)
);
create table public.subject_groups (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, class_subject_id uuid not null,
 name_en text not null check(length(trim(name_en))>0), name_ar text, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(school_id,id), unique(school_id,class_subject_id,name_en),
 foreign key(school_id,class_subject_id) references public.class_subjects(school_id,id)
);
alter table public.class_subjects add constraint class_subject_default_group_fk foreign key(school_id,default_group_id) references public.subject_groups(school_id,id) deferrable initially deferred;

create table public.class_enrollments (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, class_id uuid not null, student_id uuid not null,
 starts_on date not null, ends_on date, created_at timestamptz not null default now(), unique(school_id,id),
 foreign key(school_id,class_id) references public.classes(school_id,id), foreign key(school_id,student_id) references public.students(school_id,id),
 check(ends_on is null or ends_on>=starts_on), exclude using gist(school_id with =, student_id with =, daterange(starts_on,coalesce(ends_on,'infinity'),'[]') with &&)
);
create table public.subject_exclusions (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, class_subject_id uuid not null, student_id uuid not null,
 starts_on date not null, ends_on date, reason text, created_at timestamptz not null default now(), unique(school_id,id),
 foreign key(school_id,class_subject_id) references public.class_subjects(school_id,id), foreign key(school_id,student_id) references public.students(school_id,id),
 check(ends_on is null or ends_on>=starts_on), exclude using gist(school_id with =,class_subject_id with =,student_id with =,daterange(starts_on,coalesce(ends_on,'infinity'),'[]') with &&)
);
create table public.subject_group_memberships (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, class_subject_id uuid not null, subject_group_id uuid not null, student_id uuid not null,
 starts_on date not null, ends_on date, created_at timestamptz not null default now(), unique(school_id,id),
 foreign key(school_id,class_subject_id) references public.class_subjects(school_id,id), foreign key(school_id,subject_group_id) references public.subject_groups(school_id,id), foreign key(school_id,student_id) references public.students(school_id,id),
 check(ends_on is null or ends_on>=starts_on), exclude using gist(school_id with =,class_subject_id with =,student_id with =,daterange(starts_on,coalesce(ends_on,'infinity'),'[]') with &&)
);
create table public.teaching_assignments (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, teacher_profile_id uuid not null, class_subject_id uuid not null, subject_group_id uuid,
 starts_on date not null, ends_on date, created_at timestamptz not null default now(), unique(school_id,id),
 foreign key(school_id,teacher_profile_id) references public.profiles(school_id,id), foreign key(school_id,class_subject_id) references public.class_subjects(school_id,id), foreign key(school_id,subject_group_id) references public.subject_groups(school_id,id),
 check(ends_on is null or ends_on>=starts_on), exclude using gist(school_id with =,teacher_profile_id with =,class_subject_id with =,coalesce(subject_group_id,'00000000-0000-0000-0000-000000000000'::uuid) with =,daterange(starts_on,coalesce(ends_on,'infinity'),'[]') with &&)
);

create function public.validate_academic_group_links() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='class_subjects' and new.default_group_id is not null and not exists(select 1 from public.subject_groups g where g.id=new.default_group_id and g.school_id=new.school_id and g.class_subject_id=new.id) then raise exception 'default group must belong to class subject'; end if;
 if tg_table_name in ('subject_group_memberships','teaching_assignments') and new.subject_group_id is not null and not exists(select 1 from public.subject_groups g where g.id=new.subject_group_id and g.school_id=new.school_id and g.class_subject_id=new.class_subject_id) then raise exception 'group must belong to class subject'; end if;
 return new;
end $$;
create constraint trigger class_subject_default_group_check after insert or update on public.class_subjects deferrable initially deferred for each row execute function public.validate_academic_group_links();
create trigger membership_group_check before insert or update on public.subject_group_memberships for each row execute function public.validate_academic_group_links();
create trigger assignment_group_check before insert or update on public.teaching_assignments for each row execute function public.validate_academic_group_links();

create function public.student_participates_in_class_subject(p_student_id uuid,p_class_subject_id uuid,p_on_date date) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_subjects cs join public.class_enrollments ce on ce.school_id=cs.school_id and ce.class_id=cs.class_id where cs.id=p_class_subject_id and cs.is_active and ce.student_id=p_student_id and p_on_date between ce.starts_on and coalesce(ce.ends_on,'infinity') and not exists(select 1 from public.subject_exclusions se where se.school_id=cs.school_id and se.class_subject_id=cs.id and se.student_id=p_student_id and p_on_date between se.starts_on and coalesce(se.ends_on,'infinity')))
$$;
create function public.teacher_can_teach_context(p_profile_id uuid,p_class_subject_id uuid,p_subject_group_id uuid,p_on_date date) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.teaching_assignments ta where ta.teacher_profile_id=p_profile_id and ta.class_subject_id=p_class_subject_id and (ta.subject_group_id is null or ta.subject_group_id=p_subject_group_id) and p_on_date between ta.starts_on and coalesce(ta.ends_on,'infinity')) and (p_subject_group_id is null or exists(select 1 from public.subject_groups g where g.id=p_subject_group_id and g.class_subject_id=p_class_subject_id))
$$;
create function public.create_subject_group(p_class_subject_id uuid,p_name_en text,p_name_ar text default null) returns uuid language plpgsql security definer set search_path='' as $$ declare v_school uuid; v_id uuid; begin select school_id into v_school from public.class_subjects where id=p_class_subject_id; if v_school is null or v_school<>public.current_school_id() or not public.is_admin() then raise exception 'access denied' using errcode='42501'; end if; insert into public.subject_groups(school_id,class_subject_id,name_en,name_ar) values(v_school,p_class_subject_id,trim(p_name_en),nullif(trim(p_name_ar),'')) returning id into v_id; update public.class_subjects set default_group_id=v_id where id=p_class_subject_id and default_group_id is null; return v_id; end $$;
revoke all on function public.student_participates_in_class_subject(uuid,uuid,date), public.teacher_can_teach_context(uuid,uuid,uuid,date), public.create_subject_group(uuid,text,text) from public;
grant execute on function public.student_participates_in_class_subject(uuid,uuid,date), public.teacher_can_teach_context(uuid,uuid,uuid,date), public.create_subject_group(uuid,text,text) to authenticated;
insert into public.classes(id,school_id,name_en,name_ar,is_active,created_at,updated_at) select id,school_id,name_en,name_ar,is_active,created_at,updated_at from public.groups where parent_group_id is null on conflict(id) do nothing;
