'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  createGuardian,
  linkGuardianToStudent,
  setGuardianActive,
  unlinkGuardianFromStudent,
  updateGuardian,
  updateStudentGuardianLink
} from '@/features/guardians/guardian.repository';
import {
  guardianSchema,
  guardianUpdateSchema,
  studentGuardianLinkSchema,
  studentGuardianUnlinkSchema,
  studentGuardianUpdateSchema
} from '@/features/guardians/guardian.schemas';
import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {
  initialActionState,
  saveFailure,
  validationFailure
} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function checked(formData: FormData, name: string) {
  const value = formData.get(name);
  return value === 'on' || value === 'true';
}

function refresh(locale: Locale, guardianId?: string, studentId?: string) {
  revalidatePath(`/${locale}/guardians`);
  revalidatePath(`/${locale}/students`);
  revalidatePath(`/${locale}/archives`);

  if (guardianId) {
    revalidatePath(`/${locale}/guardians/${guardianId}`);
    revalidatePath(`/${locale}/guardians/${guardianId}/edit`);
  }
  if (studentId) {
    revalidatePath(`/${locale}/students/${studentId}`);
  }
}

function guardianMutationFailure(error: unknown): ActionState {
  console.error('Unable to update Student Guardian', {error});
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String(error.code) === '23505'
  ) {
    return saveFailure('guardianAlreadyLinked');
  }
  return saveFailure();
}

export async function createGuardianAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = guardianSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    reportLanguage: formData.get('reportLanguage')
  });
  if (!parsed.success) return validationFailure();

  try {
    await createGuardian(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to create guardian', {error});
    return saveFailure();
  }

  refresh(locale);
  redirect(`/${locale}/guardians`);
}

export async function updateGuardianAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = guardianUpdateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    reportLanguage: formData.get('reportLanguage')
  });
  if (!parsed.success) return validationFailure();

  try {
    await updateGuardian(profile.schoolId, parsed.data.id, parsed.data);
  } catch (error) {
    console.error('Unable to update guardian', {error});
    return saveFailure();
  }

  refresh(locale, parsed.data.id);
  redirect(`/${locale}/guardians/${parsed.data.id}`);
}

export async function addStudentGuardianAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const parsed = studentGuardianLinkSchema.safeParse({
    studentId: formData.get('studentId'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    reportLanguage: formData.get('reportLanguage'),
    isPrimary: checked(formData, 'isPrimary'),
    receivesReports: checked(formData, 'receivesReports')
  });
  if (!parsed.success) return validationFailure();

  try {
    const guardianId = await linkGuardianToStudent(parsed.data);
    refresh(locale, guardianId, parsed.data.studentId);
  } catch (error) {
    return guardianMutationFailure(error);
  }

  return initialActionState;
}

export async function updateStudentGuardianAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const parsed = studentGuardianUpdateSchema.safeParse({
    studentId: formData.get('studentId'),
    guardianId: formData.get('guardianId'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    reportLanguage: formData.get('reportLanguage'),
    isPrimary: checked(formData, 'isPrimary'),
    receivesReports: checked(formData, 'receivesReports')
  });
  if (!parsed.success) return validationFailure();

  try {
    await updateStudentGuardianLink(parsed.data);
    refresh(locale, parsed.data.guardianId, parsed.data.studentId);
  } catch (error) {
    return guardianMutationFailure(error);
  }

  return initialActionState;
}

export async function unlinkStudentGuardianAction(formData: FormData) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const parsed = studentGuardianUnlinkSchema.safeParse({
    studentId: formData.get('studentId'),
    guardianId: formData.get('guardianId')
  });
  if (!parsed.success) return;

  await unlinkGuardianFromStudent(parsed.data.studentId, parsed.data.guardianId);
  refresh(locale, parsed.data.guardianId, parsed.data.studentId);
}

export async function setGuardianActiveAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = z.object({
    id: databaseUuid,
    isActive: z.enum(['true', 'false'])
  }).safeParse({
    id: formData.get('id'),
    isActive: formData.get('isActive')
  });
  if (!parsed.success) return;

  await setGuardianActive(
    profile.schoolId,
    parsed.data.id,
    parsed.data.isActive === 'true'
  );
  refresh(locale, parsed.data.id);
}
