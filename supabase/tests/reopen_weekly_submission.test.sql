begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into public.classes (
  id, school_id, name_en, starts_on, is_active
) values (
  '97000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Reopen Test Class',
  date '2026-09-01',
  true
);

insert into public.subjects (
  id, school_id, name_en, is_active
) values (
  '97100000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Reopen Test Subject',
  true
);

insert into public.class_subjects (
  id, school_id, class_id, subject_id, is_active
) values (
  '97200000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97000000-0000-4000-8000-000000000001',
  '97100000-0000-4000-8000-000000000001',
  true
);

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '97300000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '97200000-0000-4000-8000-000000000001',
  null,
  date '2026-09-01'
);

insert into public.weekly_submissions (
  id,
  school_id,
  class_subject_id,
  subject_group_id,
  teacher_id,
  week_start,
  status,
  progress_en,
  default_performance,
  submitted_at
) values (
  '97400000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97200000-0000-4000-8000-000000000001',
  null,
  'c0000000-0000-0000-0000-000000000002',
  date '2026-09-21',
  'SUBMITTED',
  'Original teacher wording',
  'GOOD',
  now()
);

-- Legacy/in-progress REVIEW batch using this source.
insert into public.report_batches (
  id,
  school_id,
  scope_type,
  class_id,
  class_subject_id,
  subject_group_id,
  period_start,
  period_end,
  status,
  created_by_profile_id
) values (
  '97500000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'SUBJECT',
  '97000000-0000-4000-8000-000000000001',
  '97200000-0000-4000-8000-000000000001',
  null,
  date '2026-09-21',
  date '2026-09-27',
  'REVIEW',
  'c0000000-0000-0000-0000-000000000001'
);

insert into public.report_section_approvals (
  id,
  school_id,
  batch_id,
  class_subject_id,
  subject_group_id,
  approved_progress_en,
  performance
) values (
  '97600000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97500000-0000-4000-8000-000000000001',
  '97200000-0000-4000-8000-000000000001',
  null,
  'Original teacher wording',
  'GOOD'
);

insert into public.report_section_sources (
  id,
  school_id,
  approval_id,
  weekly_submission_id
) values (
  '97700000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97600000-0000-4000-8000-000000000001',
  '97400000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);

select lives_ok(
  $$select public.reopen_weekly_submission(
    '97400000-0000-4000-8000-000000000001'
  )$$,
  'Teacher can reopen a submission used only by unfinished reports'
);

reset role;

select results_eq(
  $$select status::text
    from public.weekly_submissions
    where id = '97400000-0000-4000-8000-000000000001'$$,
  array['DRAFT'::text],
  'reopened submission becomes editable Draft'
);

select results_eq(
  $$select count(*)::bigint
    from public.report_section_approvals
    where id = '97600000-0000-4000-8000-000000000001'$$,
  array[0::bigint],
  'unfinished approval using reopened work is invalidated'
);

select results_eq(
  $$select status
    from public.report_batches
    where id = '97500000-0000-4000-8000-000000000001'$$,
  array['DRAFT'::text],
  'legacy Review batch returns to editable Draft state'
);

-- Re-submit the same Teacher work and attach it to a finalized report.
update public.weekly_submissions
set
  status = 'SUBMITTED',
  submitted_at = now()
where id = '97400000-0000-4000-8000-000000000001';

insert into public.report_batches (
  id,
  school_id,
  scope_type,
  class_id,
  class_subject_id,
  subject_group_id,
  period_start,
  period_end,
  status,
  created_by_profile_id,
  finalized_at
) values (
  '97800000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'SUBJECT',
  '97000000-0000-4000-8000-000000000001',
  '97200000-0000-4000-8000-000000000001',
  null,
  date '2026-09-21',
  date '2026-09-27',
  'FINALIZED',
  'c0000000-0000-0000-0000-000000000001',
  now()
);

insert into public.report_section_approvals (
  id,
  school_id,
  batch_id,
  class_subject_id,
  subject_group_id,
  approved_progress_en,
  performance
) values (
  '97900000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97800000-0000-4000-8000-000000000001',
  '97200000-0000-4000-8000-000000000001',
  null,
  'Final wording',
  'GOOD'
);

insert into public.report_section_sources (
  id,
  school_id,
  approval_id,
  weekly_submission_id
) values (
  '98000000-0000-4000-8000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97900000-0000-4000-8000-000000000001',
  '97400000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$select public.reopen_weekly_submission(
    '97400000-0000-4000-8000-000000000001'
  )$$,
  '55000',
  'finalized report already uses this submission',
  'finalized parent report locks its Teacher source'
);

reset role;

select results_eq(
  $$select status::text
    from public.weekly_submissions
    where id = '97400000-0000-4000-8000-000000000001'$$,
  array['SUBMITTED'::text],
  'finalized source stays submitted and unchanged'
);

select * from finish();
rollback;
