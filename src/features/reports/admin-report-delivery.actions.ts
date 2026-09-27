'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {
  completeDelivery,
  prepareDeliverableReport,
  reserveDelivery
} from '@/features/email/email.repository';
import {sendReportDeliveries} from '@/features/email/email.service';
import {createConfiguredBrevoProvider} from '@/features/email/configured-brevo.provider';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {getEmailEnv} from '@/lib/env/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';

import {reportPeriodSchema} from './report.schemas';

async function sendOne(
  schoolId: string,
  reportId: string
) {
  const report = await prepareDeliverableReport(
    schoolId,
    reportId
  );

  if (!report) {
    return {
      attempted: 0,
      sent: 0,
      skipped: 1,
      failed: 0
    };
  }

  const env = getEmailEnv();

  return sendReportDeliveries(
    report,
    createConfiguredBrevoProvider(
      env.brevoApiKey,
      env.emailFrom
    ),
    {
      reserveDelivery,
      completeDelivery
    }
  );
}

export async function sendAdminReportBatchAction(
  formData: FormData
) {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const profile = await requireProfile(locale, 'ADMIN');

  const batchId = databaseUuid.safeParse(
    formData.get('batchId')
  );

  const period = reportPeriodSchema.safeParse({
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd')
  });

  if (!batchId.success || !period.success) {
    redirect(`/${locale}/reports?error=validation`);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const db = await createServerSupabaseClient();

    const {data, error} = await db
      .from('reports')
      .select('id,status')
      .eq('school_id', profile.schoolId)
      .eq('batch_id', batchId.data)
      .in('status', ['READY', 'FAILED'])
      .order('generated_at');

    if (error) throw error;

    for (const report of data ?? []) {
      const result = await sendOne(
        profile.schoolId,
        report.id
      );

      sent += result.sent;
      failed += result.failed;
      skipped += result.skipped;
    }
  } catch (error) {
    console.error('Unable to send report context', {error});

    redirect(
      `/${locale}/reports?periodStart=${period.data.periodStart}` +
        `&periodEnd=${period.data.periodEnd}` +
        `&batchId=${batchId.data}&error=send`
    );
  }

  revalidatePath(`/${locale}/reports`);
  revalidatePath(`/${locale}/reports/delivery-status`);

  redirect(
    `/${locale}/reports?periodStart=${period.data.periodStart}` +
      `&periodEnd=${period.data.periodEnd}` +
      `&batchId=${batchId.data}` +
      `&sent=${sent}&failed=${failed}&skipped=${skipped}`
  );
}
