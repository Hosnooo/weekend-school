'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

import {saveClassReportAttendanceOverrides} from './class-report-attendance.repository';
import {saveClassReportReviewContext} from './class-report-review.repository';
import {reportPeriodSchema} from './report.schemas';
import type {ReportPerformance} from './report.types';

const performanceSchema = z.enum([
  'EXCELLENT',
  'GOOD',
  'DEVELOPING',
  'NEEDS_SUPPORT'
]);
const attendanceSchema = z.coerce.number().int().min(0);

function localeFrom(formData: FormData): Locale {
  const raw = String(formData.get('locale') ?? 'en');
  return isLocale(raw) ? raw : 'en';
}

function cleanText(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function optionalGroupIdFrom(formData: FormData) {
  const raw = String(formData.get('subjectGroupId') ?? '').trim();
  if (!raw) return {success: true as const, data: null};
  const parsed = databaseUuid.safeParse(raw);
  return parsed.success
    ? {success: true as const, data: parsed.data}
    : {success: false as const};
}

function attendancePairFrom(formData: FormData, studentId: string) {
  const rawAttended = String(
    formData.get(`attendanceAttended:${studentId}`) ?? ''
  ).trim();
  const rawTotal = String(
    formData.get(`attendanceTotal:${studentId}`) ?? ''
  ).trim();

  if (!rawAttended && !rawTotal) {
    return {
      success: true as const,
      data: {attendanceAttended: null, attendanceTotal: null}
    };
  }
  if (!rawAttended || !rawTotal) return {success: false as const};

  const attended = attendanceSchema.safeParse(rawAttended);
  const total = attendanceSchema.safeParse(rawTotal);
  if (!attended.success || !total.success || attended.data > total.data) {
    return {success: false as const};
  }

  return {
    success: true as const,
    data: {
      attendanceAttended: attended.data,
      attendanceTotal: total.data
    }
  };
}

function classReviewPayloadFrom(formData: FormData) {
  const batchId = databaseUuid.safeParse(formData.get('batchId'));
  const period = reportPeriodSchema.safeParse({
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd')
  });
  const classSubjectId = databaseUuid.safeParse(
    formData.get('classSubjectId')
  );
  const subjectGroupId = optionalGroupIdFrom(formData);

  if (
    !batchId.success ||
    !period.success ||
    !classSubjectId.success ||
    !subjectGroupId.success
  ) {
    return null;
  }

  const includePerformance =
    formData.get('includePerformance') === '1';
  const includeStudentComments =
    formData.get('includeStudentComments') === '1';
  const studentIds = [
    ...new Set(formData.getAll('studentId').map(String).filter(Boolean))
  ];

  const students: Array<{
    studentId: string;
    progressEn: string | null;
    progressAr: string | null;
    performance: ReportPerformance | null;
    performanceOverridden: boolean;
    commentEn: string | null;
    commentAr: string | null;
    attendanceAttended: number | null;
    attendanceTotal: number | null;
  }> = [];

  for (const studentId of studentIds) {
    const parsedStudentId = databaseUuid.safeParse(studentId);
    const attendance = attendancePairFrom(formData, studentId);
    if (!parsedStudentId.success || !attendance.success) return null;

    const rawPerformance = String(
      formData.get(`performance:${studentId}`) ?? ''
    ).trim();
    let performance: ReportPerformance | null = null;

    if (includePerformance && rawPerformance) {
      const parsedPerformance = performanceSchema.safeParse(rawPerformance);
      if (!parsedPerformance.success) return null;
      performance = parsedPerformance.data;
    }

    students.push({
      studentId: parsedStudentId.data,
      progressEn: cleanText(formData.get(`progressEn:${studentId}`)),
      progressAr: cleanText(formData.get(`progressAr:${studentId}`)),
      performance,
      performanceOverridden:
        includePerformance && Boolean(rawPerformance),
      commentEn: cleanText(formData.get(`commentEn:${studentId}`)),
      commentAr: cleanText(formData.get(`commentAr:${studentId}`)),
      ...attendance.data
    });
  }

  return {
    batchId: batchId.data,
    periodStart: period.data.periodStart,
    periodEnd: period.data.periodEnd,
    classSubjectId: classSubjectId.data,
    subjectGroupId: subjectGroupId.data,
    mainReportEn: cleanText(formData.get('mainReportEn')),
    mainReportAr: cleanText(formData.get('mainReportAr')),
    includePerformance,
    includeStudentComments,
    students
  };
}

export async function saveClassReportReviewWithAttendanceAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const payload = classReviewPayloadFrom(formData);

  if (!payload) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await saveClassReportReviewContext({
      schoolId: profile.schoolId,
      batchId: payload.batchId,
      classSubjectId: payload.classSubjectId,
      subjectGroupId: payload.subjectGroupId,
      mainReportEn: payload.mainReportEn,
      mainReportAr: payload.mainReportAr,
      includePerformance: payload.includePerformance,
      includeStudentComments: payload.includeStudentComments,
      students: payload.students.map((student) => ({
        studentId: student.studentId,
        progressEn: student.progressEn,
        progressAr: student.progressAr,
        performance: student.performance,
        performanceOverridden: student.performanceOverridden,
        commentEn: student.commentEn,
        commentAr: student.commentAr
      }))
    });

    await saveClassReportAttendanceOverrides({
      schoolId: profile.schoolId,
      batchId: payload.batchId,
      classSubjectId: payload.classSubjectId,
      subjectGroupId: payload.subjectGroupId,
      students: payload.students.map((student) => ({
        studentId: student.studentId,
        attendanceAttended: student.attendanceAttended,
        attendanceTotal: student.attendanceTotal
      }))
    });
  } catch (error) {
    console.error('Unable to save Class Report Cycle review', {error});
    redirect(
      `/${locale}/reports/workspace/${payload.batchId}?error=save`
    );
  }

  revalidatePath(`/${locale}/reports`);
  revalidatePath(`/${locale}/reports/workspace/${payload.batchId}`);

  const params = new URLSearchParams({
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    saved: '1'
  });
  redirect(`/${locale}/reports/workspace/${payload.batchId}?${params.toString()}`);
}
