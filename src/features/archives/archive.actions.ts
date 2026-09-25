'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {createExportRequest} from '@/features/exports/export.repository';
import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

import {
  archiveManagedEntity,
  archiveStudent,
  getDeleteImpact,
  permanentlyDeleteArchivedStudent,
  permanentlyDeleteManagedEntity,
  restoreArchivedStudent,
  restoreManagedEntity,
  type ManagedArchiveEntityType
} from './archive.repository';
import {validatePermanentDeleteRequest} from './archive.service';

const managedEntitySchema = z.enum(['TEACHER', 'GUARDIAN', 'CLASS', 'SUBJECT', 'GROUP']);

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function idFrom(formData: FormData) {
  const parsed = databaseUuid.safeParse(formData.get('id'));
  if (!parsed.success) throw new Error('Invalid archived record');
  return parsed.data;
}

function managedEntityFrom(formData: FormData): ManagedArchiveEntityType {
  const parsed = managedEntitySchema.safeParse(formData.get('entityType'));
  if (!parsed.success) throw new Error('Invalid archived record type');
  return parsed.data;
}

function revalidateLifecycle(locale: Locale) {
  for (const path of ['archives', 'teachers', 'guardians', 'classes', 'teaching-assignments']) {
    revalidatePath(`/${locale}/${path}`);
  }
}

export async function archiveStudentAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  await archiveStudent(idFrom(formData));
  revalidatePath(`/${locale}/students`);
  revalidatePath(`/${locale}/archives`);
}

export async function restoreArchivedStudentAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  await restoreArchivedStudent(idFrom(formData));
  revalidatePath(`/${locale}/students`);
  revalidatePath(`/${locale}/archives`);
  redirect(`/${locale}/archives`);
}

export async function permanentlyDeleteArchivedStudentAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const entityId = idFrom(formData);
  const confirmation = String(formData.get('confirmation') ?? '');
  const impact = await getDeleteImpact(entityId);
  validatePermanentDeleteRequest({entityId, isArchived: impact.isArchived, confirmation});
  await permanentlyDeleteArchivedStudent(entityId, confirmation);
  redirect(`/${locale}/archives`);
}

export async function archiveManagedEntityAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const entityType = managedEntityFrom(formData);
  const entityId = idFrom(formData);
  await archiveManagedEntity(entityType, entityId);
  revalidateLifecycle(locale);
}

export async function restoreManagedEntityAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  await restoreManagedEntity(managedEntityFrom(formData), idFrom(formData));
  revalidateLifecycle(locale);
  redirect(`/${locale}/archives`);
}

export async function permanentlyDeleteManagedEntityAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const entityType = managedEntityFrom(formData);
  const entityId = idFrom(formData);
  const confirmation = String(formData.get('confirmation') ?? '');
  if (confirmation !== `DELETE ${entityId}`) redirect(`/${locale}/archives?error=confirmation`);
  try {
    await permanentlyDeleteManagedEntity(entityType, entityId, confirmation);
  } catch (error) {
    console.error('Unable to permanently delete archived record', {error});
    redirect(`/${locale}/archives?error=dependencies`);
  }
  revalidateLifecycle(locale);
  redirect(`/${locale}/archives?deleted=1`);
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
  return `/api/exports/${exportId}`;
}
