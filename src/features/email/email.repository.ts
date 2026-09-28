import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';
import {getReport} from '@/features/reports/report.repository';

import {
  renderReportEmail,
  renderReportEmailSubject
} from './report-email';

export async function prepareDeliverableReport(
  schoolId: string,
  reportId: string
) {
  const report = await getReport(schoolId, reportId);

  if (
    !report ||
    !['READY', 'FAILED'].includes(report.status)
  ) {
    return null;
  }

  const db = await createServerSupabaseClient();

  const {data, error} = await db
    .from('student_guardians')
    .select(
      'guardian_id,guardians!inner(is_active,report_language)'
    )
    .eq('school_id', schoolId)
    .eq('student_id', report.studentId)
    .eq('receives_reports', true)
    .eq('guardians.is_active', true)
    .eq('guardians.report_language', report.language);

  if (error) throw error;

  return {
    id: report.id,
    language: report.language,
    subject: renderReportEmailSubject(report.snapshot),
    html: renderReportEmail(report.snapshot),
    recipients: (
      data as Array<{guardian_id: string}>
    ).map(({guardian_id}) => ({
      guardianId: guardian_id
    }))
  };
}

export async function reserveDelivery(
  reportId: string,
  guardianId: string,
  provider: string
) {
  const db = await createServerSupabaseClient();

  const {data, error} = await db.rpc(
    'reserve_report_delivery',
    {
      p_report_id: reportId,
      p_guardian_id: guardianId,
      p_provider: provider
    }
  );

  if (error) throw error;

  const value = data as {
    delivery_id: string;
    should_send: boolean;
    recipient_email: string;
  };

  return {
    deliveryId: value.delivery_id,
    shouldSend: value.should_send,
    recipientEmail: value.recipient_email
  };
}

export async function completeDelivery(
  deliveryId: string,
  result: {
    success: boolean;
    providerMessageId?: string;
    errorMessage?: string;
  }
) {
  const db = await createServerSupabaseClient();

  const {error} = await db.rpc(
    'complete_report_delivery',
    {
      p_delivery_id: deliveryId,
      p_success: result.success,
      p_provider_message_id:
        result.providerMessageId ?? '',
      p_error_message:
        result.errorMessage ?? ''
    }
  );

  if (error) throw error;
}
