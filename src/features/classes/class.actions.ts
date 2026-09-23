'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  classSchema,
  classSubjectSchema,
  defaultGroupSchema,
  subjectGroupSchema,
  subjectSchema
} from '@/features/classes/class.schemas';
import {
  addSubjectToClass,
  changeDefaultGroup,
  createClassForSchool,
  createGroupForClassSubject,
  createSubjectForSchool
} from '@/features/classes/class.service';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {saveFailure, validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function classIdFrom(formData: FormData) {
  return databaseUuid.safeParse(formData.get('classId'));
}

export async function createClassAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = classSchema.safeParse({
    nameEn: formData.get('nameEn'),
    nameAr: formData.get('nameAr')
  });
  if (!parsed.success) return validationFailure();

  let classId: string;
  try {
    classId = await createClassForSchool(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to create class', {error});
    return saveFailure();
  }

  revalidatePath(`/${locale}/classes`);
  redirect(`/${locale}/classes/${classId}`);
}

export async function createSubjectAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const classId = classIdFrom(formData);
  const parsed = subjectSchema.safeParse({
    nameEn: formData.get('nameEn'),
    nameAr: formData.get('nameAr')
  });
  if (!classId.success || !parsed.success) return validationFailure();

  try {
    const subjectId = await createSubjectForSchool(profile.schoolId, parsed.data);
    await addSubjectToClass(profile.schoolId, classId.data, {subjectId});
  } catch (error) {
    console.error('Unable to create and add subject', {error});
    return saveFailure();
  }

  revalidatePath(`/${locale}/classes/${classId.data}`);
  redirect(`/${locale}/classes/${classId.data}`);
}

export async function addClassSubjectAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const classId = classIdFrom(formData);
  const parsed = classSubjectSchema.safeParse({subjectId: formData.get('subjectId')});
  if (!classId.success || !parsed.success) return validationFailure();

  try {
    await addSubjectToClass(profile.schoolId, classId.data, parsed.data);
  } catch (error) {
    console.error('Unable to add subject to class', {error});
    return saveFailure();
  }

  revalidatePath(`/${locale}/classes/${classId.data}`);
  redirect(`/${locale}/classes/${classId.data}`);
}

export async function createSubjectGroupAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const classId = classIdFrom(formData);
  const parsed = subjectGroupSchema.safeParse({
    classSubjectId: formData.get('classSubjectId'),
    nameEn: formData.get('nameEn'),
    nameAr: formData.get('nameAr')
  });
  if (!classId.success || !parsed.success) return validationFailure();

  try {
    await createGroupForClassSubject(parsed.data);
  } catch (error) {
    console.error('Unable to create subject group', {error});
    return saveFailure();
  }

  revalidatePath(`/${locale}/classes/${classId.data}`);
  redirect(`/${locale}/classes/${classId.data}`);
}

export async function setDefaultGroupAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = z
    .object({
      classId: databaseUuid,
      classSubjectId: defaultGroupSchema.shape.classSubjectId,
      subjectGroupId: defaultGroupSchema.shape.subjectGroupId
    })
    .safeParse({
      classId: formData.get('classId'),
      classSubjectId: formData.get('classSubjectId'),
      subjectGroupId: formData.get('subjectGroupId')
    });
  if (!parsed.success) return;

  await changeDefaultGroup(profile.schoolId, {
    classSubjectId: parsed.data.classSubjectId,
    subjectGroupId: parsed.data.subjectGroupId
  });
  revalidatePath(`/${locale}/classes/${parsed.data.classId}`);
}
