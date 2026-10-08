import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

export async function getClassReportPreviewRecipients(
  schoolId: string,
  studentId: string
) {
  const db = await createServerSupabaseClient();
  const {data, error} = await db
    .from('student_guardians')
    .select('guardian_id,guardians!inner(email,is_active)')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('receives_reports', true)
    .eq('guardians.is_active', true);

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const guardian = row.guardians as unknown as
      | {email: string; is_active: boolean}
      | Array<{email: string; is_active: boolean}>
      | null;
    const value = Array.isArray(guardian) ? guardian[0] : guardian;

    return value?.email
      ? [{guardianId: row.guardian_id, email: value.email}]
      : [];
  });
}

export async function canReopenClassReportCycle(
  schoolId: string,
  batchId: string
) {
  const db = await createServerSupabaseClient();
  const {data, error} = await db
    .from('reports')
    .select('id,status,email_deliveries(status)')
    .eq('school_id', schoolId)
    .eq('batch_id', batchId);

  if (error) throw error;
  if (!data || data.length === 0) return false;

  return !data.some((report) =>
    report.status === 'SENT' ||
    (report.email_deliveries ?? []).some(({status}) =>
      status === 'PENDING' ||
      status === 'SENT' ||
      status === 'DELIVERED'
    )
  );
}
