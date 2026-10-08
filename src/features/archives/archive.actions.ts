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
import {archiveErrorReason, type ArchiveErrorReason} from './archive-error-guidance';

export type ArchiveMutationResult =
  | {ok: true}
  | {ok: false; error: ArchiveErrorReason};

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
  try {
    await archiveStudent(idFrom(formData));
  } catch (error) {
    console.error('Unable to archive student', {error});
    return {ok: false as const, error: archiveErrorReason(error, 'archive')};
  }
  revalidatePath(`/${locale}/students`);
  revalidatePath(`/${locale}/archives`);
  return {ok: true as const};
}

export async function restoreArchivedStudentAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  try {
    await restoreArchivedStudent(idFrom(formData));
  } catch (error) {
    console.error('Unable to restore archived student', {error});
    redirect(`/${locale}/archives?error=${archiveErrorReason(error,'restore')}`);
  }
  revalidatePath(`/${locale}/students`);
  revalidatePath(`/${locale}/archives`);
  redirect(`/${locale}/archives?restored=1`);
}

export async function permanentlyDeleteArchivedStudentAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const entityId = idFrom(formData);
  const confirmation = String(
    formData.get('confirmation') ?? ''
  );
  const expectedConfirmation = String(
    formData.get('expectedConfirmation') ?? ''
  );
  const impact = await getDeleteImpact(entityId);

  try {
    validatePermanentDeleteRequest({
      entityName: expectedConfirmation,
      isArchived: impact.isArchived,
      confirmation
    });
    await permanentlyDeleteArchivedStudent(
      entityId,
      confirmation
    );
  } catch (error) {
    console.error('Unable to permanently delete archived student', {error});
    redirect(`/${locale}/archives?error=${archiveErrorReason(error,'delete')}`);
  }

  redirect(`/${locale}/archives?deleted=1`);
}

export async function archiveManagedEntityAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  try {
    const entityType = managedEntityFrom(formData);
    const entityId = idFrom(formData);
    await archiveManagedEntity(entityType, entityId);
  } catch (error) {
    console.error('Unable to archive managed record', {error});
    return {ok: false as const, error: archiveErrorReason(error, 'archive')};
  }
  revalidateLifecycle(locale);
  return {ok: true as const};
}

export async function restoreManagedEntityAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  try {
    await restoreManagedEntity(managedEntityFrom(formData), idFrom(formData));
  } catch (error) {
    console.error('Unable to restore managed archived record', {error});
    redirect(`/${locale}/archives?error=${archiveErrorReason(error,'restore')}`);
  }
  revalidateLifecycle(locale);
  redirect(`/${locale}/archives?restored=1`);
}

export async function permanentlyDeleteManagedEntityAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const entityType = managedEntityFrom(formData);
  const entityId = idFrom(formData);
  const confirmation = String(
    formData.get('confirmation') ?? ''
  );
  const expectedConfirmation = String(
    formData.get('expectedConfirmation') ?? ''
  );

  try {
    validatePermanentDeleteRequest({
      entityName: expectedConfirmation,
      isArchived: true,
      confirmation
    });

    await permanentlyDeleteManagedEntity(
      entityType,
      entityId,
      confirmation
    );
  } catch (error) {
    console.error('Unable to permanently delete archived record', {error});
    redirect(`/${locale}/archives?error=${archiveErrorReason(error,'delete')}`);
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
