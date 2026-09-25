'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {
  assignTeacher,
  deleteTeachingAssignment,
  updateTeachingAssignmentDates
} from '@/features/teaching-assignments/teaching-assignment.repository';
import {
  deleteTeachingAssignmentSchema,
  teachingAssignmentSchema,
  updateTeachingAssignmentSchema
} from '@/features/teaching-assignments/teaching-assignment.schemas';
import {
  classifyTeachingAssignmentMutationError,
  validateTeachingAssignmentDateRange
} from '@/features/teaching-assignments/teaching-assignment.service';
import type {TeachingAssignmentMutationResult} from '@/features/teaching-assignments/teaching-assignment.types';
import {isLocale, type Locale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {initialActionState, saveFailure, validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function refresh(locale: Locale, teacherId: string) {
  revalidatePath(`/${locale}/teachers`);
  revalidatePath(`/${locale}/teaching-assignments`);
  revalidatePath(`/${locale}/teachers/${teacherId}/assignments`);
  revalidatePath(`/${locale}/teachers/${teacherId}/edit`);
  revalidatePath(`/${locale}/my-teaching`);
}

function mutationFailure(error: unknown, operation: string): TeachingAssignmentMutationResult {
  const kind = classifyTeachingAssignmentMutationError(error);
  if (kind === 'unexpected') console.error(operation, {error});
  return {ok: false, error: kind};
}

function actionStateFromMutation(result: TeachingAssignmentMutationResult): ActionState {
  if (result.ok) return initialActionState;
  if (result.error === 'validation' || result.error === 'invalid-range') {
    return validationFailure();
  }
  if (result.error === 'overlap') return saveFailure('conflict');
  return saveFailure();
}

export async function createTeachingAssignmentMutationAction(
  formData: FormData
): Promise<TeachingAssignmentMutationResult> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = teachingAssignmentSchema.safeParse({
    teacherId: formData.get('teacherId'),
    classSubjectId: formData.get('classSubjectId'),
    subjectGroupId: formData.get('subjectGroupId'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn')
  });
  if (!parsed.success) return {ok: false, error: 'validation'};

  try {
    validateTeachingAssignmentDateRange(parsed.data.startsOn, parsed.data.endsOn);
    await assignTeacher(profile.schoolId, parsed.data);
  } catch (error) {
    return mutationFailure(error, 'Unable to add teaching assignment');
  }

  refresh(locale, parsed.data.teacherId);
  return {ok: true};
}

export async function createTeachingAssignmentAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  return actionStateFromMutation(await createTeachingAssignmentMutationAction(formData));
}

export async function updateTeachingAssignmentMutationAction(
  formData: FormData
): Promise<TeachingAssignmentMutationResult> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const teacherId = databaseUuid.safeParse(formData.get('teacherId'));
  const parsed = updateTeachingAssignmentSchema.safeParse({
    assignmentId: formData.get('assignmentId'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn')
  });
  if (!teacherId.success || !parsed.success) return {ok: false, error: 'validation'};

  try {
    validateTeachingAssignmentDateRange(parsed.data.startsOn, parsed.data.endsOn);
    await updateTeachingAssignmentDates(profile.schoolId, teacherId.data, parsed.data);
  } catch (error) {
    return mutationFailure(error, 'Unable to update teaching assignment dates');
  }

  refresh(locale, teacherId.data);
  return {ok: true};
}

export async function updateTeachingAssignmentAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const teacherId = databaseUuid.safeParse(formData.get('teacherId'));
  if (!teacherId.success) return;

  const result = await updateTeachingAssignmentMutationAction(formData);
  if (!result.ok) {
    redirect(`/${locale}/teachers/${teacherId.data}/assignments?error=${result.error}`);
  }
}

export async function deleteTeachingAssignmentAction(
  formData: FormData
): Promise<TeachingAssignmentMutationResult> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const teacherId = databaseUuid.safeParse(formData.get('teacherId'));
  const parsed = deleteTeachingAssignmentSchema.safeParse({
    assignmentId: formData.get('assignmentId')
  });
  if (!teacherId.success || !parsed.success) return {ok: false, error: 'validation'};

  try {
    await deleteTeachingAssignment(profile.schoolId, teacherId.data, parsed.data);
  } catch (error) {
    return mutationFailure(error, 'Unable to delete teaching assignment');
  }

  refresh(locale, teacherId.data);
  return {ok: true};
}
