import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

type ReportRow = {
  id: string;
  batch_id: string;
  student_id: string;
  period_start: string;
  period_end: string;
  status: 'READY' | 'FAILED' | 'SENT';
  language: 'en' | 'ar' | 'both';
  students: {
    first_name_en: string;
    last_name_en: string;
    first_name_ar: string | null;
    last_name_ar: string | null;
  } | null;
};

type GuardianLink = {
  student_id: string;
  guardian_id: string;
  guardians: {
    is_active: boolean;
    email: string;
    report_language: 'en' | 'ar' | 'both';
  } | null;
};

type DeliveryRow = {
  student_id: string;
  guardian_id: string;
  period_start: string;
  period_end: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
};

export type DeliveryAttention = {
  reportId: string;
  batchId: string;
  studentNameEn: string;
  studentNameAr: string | null;
  periodStart: string;
  periodEnd: string;
  reason: 'NO_RECIPIENT' | 'FAILED' | 'PENDING' | 'NOT_SENT';
};

export type RecipientReadiness = {
  reportCount: number;
  eligibleReports: number;
  readyEmails: number;
  alreadySent: number;
  pendingReview: number;
  missing: DeliveryAttention[];
  attention: DeliveryAttention[];
};

export function computeRecipientReadiness(
  reports: ReportRow[],
  links: GuardianLink[],
  deliveries: DeliveryRow[]
): RecipientReadiness {
  const result: RecipientReadiness = {
    reportCount: reports.length,
    eligibleReports: 0, readyEmails: 0, alreadySent: 0,
    pendingReview: 0, missing: [], attention: []
  };
  const key = (studentId: string, start: string, end: string, guardianId: string) =>
    [studentId, start, end, guardianId].join(':');
  const sentState = new Map(deliveries.map(delivery =>
    [key(delivery.student_id, delivery.period_start, delivery.period_end, delivery.guardian_id), delivery.status]
  ));

  for (const report of reports) {
    if (!report.students) continue;
    const issue = (reason: DeliveryAttention['reason']): DeliveryAttention => ({
      reportId: report.id, batchId: report.batch_id,
      studentNameEn: report.students!.first_name_en + ' ' + report.students!.last_name_en,
      studentNameAr: report.students!.first_name_ar && report.students!.last_name_ar
        ? report.students!.first_name_ar + ' ' + report.students!.last_name_ar : null,
      periodStart: report.period_start, periodEnd: report.period_end, reason
    });
    const guardians = links.filter(link =>
      link.student_id === report.student_id &&
      link.guardians?.is_active &&
      Boolean(link.guardians.email?.trim()) &&
      (report.language === 'both' || report.language === link.guardians.report_language)
    );
    if (guardians.length === 0) {
      const missing = issue('NO_RECIPIENT');
      result.missing.push(missing);
      result.attention.push(missing);
      continue;
    }
    result.eligibleReports++;
    let failed = false, pending = false, notSent = false;
    for (const guardian of guardians) {
      const status = sentState.get(key(report.student_id, report.period_start, report.period_end, guardian.guardian_id));
      if (status === 'SENT' || status === 'DELIVERED') {
        result.alreadySent++;
      } else if (status === 'PENDING') {
        result.pendingReview++;
        pending = true;
      } else if (report.status !== 'SENT') {
        result.readyEmails++;
        if (status === 'FAILED' || status === 'BOUNCED') failed = true;
        else notSent = true;
      }
    }
    if (failed || report.status === 'FAILED') result.attention.push(issue('FAILED'));
    else if (pending) result.attention.push(issue('PENDING'));
    else if (notSent) result.attention.push(issue('NOT_SENT'));
  }
  return result;
}

export async function getRecipientReadiness(
  schoolId: string, filter: {batchId?: string; reportId?: string} = {}
): Promise<RecipientReadiness> {
  const db = await createServerSupabaseClient();
  let query = db.from('reports')
    .select('id,batch_id,student_id,period_start,period_end,status,language,students(first_name_en,last_name_en,first_name_ar,last_name_ar),report_batches!inner(status)')
    .eq('school_id', schoolId)
    .eq('report_batches.status', 'FINALIZED')
    .in('status', ['READY','FAILED','SENT'])
    .order('generated_at', {ascending: false});
  if (filter.batchId) query = query.eq('batch_id', filter.batchId);
  if (filter.reportId) query = query.eq('id', filter.reportId);
  const {data, error} = await query;
  if (error) throw error;
  const reports = (data ?? []) as unknown as ReportRow[];
  if (reports.length === 0) {
    return computeRecipientReadiness([], [], []);
  }
  const studentIds = [...new Set(reports.map(report => report.student_id))];
  const [guardianResult, deliveryResult] = await Promise.all([
    db.from('student_guardians')
      .select('student_id,guardian_id,guardians!inner(is_active,email,report_language)')
      .eq('school_id', schoolId).eq('receives_reports', true).in('student_id', studentIds),
    db.from('email_deliveries')
      .select('student_id,guardian_id,period_start,period_end,status')
      .eq('school_id', schoolId).in('student_id', studentIds)
  ]);
  if (guardianResult.error) throw guardianResult.error;
  if (deliveryResult.error) throw deliveryResult.error;
  return computeRecipientReadiness(
    reports,
    (guardianResult.data ?? []) as unknown as GuardianLink[],
    (deliveryResult.data ?? []) as DeliveryRow[]
  );
}
