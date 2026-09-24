'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {createExportRequest} from '@/features/exports/export.repository';
import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

import {
  archiveStudent,
  getDeleteImpact,
  permanentlyDeleteArchivedStudent,
  restoreArchivedStudent
} from './archive.repository';
import {validatePermanentDeleteRequest} from './archive.service';

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function idFrom(formData: FormData) {
  const parsed = databaseUuid.safeParse(formData.get('id'));
  if (!parsed.success) throw new Error('Invalid archived student');
  return parsed.data;
}

export async function archiveStudentAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  await archiveStudent(idFrom(formData));
  revalidatePath(`/${locale}/students`);
  revalidatePath(`/${locale}/settings/archives`);
}

export async function restoreArchivedStudentAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  await restoreArchivedStudent(idFrom(formData));
  redirect(`/${locale}/settings/archives`);
}

export async function permanentlyDeleteArchivedStudentAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const entityId = idFrom(formData);
  const confirmation = String(formData.get('confirmation') ?? '');
  const impact = await getDeleteImpact(entityId);
  validatePermanentDeleteRequest({entityId, isArchived: impact.isArchived, confirmation});
  await permanentlyDeleteArchivedStudent(entityId, confirmation);
  redirect(`/${locale}/settings/archives`);
}

export async function downloadArchivedStudentDataAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const studentId = idFrom(formData);
  const exportId = await createExportRequest({
    schoolId: profile.schoolId,
    requestedByProfileId: profile.id,
    request: {
      periodStart: null,
      periodEnd: null,
      scope: {type: 'STUDENT', studentId},
      datasets: ['STUDENTS', 'MEMBERSHIPS', 'ATTENDANCE', 'COMMENTS', 'REPORTS', 'DELIVERIES'],
      includeCsv: true,
      includeFinalizedReportPdfs: true
    }
  });
  redirect(`/api/exports/${exportId}`);
}
