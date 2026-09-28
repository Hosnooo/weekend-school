begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

create or replace function pg_temp.statement_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000';
exception
  when others then
    return sqlstate;
end;
$$;

-------------------------------------------------------------------------------
-- Isolated Teaching Update fixture.
--
-- English Teacher:
--   Teacher ID: c000...002
--   Auth user:  b000...002
--
-- Deliberately reconstruct a historical Group-scoped assignment to Group A.
-- Task 1 requires that row to authorize sibling Group B for the same Subject.
-------------------------------------------------------------------------------

insert into public.classes (
  id,
  school_id,
  name_en,
  name_ar
) values (
  '97100000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Teaching Update Draft Test Class',
  'صف اختبار مسودة تحديث التدريس'
);

insert into public.subjects (
  id,
  school_id,
  name_en,
  name_ar
) values (
  '97200000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Teaching Update Draft Test Subject',
  'مادة اختبار مسودة تحديث التدريس'
);

insert into public.class_subjects (
  id,
  school_id,
  class_id,
  subject_id
) values (
  '97300000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97100000-0000-0000-0000-000000000001',
  '97200000-0000-0000-0000-000000000001'
);

insert into public.subject_groups (
  id,
  school_id,
  class_subject_id,
  name_en,
  name_ar
) values
(
  '97400000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '97300000-0000-0000-0000-000000000001',
  'Historical Assignment Group',
  'مجموعة التعيين التاريخي'
),
(
  '97400000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  '97300000-0000-0000-0000-000000000001',
  'Sibling Teaching Group',
  'مجموعة التدريس الشقيقة'
);

alter table public.teaching_assignments
  disable trigger teaching_assignments_subject_only_new_writes;

insert into public.teaching_assignments (
  id,
  school_id,
  teacher_id,
  class_subject_id,
  subject_group_id,
  starts_on
) values (
  '97500000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '97300000-0000-0000-0000-000000000001',
  '97400000-0000-0000-0000-000000000001',
  date '2025-01-01'
);

alter table public.teaching_assignments
  enable trigger teaching_assignments_subject_only_new_writes;

set local role authenticated;
select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000002',
  true
);

-------------------------------------------------------------------------------
-- 1. RANGE creation works against sibling Group authority.
-------------------------------------------------------------------------------

select lives_ok(
  $probe$
    select public.save_teaching_update_draft(
      'c0000000-0000-0000-0000-000000000002',
      null::uuid,
      '97300000-0000-0000-0000-000000000001',
      '97400000-0000-0000-0000-000000000002',
      'RANGE',
      date '2026-04-01',
      date '2026-04-07',
      array[]::date[],
      'Task 3A RANGE marker',
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb,
      null::integer
    )
  $probe$,
  'Teacher can create a RANGE draft for a sibling Group through Subject-wide historical authority'
);

-------------------------------------------------------------------------------
-- 2. RANGE metadata is stored as OPEN/DRAFT version 1.
-------------------------------------------------------------------------------

select ok(
  (
    select
      submission.status = 'DRAFT'
      and submission.coverage_kind = 'RANGE'
      and submission.period_start = date '2026-04-01'
      and submission.period_end = date '2026-04-07'
      and submission.week_start = date '2026-04-01'
      and submission.version = 1
      and submission.teacher_id =
        'c0000000-0000-0000-0000-000000000002'
      and submission.subject_group_id =
        '97400000-0000-0000-0000-000000000002'
    from public.weekly_submissions submission
    where submission.progress_en = 'Task 3A RANGE marker'
  ),
  'RANGE draft stores flexible coverage and optimistic version 1'
);

-------------------------------------------------------------------------------
-- 3. Existing OPEN draft can change to non-consecutive DATES.
-------------------------------------------------------------------------------

select lives_ok(
  $probe$
    select public.save_teaching_update_draft(
      'c0000000-0000-0000-0000-000000000002',
      (
        select id
        from public.weekly_submissions
        where progress_en = 'Task 3A RANGE marker'
      ),
      '97300000-0000-0000-0000-000000000001',
      '97400000-0000-0000-0000-000000000002',
      'DATES',
      date '2026-04-01',
      date '2026-04-22',
      array[
        date '2026-04-01',
        date '2026-04-08',
        date '2026-04-22',
        date '2026-04-08'
      ],
      'Task 3A DATES marker',
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb,
      1
    )
  $probe$,
  'OPEN RANGE draft can be edited into exact non-consecutive DATES'
);

-------------------------------------------------------------------------------
-- 4. DATES are deduplicated, bounds remain exact, version increments.
-------------------------------------------------------------------------------

select ok(
  (
    select
      submission.coverage_kind = 'DATES'
      and submission.period_start = date '2026-04-01'
      and submission.period_end = date '2026-04-22'
      and submission.version = 2
      and (
        select count(*)
        from public.weekly_submission_dates exact_date
        where exact_date.submission_id = submission.id
      ) = 3
      and (
        select array_agg(
          exact_date.covered_on
          order by exact_date.covered_on
        )
        from public.weekly_submission_dates exact_date
        where exact_date.submission_id = submission.id
      ) = array[
        date '2026-04-01',
        date '2026-04-08',
        date '2026-04-22'
      ]
    from public.weekly_submissions submission
    where submission.progress_en = 'Task 3A DATES marker'
  ),
  'DATES draft preserves deduplicated exact dates and increments version'
);

-------------------------------------------------------------------------------
-- 5. Stale optimistic version is rejected.
-------------------------------------------------------------------------------

select is(
  pg_temp.statement_sqlstate(
    $probe$
      select public.save_teaching_update_draft(
        'c0000000-0000-0000-0000-000000000002',
        (
          select id
          from public.weekly_submissions
          where progress_en = 'Task 3A DATES marker'
        ),
        '97300000-0000-0000-0000-000000000001',
        '97400000-0000-0000-0000-000000000002',
        'DATES',
        date '2026-04-01',
        date '2026-04-22',
        array[
          date '2026-04-01',
          date '2026-04-08',
          date '2026-04-22'
        ],
        'stale write must not persist',
        null,
        null,
        '[]'::jsonb,
        '[]'::jsonb,
        1
      )
    $probe$
  ),
  '40001',
  'stale Teaching Update version is rejected'
);

-------------------------------------------------------------------------------
-- 6. Overlapping Teacher-authored updates remain allowed.
-------------------------------------------------------------------------------

select lives_ok(
  $probe$
    select public.save_teaching_update_draft(
      'c0000000-0000-0000-0000-000000000002',
      null::uuid,
      '97300000-0000-0000-0000-000000000001',
      '97400000-0000-0000-0000-000000000002',
      'RANGE',
      date '2026-05-01',
      date '2026-05-07',
      array[]::date[],
      'Task 3A overlap one',
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb,
      null::integer
    );

    select public.save_teaching_update_draft(
      'c0000000-0000-0000-0000-000000000002',
      null::uuid,
      '97300000-0000-0000-0000-000000000001',
      '97400000-0000-0000-0000-000000000002',
      'RANGE',
      date '2026-05-05',
      date '2026-05-12',
      array[]::date[],
      'Task 3A overlap two',
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb,
      null::integer
    )
  $probe$,
  'overlapping Teacher-authored Teaching Updates are permitted'
);

-------------------------------------------------------------------------------
-- 7. Future OPEN Teacher draft is allowed.
-------------------------------------------------------------------------------

select lives_ok(
  $probe$
    select public.save_teaching_update_draft(
      'c0000000-0000-0000-0000-000000000002',
      null::uuid,
      '97300000-0000-0000-0000-000000000001',
      '97400000-0000-0000-0000-000000000002',
      'RANGE',
      date '2099-07-01',
      date '2099-07-31',
      array[]::date[],
      'Task 3A future OPEN marker',
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb,
      null::integer
    )
  $probe$,
  'future Teacher coverage may be saved as an OPEN draft'
);

select * from finish();

rollback;
