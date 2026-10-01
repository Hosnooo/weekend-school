'use server';

import type {SupabaseClient} from '@supabase/supabase-js';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';

import {setClassReportCycleSourceIncluded} from './class-report-review.repository';

function localeFrom(formData: FormData): Locale {
  const raw = String(formData.get('locale') ?? 'en');
  return isLocale(raw) ? raw : 'en';
}

export async function setClassReportCycleSourceIncludedAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const batchId = databaseUuid.safeParse(formData.get('batchId'));
  const submissionId = databaseUuid.safeParse(
    formData.get('submissionId')
  );
  const included = String(formData.get('included') ?? '') === 'true';

  if (!batchId.success || !submissionId.success) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    if (included) {
      const db =
        (await createServerSupabaseClient()) as unknown as SupabaseClient;
      const {error} = await db.rpc('set_report_cycle_source_included', {
        p_batch_id: batchId.data,
        p_submission_id: submissionId.data,
        p_included: true
      });
      if (error) throw error;
    } else {
      await setClassReportCycleSourceIncluded({
        batchId: batchId.data,
        submissionId: submissionId.data,
        included: false
      });
    }
  } catch (error) {
    console.error('Unable to change Report Cycle source selection', {error});
    redirect(
      `/${locale}/reports/workspace/${batchId.data}?error=save`
    );
  }

  revalidatePath(`/${locale}/reports/workspace/${batchId.data}`);
  redirect(`/${locale}/reports/workspace/${batchId.data}`);
}
