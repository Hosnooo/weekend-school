begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

-------------------------------------------------------------------------------
-- Isolated Admin Teaching Updates fixture.
-------------------------------------------------------------------------------

insert into public.classes (
  id,
  school_id,
  name_en,
  name_ar
) values (
  '98100000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Admin Teaching Update Test Class',
  'صف اختبار تحديثات الإدارة'
);

insert into public.subjects (
  id,
  school_id,
  name_en,
  name_ar
) values (
  '98200000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Admin Teaching Update Test Subject',
  'مادة اختبار تحديثات الإدارة'
);

insert into public.class_subjects (
  id,
  school_id,
  class_id,
  subject_id
) values (
  '98300000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '98100000-0000-0000-0000-000000000001',
  '98200000-0000-0000-0000-000000000001'
);

insert into public.subject_groups (
  id,
  school_id,
  class_subject_id,
  name_en,
  name_ar
) values
(
  '98400000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '98300000-0000-0000-0000-000000000001',
  'Admin Request Group A',
  'مجموعة طلب الإدارة أ'
),
(
  '98400000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  '98300000-0000-0000-0000-000000000001',
  'Admin Request Group B',
  'مجموعة طلب الإدارة ب'
);

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '98500000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '98300000-0000-0000-0000-000000000001',
  null,
  date '2025-01-01'
);

-------------------------------------------------------------------------------
-- Act as seeded Administrator.
-------------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

-------------------------------------------------------------------------------
-- Create Admin Subject request.
-------------------------------------------------------------------------------

create temporary table pg_temp.test_request_set (
  id uuid primary key
);

insert into pg_temp.test_request_set (id)
select public.request_teaching_update(
  '98300000-0000-0000-0000-000000000001',
  'RANGE',
  date '2026-08-01',
  date '2026-08-31',
  null::date[],
  'Admin August request'
);

-------------------------------------------------------------------------------
-- 1. Two active Groups create exactly two snapshotted request items.
-------------------------------------------------------------------------------

select is(
  (
    select count(*)::integer
    from public.weekly_submissions submission
    where submission.request_set_id = (
      select id from pg_temp.test_request_set
    )
  ),
  2,
  'Admin Subject request snapshots one item per active Group'
);

-------------------------------------------------------------------------------
-- 2. Request items remain unclaimed OPEN sources initially.
-------------------------------------------------------------------------------

select is(
  (
    select count(*)::integer
    from public.weekly_submissions submission
    where submission.request_set_id = (
      select id from pg_temp.test_request_set
    )
      and submission.status = 'DRAFT'
      and submission.teacher_id is null
  ),
  2,
  'Admin request items begin OPEN and unclaimed'
);


-------------------------------------------------------------------------------
-- Assigned Teachers can see/open unclaimed Admin-request items.
-------------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);

select is(
  (
    select count(*)::integer
    from public.weekly_submissions submission
    where submission.request_set_id = (
      select id from pg_temp.test_request_set
    )
      and submission.status = 'DRAFT'
  ),
  2,
  'assigned Teacher can see every OPEN item in the shared Admin request'
);

select is(
  (
    select count(*)::integer
    from public.get_weekly_submission_context(
      (
        select submission.id
        from public.weekly_submissions submission
        where submission.request_set_id = (
          select id from pg_temp.test_request_set
        )
        order by submission.subject_group_id
        limit 1
      )
    )
  ),
  1,
  'assigned Teacher can open context for an unclaimed Admin-request item'
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

-------------------------------------------------------------------------------
-- Add a new Group after request creation.
-------------------------------------------------------------------------------

reset role;

insert into public.subject_groups (
  id,
  school_id,
  class_subject_id,
  name_en,
  name_ar
) values (
  '98400000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  '98300000-0000-0000-0000-000000000001',
  'Later Group C',
  'المجموعة ج اللاحقة'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

-------------------------------------------------------------------------------
-- 3. Later Groups do not silently expand the request set.
-------------------------------------------------------------------------------

select is(
  (
    select count(*)::integer
    from public.weekly_submissions submission
    where submission.request_set_id = (
      select id from pg_temp.test_request_set
    )
  ),
  2,
  'later Groups do not change an existing request-set snapshot'
);

-------------------------------------------------------------------------------
-- Dismiss one OPEN Admin request item.
-------------------------------------------------------------------------------

create temporary table pg_temp.dismiss_target (
  id uuid primary key,
  version integer not null
);

insert into pg_temp.dismiss_target (id, version)
select
  submission.id,
  submission.version
from public.weekly_submissions submission
where submission.request_set_id = (
  select id from pg_temp.test_request_set
)
order by submission.subject_group_id
limit 1;

select lives_ok(
  $probe$
    select public.dismiss_teaching_update(
      (select id from pg_temp.dismiss_target),
      'No update required for this Group',
      (select version from pg_temp.dismiss_target)
    )
  $probe$,
  'Administrator may dismiss an OPEN Teaching Update'
);

-------------------------------------------------------------------------------
-- 4. Dismissal is persisted with audit information.
-------------------------------------------------------------------------------

select ok(
  (
    select
      submission.status = 'DISMISSED'
      and submission.dismissed_at is not null
      and submission.dismissed_by_profile_id =
        'c0000000-0000-0000-0000-000000000001'
      and submission.dismissal_reason =
        'No update required for this Group'
    from public.weekly_submissions submission
    where submission.id = (
      select id from pg_temp.dismiss_target
    )
  ),
  'Admin dismissal stores status, actor, time, and reason'
);

-------------------------------------------------------------------------------
-- 5. Request-set completion source counts remain based on its two items.
-------------------------------------------------------------------------------

select results_eq(
  $probe$
    select
      count(*)::integer as total_count,
      count(*) filter (
        where submission.status = 'DRAFT'
      )::integer as open_count,
      count(*) filter (
        where submission.status = 'SUBMITTED'
      )::integer as submitted_count,
      count(*) filter (
        where submission.status = 'DISMISSED'
      )::integer as dismissed_count
    from public.weekly_submissions submission
    where submission.request_set_id = (
      select id from pg_temp.test_request_set
    )
  $probe$,
  $expected$
    values (2, 1, 0, 1)
  $expected$,
  'request-set progress derives from the original snapshotted items'
);

-------------------------------------------------------------------------------
-- Prepare a submitted source for Admin reopen behavior.
-------------------------------------------------------------------------------

reset role;

insert into public.weekly_submissions (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  week_start,
  coverage_kind,
  period_start,
  period_end,
  status,
  progress_en,
  version,
  submitted_at
) values (
  '98600000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '98300000-0000-0000-0000-000000000001',
  '98400000-0000-0000-0000-000000000001',
  date '2026-07-01',
  'RANGE',
  date '2026-07-01',
  date '2026-07-07',
  'SUBMITTED',
  'Submitted source for Admin reopen',
  1,
  now()
);

set local role authenticated;

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);

-------------------------------------------------------------------------------
-- 6. Administrator can reopen an eligible submitted Teaching Update.
-------------------------------------------------------------------------------

select is(
  public.reopen_weekly_submission(
    '98600000-0000-0000-0000-000000000001'
  ),
  true,
  'Administrator may reopen an eligible submitted Teaching Update'
);

-------------------------------------------------------------------------------
-- 7. Reopen returns the source to OPEN/DRAFT rather than deleting history.
-------------------------------------------------------------------------------

select ok(
  (
    select
      submission.status = 'DRAFT'
      and submission.id =
        '98600000-0000-0000-0000-000000000001'
    from public.weekly_submissions submission
    where submission.id =
      '98600000-0000-0000-0000-000000000001'
  ),
  'reopen preserves the source row and returns it to OPEN'
);

select * from finish();

rollback;
