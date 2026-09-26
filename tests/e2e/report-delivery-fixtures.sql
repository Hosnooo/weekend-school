-- Local E2E-only report/delivery fixtures.
-- Never load this into hosted Supabase.

with fixtures (
  report_id,
  student_id,
  student_name_en,
  student_name_ar,
  language,
  report_status,
  generated_at,
  sent_at
) as (
  values
    (
      '70000000-0000-0000-0000-000000000001'::uuid,
      'e0000000-0000-0000-0000-000000000001'::uuid,
      'Sara Ali',
      'سارة علي',
      'en',
      'READY',
      '2026-09-26T08:00:00Z'::timestamptz,
      null::timestamptz
    ),
    (
      '70000000-0000-0000-0000-000000000002'::uuid,
      'e0000000-0000-0000-0000-000000000002'::uuid,
      'Omar Hassan',
      'عمر حسن',
      'ar',
      'SENT',
      '2026-09-26T09:00:00Z'::timestamptz,
      '2026-09-26T09:05:00Z'::timestamptz
    ),
    (
      '70000000-0000-0000-0000-000000000003'::uuid,
      'e0000000-0000-0000-0000-000000000003'::uuid,
      'Lina Khalil',
      'لينا خليل',
      'en',
      'FAILED',
      '2026-09-26T10:00:00Z'::timestamptz,
      null::timestamptz
    )
)
insert into public.reports (
  id,
  school_id,
  student_id,
  period_start,
  period_end,
  language,
  status,
  snapshot_json,
  generated_at,
  sent_at,
  revision,
  snapshot_version
)
select
  report_id,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  student_id,
  '2026-09-01'::date,
  '2026-09-30'::date,
  language::public.report_language,
  report_status::public.report_status,
  jsonb_build_object(
    'version', 1,
    'school', jsonb_build_object(
      'nameEn', 'Weekend School',
      'nameAr', 'مدرسة نهاية الأسبوع'
    ),
    'student', jsonb_build_object(
      'id', student_id,
      'nameEn', student_name_en,
      'nameAr', student_name_ar
    ),
    'period', jsonb_build_object(
      'start', '2026-09-01',
      'end', '2026-09-30'
    ),
    'language', language,
    'groups', jsonb_build_array(
      jsonb_build_object(
        'id', '14000000-0000-0000-0000-000000000001',
        'nameEn', 'Blue',
        'nameAr', 'الأزرق'
      )
    ),
    'attendance', jsonb_build_object(
      'present', 3,
      'absent', 1,
      'late', 0,
      'excused', 0,
      'sessions', 4
    ),
    'progress', jsonb_build_array(
      jsonb_build_object(
        'sessionDate', '2026-09-07',
        'groupNameEn', 'Blue',
        'groupNameAr', 'الأزرق',
        'textEn', 'Reviewed the September learning objectives.',
        'textAr', 'تمت مراجعة أهداف التعلم لشهر سبتمبر.'
      )
    ),
    'currentPerformance', 'GOOD',
    'comments', jsonb_build_array(),
    'generatedAt', generated_at
  ),
  generated_at,
  sent_at,
  1,
  1
from fixtures
on conflict (id) do update set
  status = excluded.status,
  snapshot_json = excluded.snapshot_json,
  generated_at = excluded.generated_at,
  sent_at = excluded.sent_at;

insert into public.email_deliveries (
  id,
  school_id,
  report_id,
  student_id,
  period_start,
  period_end,
  guardian_id,
  recipient_email,
  provider,
  status,
  error_message,
  sent_at
) values
  (
    '71000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    '2026-09-01',
    '2026-09-30',
    'f0000000-0000-0000-0000-000000000001',
    'guardian01@example.test',
    'e2e',
    'PENDING',
    null,
    null
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000002',
    '2026-09-01',
    '2026-09-30',
    'f0000000-0000-0000-0000-000000000001',
    'guardian01@example.test',
    'e2e',
    'SENT',
    null,
    '2026-09-26T09:05:00Z'
  ),
  (
    '71000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000003',
    '2026-09-01',
    '2026-09-30',
    'f0000000-0000-0000-0000-000000000001',
    'guardian01@example.test',
    'e2e',
    'FAILED',
    'Test delivery failure',
    null
  )
on conflict on constraint email_deliveries_logical_recipient_key
do update set
  report_id = excluded.report_id,
  recipient_email = excluded.recipient_email,
  provider = excluded.provider,
  status = excluded.status,
  error_message = excluded.error_message,
  sent_at = excluded.sent_at;
