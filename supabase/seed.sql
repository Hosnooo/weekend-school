-- Development-only credentials. Never reuse these outside a local Supabase stack.
-- admin@example.test / WeekendSchool1!
-- teacher.en@example.test / WeekendSchool1!
-- teacher.ar@example.test / WeekendSchool1!

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000001','authenticated','authenticated','admin@example.test',crypt('WeekendSchool1!',gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"display_name":"Local Admin"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000002','authenticated','authenticated','teacher.en@example.test',crypt('WeekendSchool1!',gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"display_name":"English Teacher"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000003','authenticated','authenticated','teacher.ar@example.test',crypt('WeekendSchool1!',gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"display_name":"المعلمة العربية"}',now(),now())
on conflict (id) do update set
  email=excluded.email,
  encrypted_password=excluded.encrypted_password,
  email_confirmed_at=excluded.email_confirmed_at,
  confirmation_token=excluded.confirmation_token,
  recovery_token=excluded.recovery_token,
  email_change_token_new=excluded.email_change_token_new,
  email_change=excluded.email_change,
  raw_app_meta_data=excluded.raw_app_meta_data,
  raw_user_meta_data=excluded.raw_user_meta_data,
  updated_at=now();

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
  ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','{"sub":"b0000000-0000-0000-0000-000000000001","email":"admin@example.test"}','email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','{"sub":"b0000000-0000-0000-0000-000000000002","email":"teacher.en@example.test"}','email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000003','{"sub":"b0000000-0000-0000-0000-000000000003","email":"teacher.ar@example.test"}','email',now(),now(),now())
on conflict (provider_id, provider) do update set identity_data=excluded.identity_data, updated_at=now();

insert into public.schools (id,name_en,name_ar,timezone,default_language)
values ('a0000000-0000-0000-0000-000000000001','Weekend School','مدرسة نهاية الأسبوع','America/Edmonton','en')
on conflict (id) do update set name_en=excluded.name_en,name_ar=excluded.name_ar,timezone=excluded.timezone,default_language=excluded.default_language;

-- The same development seed supports both the pre-28 upgrade fixture and the
-- current independent-role schema. Keep legacy role labels only while the
-- legacy column exists; after migration 28 seed explicit business records/links.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    execute $seed$
      insert into public.profiles (id,school_id,auth_user_id,display_name,role,preferred_language,is_active) values
        ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Local Admin','ADMIN','en',true),
        ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','English Teacher','TEACHER','en',true),
        ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','المعلمة العربية','TEACHER','ar',true)
      on conflict (id) do update set display_name=excluded.display_name,preferred_language=excluded.preferred_language,is_active=true
    $seed$;
  else
    insert into public.profiles (id,school_id,auth_user_id,display_name,preferred_language,is_active) values
      ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Local Admin','en',true),
      ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','English Teacher','en',true),
      ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','المعلمة العربية','ar',true)
    on conflict (id) do update set display_name=excluded.display_name,preferred_language=excluded.preferred_language,is_active=true;

    insert into public.administrators (id,school_id,display_name,email,is_active) values
      ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Local Admin','admin@example.test',true)
    on conflict (id) do update set display_name=excluded.display_name,email=excluded.email,is_active=true;

    insert into public.teachers (id,school_id,display_name,email,preferred_language,is_active) values
      ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','English Teacher','teacher.en@example.test','en',true),
      ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','المعلمة العربية','teacher.ar@example.test','ar',true)
    on conflict (id) do update set display_name=excluded.display_name,email=excluded.email,preferred_language=excluded.preferred_language,is_active=true;

    insert into public.administrator_accounts (school_id,administrator_id,profile_id) values
      ('a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001')
    on conflict do nothing;

    insert into public.teacher_accounts (school_id,teacher_id,profile_id) values
      ('a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002'),
      ('a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003')
    on conflict do nothing;
  end if;
end;
$$;

insert into public.groups (id,school_id,name_en,name_ar,is_active) values
  -- seed-group: 01
  ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Beginners','المبتدئون',true),
  -- seed-group: 02
  ('d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Intermediate','المتوسط',true),
  -- seed-group: 03
  ('d0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Advanced','المتقدم',true)
on conflict (id) do update set name_en=excluded.name_en,name_ar=excluded.name_ar,is_active=true;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'group_teachers'
      and column_name = 'teacher_profile_id'
  ) then
    execute $seed$
      insert into public.group_teachers (school_id,group_id,teacher_profile_id,assignment_type) values
        ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','PRIMARY'),
        ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003','PRIMARY'),
        ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002','PRIMARY')
      on conflict (school_id,group_id,teacher_profile_id) do update set assignment_type=excluded.assignment_type
    $seed$;
  else
    insert into public.group_teachers (school_id,group_id,teacher_id,assignment_type) values
      ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','PRIMARY'),
      ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003','PRIMARY'),
      ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002','PRIMARY')
    on conflict (school_id,group_id,teacher_id) do update set assignment_type=excluded.assignment_type;
  end if;
end;
$$;

insert into public.students (id,school_id,first_name_en,last_name_en,first_name_ar,last_name_ar,is_active) values
  -- seed-student: 01
  ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Sara','Ali','سارة','علي',true),
  -- seed-student: 02
  ('e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Omar','Hassan','عمر','حسن',true),
  -- seed-student: 03
  ('e0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Lina','Khalil','لينا','خليل',true),
  -- seed-student: 04
  ('e0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Adam','Saleh','آدم','صالح',true),
  -- seed-student: 05
  ('e0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Maya','Yousef','مايا','يوسف',true),
  -- seed-student: 06
  ('e0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Zayd','Mahmoud','زيد','محمود',true),
  -- seed-student: 07
  ('e0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Nour','Ibrahim','نور','إبراهيم',true),
  -- seed-student: 08
  ('e0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001','Yara','Hamdan','يارا','حمدان',true),
  -- seed-student: 09
  ('e0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000001','Kareem','Nasser','كريم','ناصر',true),
  -- seed-student: 10
  ('e0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000001','Hana','Mustafa','هناء','مصطفى',true),
  -- seed-student: 11
  ('e0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000001','Bilal','Rahman','بلال','رحمن',true),
  -- seed-student: 12
  ('e0000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000001','Amina','Farid','أمينة','فريد',true)
on conflict (id) do update set first_name_en=excluded.first_name_en,last_name_en=excluded.last_name_en,first_name_ar=excluded.first_name_ar,last_name_ar=excluded.last_name_ar,is_active=true;

insert into public.guardians (id,school_id,name,email,report_language,is_active) values
  ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Guardian 01','guardian01@example.test','en',true),
  ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','ولي الأمر 02','guardian02@example.test','ar',true),
  ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Guardian 03','guardian03@example.test','both',true),
  ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Guardian 04','guardian04@example.test','en',true),
  ('f0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','ولي الأمر 05','guardian05@example.test','ar',true),
  ('f0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Guardian 06','guardian06@example.test','both',true),
  ('f0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Guardian 07','guardian07@example.test','en',true),
  ('f0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001','ولي الأمر 08','guardian08@example.test','ar',true),
  ('f0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000001','Guardian 09','guardian09@example.test','both',true),
  ('f0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000001','Guardian 10','guardian10@example.test','en',true),
  ('f0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000001','ولي الأمر 11','guardian11@example.test','ar',true),
  ('f0000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000001','Guardian 12','guardian12@example.test','both',true)
on conflict (id) do update set name=excluded.name,email=excluded.email,report_language=excluded.report_language,is_active=true;

insert into public.student_guardians (school_id,student_id,guardian_id,receives_reports,is_primary)
select 'a0000000-0000-0000-0000-000000000001',
       ('e0000000-0000-0000-0000-' || lpad(number::text,12,'0'))::uuid,
       ('f0000000-0000-0000-0000-' || lpad(number::text,12,'0'))::uuid,
       true,true
from generate_series(1,12) as number
on conflict (school_id,student_id,guardian_id) do update set receives_reports=true,is_primary=true;

insert into public.group_memberships (id,school_id,group_id,student_id,starts_on)
select ('90000000-0000-0000-0000-' || lpad(number::text,12,'0'))::uuid,
       'a0000000-0000-0000-0000-000000000001',
       ('d0000000-0000-0000-0000-' || lpad((((number-1)/4)+1)::text,12,'0'))::uuid,
       ('e0000000-0000-0000-0000-' || lpad(number::text,12,'0'))::uuid,
       date '2026-09-01'
from generate_series(1,12) as number
on conflict (id) do nothing;

insert into public.sessions (id,school_id,group_id,session_date,status,created_by) values
  ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','2026-09-06','DRAFT','c0000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','2026-09-06','DRAFT','c0000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','2026-09-13','DRAFT','c0000000-0000-0000-0000-000000000002')
on conflict (school_id,group_id,session_date) do nothing;

insert into public.group_progress (school_id,session_id,progress_en,progress_ar,default_performance)
select values_to_insert.school_id::uuid,
       values_to_insert.session_id::uuid,
       values_to_insert.progress_en,
       values_to_insert.progress_ar,
       values_to_insert.default_performance::public.performance_level
from (values
  ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Reviewed Arabic letters and short vowels.','راجعنا الحروف العربية والحركات القصيرة.','GOOD'),
  ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Practised reading short sentences.','تدربنا على قراءة الجمل القصيرة.','GOOD'),
  ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Discussed a bilingual story.','ناقشنا قصة باللغتين.','DEVELOPING')
) as values_to_insert(school_id,session_id,progress_en,progress_ar,default_performance)
join public.sessions sessions
  on sessions.school_id = values_to_insert.school_id::uuid
 and sessions.id = values_to_insert.session_id::uuid
 and sessions.status = 'DRAFT'
on conflict (school_id,session_id) do nothing;

insert into public.attendance (school_id,session_id,student_id,status)
select 'a0000000-0000-0000-0000-000000000001',
       case when number<=4 then '10000000-0000-0000-0000-000000000001'::uuid when number<=8 then '10000000-0000-0000-0000-000000000002'::uuid else '10000000-0000-0000-0000-000000000003'::uuid end,
       ('e0000000-0000-0000-0000-' || lpad(number::text,12,'0'))::uuid,
       case when number in (4,8) then 'ABSENT'::public.attendance_status else 'PRESENT'::public.attendance_status end
from generate_series(1,12) as number
where exists (
  select 1
  from public.sessions sessions
  where sessions.id = case when number<=4 then '10000000-0000-0000-0000-000000000001'::uuid when number<=8 then '10000000-0000-0000-0000-000000000002'::uuid else '10000000-0000-0000-0000-000000000003'::uuid end
    and sessions.status = 'DRAFT'
)
on conflict (school_id,session_id,student_id) do nothing;

insert into public.student_progress (school_id,session_id,student_id,performance_override,comment_en,comment_ar)
select values_to_insert.school_id::uuid,
       values_to_insert.session_id::uuid,
       values_to_insert.student_id::uuid,
       values_to_insert.performance_override::public.performance_level,
       values_to_insert.comment_en,
       values_to_insert.comment_ar
from (values ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002','EXCELLENT','Excellent participation this week.','مشاركة ممتازة هذا الأسبوع.'))
  as values_to_insert(school_id,session_id,student_id,performance_override,comment_en,comment_ar)
join public.sessions sessions
  on sessions.school_id = values_to_insert.school_id::uuid
 and sessions.id = values_to_insert.session_id::uuid
 and sessions.status = 'DRAFT'
on conflict (school_id,session_id,student_id) do nothing;

update public.sessions set status = 'SUBMITTED', submitted_at = case id
  when '10000000-0000-0000-0000-000000000001' then '2026-09-06T18:00:00Z'::timestamptz
  when '10000000-0000-0000-0000-000000000002' then '2026-09-06T18:00:00Z'::timestamptz
  when '10000000-0000-0000-0000-000000000003' then '2026-09-13T18:00:00Z'::timestamptz
end
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
)
and status = 'DRAFT';