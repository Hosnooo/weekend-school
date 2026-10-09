-- Private local-only acceptance test. NEVER run against production.
-- This script is called solely by the disposable 5642x restore runner.
-- It simulates an authenticated Administrator's request claims, exercises
-- actual SECURITY DEFINER RPCs, and rolls back every mutation.
\set ON_ERROR_STOP on
\set QUIET on

-- Original application tables are fingerprinted before any RPC writes.
CREATE TEMP TABLE _report_rpc_before (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  checksum text NOT NULL
);
DO $$
DECLARE
  tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'report_batches','report_section_approvals','report_section_sources',
    'report_student_overrides','reports','email_deliveries',
    'weekly_submissions','weekly_submission_students','weekly_submission_dates',
    'students','subject_groups','groups'
  ] LOOP
    EXECUTE format(
      'INSERT INTO _report_rpc_before
       SELECT %L, count(*),
              md5(coalesce(string_agg(to_jsonb(t)::text, ''|''
                  ORDER BY to_jsonb(t)::text), ''''))
       FROM public.%I AS t',
      tab, tab
    );
  END LOOP;
END $$;

BEGIN;

DO $$
DECLARE
  actor uuid;
  scope_school uuid;
  saved record;
  new_attended integer;
  changed boolean;
  row_after record;
  cycle record;
  payload jsonb;
  expected_count integer;
  actual_count integer;
  verified_cycles integer := 0;
  verified_reports integer := 0;
  blocked boolean;
  result_count integer;
BEGIN
  -- Role capability must originate in the restored Administrator account
  -- association, NEVER from a display name, email or synthetic role claim.
  SELECT p.auth_user_id, p.school_id
    INTO actor, scope_school
  FROM public.profiles p
  JOIN public.administrator_accounts aa
    ON aa.profile_id = p.id AND aa.school_id = p.school_id
  JOIN public.administrators a
    ON a.id = aa.administrator_id AND a.school_id = aa.school_id
  WHERE p.is_active AND a.is_active
  ORDER BY p.created_at, p.id
  LIMIT 1;

  IF actor IS NULL OR scope_school IS NULL THEN
    RAISE EXCEPTION 'No active Admin account link in private fixture';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF public.current_school_id() IS DISTINCT FROM scope_school
     OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Restored Admin identity did not authorize the RPC';
  END IF;
  IF has_function_privilege('anon',
     'public.save_class_report_review_atomic(uuid,uuid,uuid,text,text,boolean,boolean,jsonb)',
     'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role must not execute Admin save RPC';
  END IF;

  SELECT
    o.id AS override_id, o.student_id, o.attendance_attended,
    o.attendance_total, o.progress_en, o.progress_ar,
    o.performance, o.performance_overridden,
    o.comment_en, o.comment_ar,
    o.comment_en_overridden, o.comment_ar_overridden,
    a.id AS approval_id, a.batch_id, a.class_subject_id, a.subject_group_id
  INTO saved
  FROM public.report_student_overrides o
  JOIN public.report_section_approvals a ON a.id = o.approval_id
  JOIN public.report_batches b ON b.id = a.batch_id
  WHERE b.school_id = scope_school AND b.scope_type = 'CLASS'
    AND b.status = 'DRAFT'
    AND o.attendance_attended IS NOT NULL
    AND o.attendance_total > 0
  ORDER BY b.id, a.id, o.student_id
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No positive-session saved Admin correction in fixture';
  END IF;

  new_attended := CASE
    WHEN saved.attendance_attended < saved.attendance_total
      THEN saved.attendance_attended + 1
    ELSE saved.attendance_attended - 1
  END;

  -- First prove that malformed numeric input aborts the entire RPC without
  -- rewriting the approved bilingual shared text.
  SELECT approved_progress_en, approved_progress_ar
    INTO row_after
  FROM public.report_section_approvals WHERE id = saved.approval_id;
  blocked := false;
  BEGIN
    PERFORM public.save_class_report_review_atomic(
      saved.batch_id, saved.class_subject_id, saved.subject_group_id,
      'UNSAFE_INVALID_EN', 'UNSAFE_INVALID_AR',
      false, true,
      jsonb_build_array(jsonb_build_object(
        'student_id', saved.student_id,
        'progress_en', saved.progress_en,
        'progress_ar', saved.progress_ar,
        'performance', saved.performance,
        'performance_overridden', saved.performance_overridden,
        'comment_en', 'INVALID',
        'comment_ar', 'INVALID',
        'comment_en_overridden', true,
        'comment_ar_overridden', true,
        'attendance_attended', saved.attendance_total + 1,
        'attendance_total', saved.attendance_total
      ))
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'Invalid attendance was not rejected';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.report_section_approvals a
    WHERE a.id = saved.approval_id
      AND (a.approved_progress_en IS DISTINCT FROM row_after.approved_progress_en
        OR a.approved_progress_ar IS DISTINCT FROM row_after.approved_progress_ar)
  ) THEN
    RAISE EXCEPTION 'Rejected edit partially modified shared Admin approval';
  END IF;

  -- Execute REAL atomic Admin save in disposable transaction; verify all
  -- bilingual and numeric fields survived together, not just the return code.
  changed := public.save_class_report_review_atomic(
    saved.batch_id, saved.class_subject_id, saved.subject_group_id,
    'PRIVATE_DRY_RUN_EN', 'PRIVATE_DRY_RUN_AR',
    false, true,
    jsonb_build_array(jsonb_build_object(
      'student_id', saved.student_id,
      'progress_en', saved.progress_en,
      'progress_ar', saved.progress_ar,
      'performance', saved.performance,
      'performance_overridden', saved.performance_overridden,
      'comment_en', 'PRIVATE_DRY_RUN_STUDENT_EN',
      'comment_ar', 'PRIVATE_DRY_RUN_STUDENT_AR',
      'comment_en_overridden', true,
      'comment_ar_overridden', true,
      'attendance_attended', new_attended,
      'attendance_total', saved.attendance_total
    ))
  );
  IF changed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Atomic Admin save returned failure';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.report_section_approvals a
    WHERE a.id = saved.approval_id
      AND a.progress_en_approved AND a.progress_ar_approved
      AND a.approved_progress_en = 'PRIVATE_DRY_RUN_EN'
      AND a.approved_progress_ar = 'PRIVATE_DRY_RUN_AR'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.report_student_overrides o
    WHERE o.id = saved.override_id
      AND o.attendance_attended = new_attended
      AND o.attendance_total = saved.attendance_total
      AND o.comment_en_overridden AND o.comment_ar_overridden
      AND o.comment_en = 'PRIVATE_DRY_RUN_STUDENT_EN'
      AND o.comment_ar = 'PRIVATE_DRY_RUN_STUDENT_AR'
  ) THEN
    RAISE EXCEPTION 'Atomic Admin edit did not persist authoritative fields';
  END IF;

  -- The real finalization function requires REVIEW. Change the draft
  -- statuses only inside this one transaction, never in production.
  UPDATE public.report_batches
  SET status = 'REVIEW'
  WHERE school_id = scope_school
    AND scope_type = 'CLASS' AND status = 'DRAFT';
  GET DIAGNOSTICS result_count = ROW_COUNT;
  IF result_count <> 3 THEN
    RAISE EXCEPTION 'Unexpected draft cycle count in disposable restore';
  END IF;

  FOR cycle IN
    SELECT id, school_id FROM public.report_batches
    WHERE school_id = scope_school AND scope_type = 'CLASS'
      AND status = 'REVIEW'
    ORDER BY id
  LOOP
    -- The application parity suite separately validated the full 29 real
    -- snapshots. For the SQL-RPC contract, use a minimal valid V2 envelope:
    -- this independently tests revision inserts, access, status and rollback.
    SELECT jsonb_agg(jsonb_build_object(
        'student_id', students.student_id,
        'language', 'both',
        'snapshot_json', jsonb_build_object(
          'version', 2,
          'dry_run', true,
          'batch', cycle.id,
          'student', students.student_id
        )
      ))
      INTO payload
    FROM (
      SELECT DISTINCT o.student_id
      FROM public.report_section_approvals a
      JOIN public.report_student_overrides o ON o.approval_id = a.id
      JOIN public.students st ON st.id = o.student_id
      WHERE a.batch_id = cycle.id AND a.school_id = scope_school
        AND st.is_active
    ) students;
    expected_count := jsonb_array_length(coalesce(payload, '[]'::jsonb));
    IF expected_count = 0 THEN
      RAISE EXCEPTION 'No eligible students to finalize in restored cycle';
    END IF;

    actual_count := public.finalize_report_batch(cycle.id, payload);
    IF actual_count <> expected_count THEN
      RAISE EXCEPTION 'Finalization RPC returned incorrect inserted count';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.report_batches
      WHERE id = cycle.id AND status = 'FINALIZED'
    ) THEN
      RAISE EXCEPTION 'Finalization did not transition cycle status';
    END IF;

    IF (
      SELECT count(*) FROM public.reports
      WHERE batch_id = cycle.id AND status = 'READY'
        AND snapshot_version = 2 AND snapshot_json ->> 'dry_run' = 'true'
    ) <> expected_count THEN
      RAISE EXCEPTION 'Real finalized revisions were not inserted correctly';
    END IF;
    verified_cycles := verified_cycles + 1;
    verified_reports := verified_reports + actual_count;
  END LOOP;

  IF verified_cycles <> 3 OR verified_reports <> 29 THEN
    RAISE EXCEPTION 'Unexpected actual finalization count in restored fixture';
  END IF;

  -- A finalized batch must refuse a later Administrator edit.
  blocked := false;
  BEGIN
    PERFORM public.save_class_report_review_atomic(
      saved.batch_id, saved.class_subject_id, saved.subject_group_id,
      'AFTER_FINALIZATION', null, false, false, '[]'::jsonb
    );
  EXCEPTION WHEN SQLSTATE '55000' THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'Admin save was not blocked after actual finalization';
  END IF;

END $$;
\echo PASS: Actual atomic Admin RPC + 3 finalized cycles + 29 saved revisions validated inside disposable transaction

-- Roll back all RPC writes before checking original public-data fingerprints.
ROLLBACK;

DO $$
DECLARE
  original record;
  n bigint;
  hash text;
BEGIN
  FOR original IN SELECT * FROM _report_rpc_before LOOP
    EXECUTE format(
      'SELECT count(*),
              md5(coalesce(string_agg(to_jsonb(t)::text, ''|''
                   ORDER BY to_jsonb(t)::text), ''''))
       FROM public.%I AS t',
      original.table_name
    ) INTO n, hash;
    IF n <> original.row_count OR hash IS DISTINCT FROM original.checksum THEN
      RAISE EXCEPTION 'Disposable rollback did not restore table %', original.table_name;
    END IF;
  END LOOP;
END $$;
\echo PASS: Transaction rollback restored all protected report, Teacher and school rows unchanged
