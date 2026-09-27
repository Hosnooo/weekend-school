'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  changeStudentClass,
  createStudentWithEnrollment,
  moveStudentSubjectGroup,
  setSubjectExcluded
} from '@/features/enrollment/enrollment.repository';
import {
  changeStudentClassSchema,
  createStudentEnrollmentSchema,
  moveStudentSubjectGroupSchema,
  setSubjectExcludedSchema
} from '@/features/enrollment/enrollment.schemas';
import {setStudentActive, updateStudent} from '@/features/students/student.repository';
import {studentUpdateSchema} from '@/features/students/student.schemas';
import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {initialActionState, saveFailure, validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function parseJson(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function revalidateStudentSurfaces(locale: Locale, studentId?: string) {
  revalidatePath(`/${locale}/students`);
  if (studentId) {
    revalidatePath(`/${locale}/students/${studentId}`);
    revalidatePath(`/${locale}/students/${studentId}/edit`);
    revalidatePath(`/${locale}/students/${studentId}/enrollment`);
  }
}

function enrollmentMutationFailure(error: unknown) {
  console.error('Unable to update student enrollment', {error});
  if (typeof error === 'object' && error !== null && 'code' in error &&
    ['23P01', '23505', '55000', '22023'].includes(String(error.code))) {
    return saveFailure('transferConflict');
  }
  return saveFailure();
}

export async function createStudentAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const parsed = createStudentEnrollmentSchema.safeParse({
    firstNameEn: formData.get('firstNameEn'),
    lastNameEn: formData.get('lastNameEn'),
    firstNameAr: formData.get('firstNameAr'),
    lastNameAr: formData.get('lastNameAr'),
    guardianMode: formData.get('guardianMode'),
    guardianId: formData.get('guardianId'),
    guardianName: formData.get('guardianName'),
    guardianEmail: formData.get('guardianEmail'),
    guardianPhone: formData.get('guardianPhone'),
    reportLanguage: formData.get('reportLanguage') ?? 'en',
    classId: formData.get('classId'),
    startsOn: formData.get('startsOn'),
    subjects: parseJson(formData.get('subjects'))
  });
  if (!parsed.success) return validationFailure();

  try {
    await createStudentWithEnrollment(parsed.data);
  } catch (error) {
    console.error('Unable to create student', {error});
    return saveFailure();
  }

  revalidateStudentSurfaces(locale);
  revalidatePath(`/${locale}/classes`);
  revalidatePath(`/${locale}/guardians`);
  redirect(`/${locale}/students`);
}

export async function updateStudentAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = studentUpdateSchema.safeParse({
    id: formData.get('id'),
    firstNameEn: formData.get('firstNameEn'),
    lastNameEn: formData.get('lastNameEn'),
    firstNameAr: formData.get('firstNameAr'),
    lastNameAr: formData.get('lastNameAr')
  });
  if (!parsed.success) return validationFailure();

  try {
    await updateStudent(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to update student', {error});
    return saveFailure();
  }

  revalidateStudentSurfaces(locale, parsed.data.id);
  redirect(`/${locale}/students/${parsed.data.id}`);
}

export async function setStudentActiveAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = z.object({id: databaseUuid, isActive: z.enum(['true', 'false'])}).safeParse({
    id: formData.get('id'),
    isActive: formData.get('isActive')
  });
  if (!parsed.success) return;
  await setStudentActive(profile.schoolId, parsed.data.id, parsed.data.isActive === 'true');
  revalidateStudentSurfaces(locale, parsed.data.id);
}

export async function changeStudentClassAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const parsed = changeStudentClassSchema.safeParse({
    studentId: formData.get('studentId'),
    targetClassId: formData.get('targetClassId'),
    startsOn: formData.get('startsOn')
  });
  if (!parsed.success) return validationFailure();

  try {
    await changeStudentClass(parsed.data);
  } catch (error) {
    return enrollmentMutationFailure(error);
  }
  revalidateStudentSurfaces(locale, parsed.data.studentId);
  revalidatePath(`/${locale}/classes`);
  return initialActionState;
}

export async function setSubjectExcludedAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const parsed = setSubjectExcludedSchema.safeParse({
    studentId: formData.get('studentId'),
    classSubjectId: formData.get('classSubjectId'),
    excluded: formData.get('excluded') === 'true',
    effectiveOn: formData.get('effectiveOn')
  });
  if (!parsed.success) return validationFailure();

  try {
    await setSubjectExcluded(parsed.data);
  } catch (error) {
    return enrollmentMutationFailure(error);
  }
  revalidateStudentSurfaces(locale, parsed.data.studentId);
  return initialActionState;
}

export async function moveStudentSubjectGroupAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const parsed = moveStudentSubjectGroupSchema.safeParse({
    studentId: formData.get('studentId'),
    classSubjectId: formData.get('classSubjectId'),
    targetGroupId: formData.get('targetGroupId'),
    startsOn: formData.get('startsOn')
  });
  if (!parsed.success) return validationFailure();

  try {
    await moveStudentSubjectGroup(parsed.data);
  } catch (error) {
    return enrollmentMutationFailure(error);
  }
  revalidateStudentSurfaces(locale, parsed.data.studentId);
  return initialActionState;
}
