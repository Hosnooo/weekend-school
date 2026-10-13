'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {completeDelivery, prepareDeliverableReport, reserveDelivery} from '@/features/email/email.repository';
import {sendReportDeliveries} from '@/features/email/email.service';
import {createConfiguredBrevoProvider} from '@/features/email/configured-brevo.provider';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {getEmailEnv} from '@/lib/env/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';

import {getRecipientReadiness} from './recipient-delivery.repository';
import {reportPeriodSchema} from './report.schemas';

async function sendOne(schoolId: string, reportId: string) {
  const report = await prepareDeliverableReport(schoolId, reportId);
  if (!report) return null;
  const env = getEmailEnv();
  return sendReportDeliveries(
    report,
    createConfiguredBrevoProvider(env.brevoApiKey, env.emailFrom),
    {reserveDelivery, completeDelivery}
  );
}

export async function sendAdminReportBatchAction(formData: FormData) {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = databaseUuid.safeParse(formData.get('batchId'));
  const period = reportPeriodSchema.safeParse({
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd')
  });
  if (!batchId.success || !period.success)
    redirect('/' + locale + '/reports?error=validation');

  const destination = formData.get('returnTo') === 'queue'
    ? '/' + locale + '/reports'
    : '/' + locale + '/reports/workspace/' + batchId.data;
  const prefix = '?periodStart=' + period.data.periodStart +
    '&periodEnd=' + period.data.periodEnd;

  let sent = 0, failed = 0, skipped = 0, missing = 0, already = 0, pending = 0;
  let reason: string | null = null;

  try {
    const readiness = await getRecipientReadiness(profile.schoolId, {batchId:batchId.data});
    missing = readiness.missing.length;
    if (readiness.readyEmails === 0) reason = 'noRecipients';
    else if (missing > 0 && formData.get('ackMissing') !== 'yes') reason = 'confirmRecipients';

    if (!reason) {
      const db = await createServerSupabaseClient();
      const {data,error} = await db.from('reports')
        .select('id').eq('school_id',profile.schoolId).eq('batch_id',batchId.data)
        .in('status',['READY','FAILED']).order('generated_at');
      if (error) throw error;
      for (const row of data ?? []) {
        const result = await sendOne(profile.schoolId, row.id);
        if (!result) continue;
        sent += result.sent;
        failed += result.failed;
        skipped += result.skipped;
        already += result.alreadySent;
        pending += result.pendingReview;
      }
    }
  } catch (error) {
    console.error('Guardian report delivery failure', {error});
    reason = 'send';
  }

  if (reason) redirect(destination + prefix + '&error=' + reason);
  revalidatePath('/' + locale + '/reports');
  revalidatePath('/' + locale + '/reports/workspace/' + batchId.data);
  revalidatePath('/' + locale + '/reports/delivery-status');
  redirect(destination + prefix + '&sent=' + sent + '&failed=' + failed +
    '&skipped=' + skipped + '&missing=' + missing + '&already=' + already +
    '&pending=' + pending);
}

export async function sendAdminSingleReportAction(formData: FormData) {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const profile = await requireProfile(locale, 'ADMIN');
  const id = databaseUuid.safeParse(formData.get('reportId'));
  const destination = '/' + locale + '/reports/delivery-status';
  if (!id.success) redirect(destination + '?error=validation');

  let reason: string | null = null;
  let sent = 0, failed = 0, already = 0, pending = 0;
  try {
    const readiness = await getRecipientReadiness(profile.schoolId, {reportId:id.data});
    if (readiness.reportCount !== 1 || readiness.readyEmails === 0) {
      reason = 'noRecipients';
    } else {
      const result = await sendOne(profile.schoolId, id.data);
      sent = result?.sent ?? 0;
      failed = result?.failed ?? 0;
      already = result?.alreadySent ?? 0;
      pending = result?.pendingReview ?? 0;
    }
  } catch (error) {
    console.error('Individual guardian report delivery failure', {error});
    reason = 'send';
  }
  revalidatePath(destination);
  revalidatePath('/' + locale + '/reports');
  if (reason) redirect(destination + '?error=' + reason);
  redirect(destination + '?sent=' + sent + '&failed=' + failed +
    '&already=' + already + '&pending=' + pending);
}
