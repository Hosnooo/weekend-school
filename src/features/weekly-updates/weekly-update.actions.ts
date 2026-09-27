'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';
import {toSparseExceptions} from './weekly-update.model';
import {
  canTeachWeeklyContext,
  reopenWeeklySubmission,
  saveWeeklyUpdate
} from './weekly-update.repository';
import {weeklyUpdateSchema} from './weekly-update.schemas';

export type WeeklyActionState = {status: 'idle' | 'saving' | 'saved' | 'error'; error: 'validation' | 'save' | null};

export async function reopenWeeklySubmissionAction(
  formData: FormData
) {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const {teacherIds} = await requireTeachingAccount(locale);

  const submissionId = databaseUuid.safeParse(
    formData.get('submissionId')
  );
  const teacherId = databaseUuid.safeParse(
    formData.get('teacherId')
  );
  const classSubjectId = databaseUuid.safeParse(
    formData.get('classSubjectId')
  );

  const rawGroupId = String(
    formData.get('subjectGroupId') ?? ''
  );

  const subjectGroupId = rawGroupId
    ? databaseUuid.safeParse(rawGroupId)
    : {success: true as const, data: null};

  const weekStart = String(
    formData.get('weekStart') ?? ''
  );

  if (
    !submissionId.success ||
    !teacherId.success ||
    !classSubjectId.success ||
    !subjectGroupId.success ||
    !teacherIds.includes(teacherId.data) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)
  ) {
    redirect(`/${locale}/history`);
  }

  try {
    await reopenWeeklySubmission(submissionId.data);
  } catch (error) {
    console.error('Unable to reopen weekly submission', {
      error
    });

    redirect(
      `/${locale}/history/${submissionId.data}?error=reopen`
    );
  }

  revalidatePath(`/${locale}/my-teaching`);
  revalidatePath(`/${locale}/history`);

  const query = new URLSearchParams({
    teacherId: teacherId.data,
    classSubjectId: classSubjectId.data,
    week: weekStart
  });

  if (subjectGroupId.data) {
    query.set('subjectGroupId', subjectGroupId.data);
  }

  redirect(
    `/${locale}/my-teaching/update?${query.toString()}`
  );
}

export async function saveWeeklyUpdateAction(_state: WeeklyActionState, formData: FormData): Promise<WeeklyActionState> {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const {profile, teacherIds} = await requireTeachingAccount(locale);
  let attendance: unknown;
  let exceptions: unknown;
  try {
    attendance = JSON.parse(String(formData.get('attendance') ?? '[]'));
    exceptions = JSON.parse(String(formData.get('exceptions') ?? '[]'));
  } catch {
    return {status: 'error', error: 'validation'};
  }
  const parsed = weeklyUpdateSchema.safeParse({
    teacherId: formData.get('teacherId'),
    submissionId: formData.get('submissionId'),
    classSubjectId: formData.get('classSubjectId'),
    subjectGroupId: formData.get('subjectGroupId'),
    weekStart: formData.get('weekStart'),
    progressEn: formData.get('progressEn'),
    progressAr: formData.get('progressAr'),
    defaultPerformance: String(formData.get('defaultPerformance') ?? '') || null,
    attendance,
    exceptions,
    intent: formData.get('intent')
  });
  if (!parsed.success || !teacherIds.includes(parsed.data.teacherId)) return {status: 'error', error: 'validation'};
  try {
    if (!(await canTeachWeeklyContext(profile.schoolId, parsed.data.teacherId, parsed.data.classSubjectId, parsed.data.subjectGroupId, parsed.data.weekStart))) {
      return {status: 'error', error: 'save'};
    }
    await saveWeeklyUpdate({...parsed.data, exceptions: toSparseExceptions(parsed.data.exceptions)});
  } catch (error) {
    console.error('Unable to save weekly update', {error});
    return {status: 'error', error: 'save'};
  }
  revalidatePath(`/${locale}/my-teaching`);
  revalidatePath(`/${locale}/history`);
  if (parsed.data.intent === 'submit') redirect(`/${locale}/history`);
  return {status: 'saved', error: null};
}
