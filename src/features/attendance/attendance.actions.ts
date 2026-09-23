'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

import {resolveAttendanceConflict} from './attendance.repository';

const resolveAttendanceConflictSchema = z.object({
  classSubjectId: z.string().uuid(),
  subjectGroupId: z.string().uuid().nullable(),
  weekStart: z.iso.date(),
  studentId: z.string().uuid(),
  status: z.enum(['PRESENT', 'ABSENT'])
});

export async function resolveAttendanceConflictAction(formData: FormData): Promise<void> {
  const rawLocale = String(formData.get('locale') ?? 'en');
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  await requireProfile(locale, 'ADMIN');

  const rawGroupId = String(formData.get('subjectGroupId') ?? '');
  const parsed = resolveAttendanceConflictSchema.safeParse({
    classSubjectId: formData.get('classSubjectId'),
    subjectGroupId: rawGroupId || null,
    weekStart: formData.get('weekStart'),
    studentId: formData.get('studentId'),
    status: formData.get('status')
  });

  if (!parsed.success) {
    return;
  }

  await resolveAttendanceConflict(parsed.data, parsed.data.status);
  revalidatePath(`/${locale}/dashboard`);
}
