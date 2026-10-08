'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {persistenceFailure, saveFailure, validationFailure} from '@/lib/validation/action-state';

import {updateSchoolSettings} from './school-settings.repository';
import {schoolSettingsSchema} from './school-settings.schemas';

export async function updateSchoolSettingsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = schoolSettingsSchema.safeParse({
    nameEn: formData.get('nameEn'),
    nameAr: formData.get('nameAr'),
    timezone: formData.get('timezone'),
    defaultLanguage: formData.get('defaultLanguage')
  });
  if (!parsed.success) return validationFailure(parsed.success ? undefined : parsed.error);
  try {
    await updateSchoolSettings(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to update school settings', {error});
    return persistenceFailure(error);
  }
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/settings`);
  redirect(`/${locale}/settings?saved=1`);
}
