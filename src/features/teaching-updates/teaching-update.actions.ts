'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {z} from 'zod';

import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';
import {
  databaseUuid,
  optionalUuid
} from '@/lib/validation/fields';
import {
  dismissTeachingUpdate,
  findOverlappingTeachingUpdates,
  saveTeachingUpdateDraft,
  submitTeachingUpdate
} from './teaching-update.repository';
import type {TeachingUpdateActionState} from './teaching-update.types';
import {
  dismissTeachingUpdateSchema,
  teachingUpdateDraftSchema,
  teachingUpdateLifecycleSchema
} from './teaching-update.schemas';

function localeFrom(formData: FormData) {
  const value = String(
    formData.get('locale') ?? 'en'
  );
  return isLocale(value) ? value : 'en';
}

function refresh(locale: string) {
  revalidatePath(`/${locale}/my-teaching`);
  revalidatePath(`/${locale}/history`);
}

function mutationError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '40001'
  ) {
    return 'conflict' as const;
  }

  console.error(
    'Unable to mutate Teaching Update',
    {error}
  );
  return 'save' as const;
}

export async function createTeachingUpdateAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const {teacherIds} =
    await requireTeachingAccount(locale);

  const parsed = z.object({
    teacherId: databaseUuid,
    classSubjectId: databaseUuid,
    subjectGroupId: optionalUuid,
    onDate: z.iso.date()
  }).safeParse({
    teacherId: formData.get('teacherId'),
    classSubjectId: formData.get('classSubjectId'),
    subjectGroupId: formData.get('subjectGroupId'),
    onDate: formData.get('onDate')
  });

  if (
    !parsed.success ||
    !teacherIds.includes(parsed.data.teacherId)
  ) {
    return;
  }

  const submissionId =
    await saveTeachingUpdateDraft({
      teacherId: parsed.data.teacherId,
      submissionId: null,
      classSubjectId: parsed.data.classSubjectId,
      subjectGroupId: parsed.data.subjectGroupId,
      coverageKind: 'RANGE',
      periodStart: parsed.data.onDate,
      periodEnd: parsed.data.onDate,
      dates: [],
      progressEn: null,
      progressAr: null,
      defaultPerformance: null,
      attendance: [],
      exceptions: [],
      expectedVersion: null
    });

  refresh(locale);

  redirect(
    `/${locale}/my-teaching/update?submissionId=${submissionId}`
  );
}

export async function saveTeachingUpdateDraftAction(
  _state: TeachingUpdateActionState,
  formData: FormData
): Promise<TeachingUpdateActionState> {
  const locale = localeFrom(formData);
  const {teacherIds} =
    await requireTeachingAccount(locale);

  let dates: unknown;
  let attendance: unknown;
  let exceptions: unknown;

  try {
    dates = JSON.parse(
      String(formData.get('dates') ?? '[]')
    );
    attendance = JSON.parse(
      String(formData.get('attendance') ?? '[]')
    );
    exceptions = JSON.parse(
      String(formData.get('exceptions') ?? '[]')
    );
  } catch {
    return {
      status: 'error',
      error: 'validation',
      submissionId: null,
      overlaps: []
    };
  }

  const parsed = teachingUpdateDraftSchema.safeParse({
    teacherId: formData.get('teacherId'),
    submissionId: formData.get('submissionId'),
    classSubjectId:
      formData.get('classSubjectId'),
    subjectGroupId:
      formData.get('subjectGroupId'),
    coverageKind:
      formData.get('coverageKind'),
    periodStart:
      formData.get('periodStart'),
    periodEnd:
      formData.get('periodEnd'),
    dates,
    progressEn: formData.get('progressEn'),
    progressAr: formData.get('progressAr'),
    defaultPerformance:
      String(
        formData.get('defaultPerformance') ?? ''
      ) || null,
    attendance,
    exceptions,
    expectedVersion:
      formData.get('expectedVersion')
  });

  if (
    !parsed.success ||
    !teacherIds.includes(parsed.data.teacherId)
  ) {
    return {
      status: 'error',
      error: 'validation',
      submissionId: null,
      overlaps: []
    };
  }

  try {
    const overlaps = (
      await findOverlappingTeachingUpdates({
        classSubjectId: parsed.data.classSubjectId,
        subjectGroupId: parsed.data.subjectGroupId,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd
      })
    ).filter(
      ({id}) => id !== parsed.data.submissionId
    );

    const submissionId =
      await saveTeachingUpdateDraft(parsed.data);

    refresh(locale);

    return {
      status: 'saved',
      error: null,
      submissionId,
      overlaps
    };
  } catch (error) {
    return {
      status: 'error',
      error: mutationError(error),
      submissionId:
        parsed.data.submissionId,
      overlaps: []
    };
  }
}

export async function submitTeachingUpdateAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const {teacherIds} =
    await requireTeachingAccount(locale);

  const parsed =
    teachingUpdateLifecycleSchema.safeParse({
      teacherId: formData.get('teacherId'),
      submissionId:
        formData.get('submissionId'),
      expectedVersion:
        formData.get('expectedVersion')
    });

  if (
    !parsed.success ||
    !teacherIds.includes(parsed.data.teacherId)
  ) {
    return;
  }

  await submitTeachingUpdate(parsed.data);
  refresh(locale);
  redirect(`/${locale}/history`);
}

export async function dismissTeachingUpdateAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const {teacherIds} =
    await requireTeachingAccount(locale);

  const parsed =
    dismissTeachingUpdateSchema.safeParse({
      teacherId: formData.get('teacherId'),
      submissionId:
        formData.get('submissionId'),
      expectedVersion:
        formData.get('expectedVersion'),
      reason: formData.get('reason')
    });

  if (
    !parsed.success ||
    !teacherIds.includes(parsed.data.teacherId)
  ) {
    return;
  }

  await dismissTeachingUpdate({
    submissionId: parsed.data.submissionId,
    expectedVersion:
      parsed.data.expectedVersion,
    reason: parsed.data.reason
  });

  refresh(locale);
  redirect(`/${locale}/my-teaching`);
}
