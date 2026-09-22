'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  createStudentWithGuardian,
  setStudentActive,
  updateStudent
} from '@/features/students/student.repository';
import {studentSchema, studentUpdateSchema} from '@/features/students/student.schemas';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {saveFailure, validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

const studentCreationSchema = studentSchema.extend({startsOn: z.iso.date()});

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

export async function createStudentAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = studentCreationSchema.safeParse({
    firstNameEn: formData.get('firstNameEn'),
    lastNameEn: formData.get('lastNameEn'),
    firstNameAr: formData.get('firstNameAr'),
    lastNameAr: formData.get('lastNameAr'),
    groupId: formData.get('groupId'),
    guardianName: formData.get('guardianName'),
    guardianEmail: formData.get('guardianEmail'),
    reportLanguage: formData.get('reportLanguage'),
    startsOn: formData.get('startsOn')
  });
  if (!parsed.success) return validationFailure();

  try {
    await createStudentWithGuardian(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to create student', {error});
    return saveFailure();
  }

  revalidatePath(`/${locale}/students`);
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

  revalidatePath(`/${locale}/students`);
  redirect(`/${locale}/students`);
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
  revalidatePath(`/${locale}/students`);
}
