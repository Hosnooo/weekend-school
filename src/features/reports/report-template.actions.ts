'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {
  persistenceFailure, saveFailure,
  validationFailure
} from '@/lib/validation/action-state';

import {saveActiveReportTemplate} from './report-template.repository';
import {reportTemplateSchema} from './report-template.schemas';

export async function saveReportTemplateAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';

  const profile = await requireProfile(locale, 'ADMIN');

  const parsed = reportTemplateSchema.safeParse({
    name: formData.get('name'),
    mainReportLabelEn: formData.get('mainReportLabelEn'),
    mainReportLabelAr: formData.get('mainReportLabelAr'),
    mainReportHelpEn: formData.get('mainReportHelpEn'),
    mainReportHelpAr: formData.get('mainReportHelpAr'),
    performanceEnabled: formData.has('performanceEnabled'),
    performanceLabelEn: formData.get('performanceLabelEn'),
    performanceLabelAr: formData.get('performanceLabelAr'),
    studentCommentsEnabled: formData.has('studentCommentsEnabled'),
    studentCommentLabelEn: formData.get('studentCommentLabelEn'),
    studentCommentLabelAr: formData.get('studentCommentLabelAr'),
    studentCommentHelpEn: formData.get('studentCommentHelpEn'),
    studentCommentHelpAr: formData.get('studentCommentHelpAr'),
    introEn: formData.get('introEn'),
    introAr: formData.get('introAr'),
    closingEn: formData.get('closingEn'),
    closingAr: formData.get('closingAr'),
    emailSubjectEn: formData.get('emailSubjectEn'),
    emailSubjectAr: formData.get('emailSubjectAr'),
    emailGreetingEn: formData.get('emailGreetingEn'),
    emailGreetingAr: formData.get('emailGreetingAr'),
    emailMessageEn: formData.get('emailMessageEn'),
    emailMessageAr: formData.get('emailMessageAr'),
    emailClosingEn: formData.get('emailClosingEn'),
    emailClosingAr: formData.get('emailClosingAr'),
    emailSignoffEn: formData.get('emailSignoffEn'),
    emailSignoffAr: formData.get('emailSignoffAr')
  });

  if (!parsed.success) return validationFailure(parsed.success ? undefined : parsed.error);

  try {
    await saveActiveReportTemplate(
      profile.schoolId,
      parsed.data
    );
  } catch (error) {
    console.error('Unable to save report template', {error});
    return persistenceFailure(error);
  }

  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/my-teaching`);
  revalidatePath(`/${locale}/history`);

  redirect(`/${locale}/settings?templateSaved=1`);
}
