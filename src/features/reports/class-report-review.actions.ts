'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

import {
  getClassReportReviewWorkspaceWithAttendance
} from './class-report-attendance.repository';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {reportAttendanceOverride} from './report-attendance';
import {attendanceInputIssue} from './report-attendance-input';
import {reopenAdminReportWorkspace} from './admin-report-workspace.repository';
import {getReportBatchWorkspace} from './report-batch.repository';
import {reportPeriodSchema} from './report.schemas';
import {reportWorkflowErrorCode} from './report-error-guidance';
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

    // __OMIT__ means intentionally hide an existing Teacher rating.
    // Empty string means inherit the original Teacher value instead.
    if (includePerformance && rawPerformance && rawPerformance !== '__OMIT__') {
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

type ClassReviewPayload = NonNullable<
  ReturnType<typeof classReviewPayloadFrom>
>;

async function persistClassReportReview(
  schoolId: string,
  payload: ClassReviewPayload
) {
  const review = await getClassReportReviewWorkspaceWithAttendance(
    schoolId,
    payload.batchId
  );
  const context = review?.contexts.find(
    (item) =>
      item.classSubjectId === payload.classSubjectId &&
      item.subjectGroupId === payload.subjectGroupId
  );

  if (!context) {
    throw new Error('Report review context not found');
  }

  const attendanceOverrides = payload.students.map((student) => {
    const current = context.students.find(
      (item) => item.studentId === student.studentId
    );
    if (!current) {
      throw new Error('Report review student not found');
    }

    return {
      studentId: student.studentId,
      ...reportAttendanceOverride({
        submittedAttended: student.attendanceAttended,
        submittedTotal: student.attendanceTotal,
        sourceAttended: current.attendanceSourceAttended,
        sourceTotal: current.attendanceSourceTotal,
        wasOverridden: current.attendanceOverridden
      })
    };
  });

  // An admin may have an already open editor when another admin finalizes.
  // Reopen only unsent report snapshots; do not change teacher submissions.
  if (review?.status === 'FINALIZED') {
    await reopenAdminReportWorkspace(schoolId, payload.batchId);
  }

  // The entire approval + every student override (including attendance)
  // is committed in one PostgreSQL transaction. The security-definer RPC
  // checks school, Admin role, unsent status and source context again.
  const db = await createServerSupabaseClient();
  const {data: saved, error} = await db.rpc('save_class_report_review_atomic', {
    p_batch_id: payload.batchId,
    p_class_subject_id: payload.classSubjectId,
    p_subject_group_id: payload.subjectGroupId,
    p_main_report_en: payload.mainReportEn,
    p_main_report_ar: payload.mainReportAr,
    p_include_performance: payload.includePerformance,
    p_include_student_comments: payload.includeStudentComments,
    p_students: payload.students.map((student) => {
      const attendance = attendanceOverrides.find(
        (item) => item.studentId === student.studentId
      )!;
      return {
        student_id: student.studentId,
        progress_en: student.progressEn,
        progress_ar: student.progressAr,
        performance: student.performance,
        performance_overridden: student.performanceOverridden,
        comment_en: student.commentEn,
        comment_ar: student.commentAr,
        attendance_attended: attendance.attendanceAttended,
        attendance_total: attendance.attendanceTotal
      };
    })
  });
  if (error) throw error;
  if (saved !== true) throw new Error('Report approval was not saved');
}

export async function saveClassReportReviewWithAttendanceInlineAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const attendanceProblem = attendanceInputIssue(formData);
  if (attendanceProblem) return {ok: false as const, ...attendanceProblem};
  const payload = classReviewPayloadFrom(formData);
  if (!payload) return {ok: false as const, reason: 'validation' as const};

  try {
    await persistClassReportReview(profile.schoolId, payload);
    revalidatePath(`/${locale}/reports/workspace/${payload.batchId}`);
    return {
      ok: true as const,
      studentIds: payload.students.map(({studentId}) => studentId)
    };
  } catch (error) {
    console.error('Unable to save Class Report Cycle review inline', {error});
    const message = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : '';
    return {
      ok: false as const,
      reason: message.includes('delivered or pending reports cannot be reopened')
        ? 'sent' as const
        : message.includes('Report review student not found') ||
          message.includes('Report review context not found')
          ? 'rosterChanged' as const
          : 'unknown' as const
    };
  }
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
    await persistClassReportReview(profile.schoolId, payload);
  } catch (error) {
    console.error('Unable to save Class Report Cycle review', {error});
    redirect(
      `/${locale}/reports/workspace/${payload.batchId}?error=${reportWorkflowErrorCode(error)}`
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

/**
 * Opening a report editor is an admin-only report operation.
 * It never reopens or requests another teacher Teaching Update.
 */
export async function openClassReportEditorAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = databaseUuid.safeParse(formData.get('batchId'));
  const classSubjectId = databaseUuid.safeParse(formData.get('classSubjectId'));
  const subjectGroupId = optionalGroupIdFrom(formData);

  if (!batchId.success || !classSubjectId.success || !subjectGroupId.success) {
    redirect(`/${locale}/reports?error=validation`);
  }

  const workspacePath = `/${locale}/reports/workspace/${batchId.data}`;
  try {
    const workspace = await getReportBatchWorkspace(profile.schoolId, batchId.data);
    if (
      !workspace ||
      workspace.batch.scopeType !== 'CLASS' ||
      !workspace.sources.some(
        (source) =>
          source.included &&
          source.classSubjectId === classSubjectId.data &&
          source.subjectGroupId === subjectGroupId.data
      )
    ) {
      throw new Error('Report context not found');
    }

    // Unlock prepared admin report snapshots only when none are sent/pending.
    if (workspace.batch.status === 'FINALIZED') {
      await reopenAdminReportWorkspace(profile.schoolId, batchId.data);
    }
  } catch (error) {
    console.error('Unable to open Class Report Cycle editor', {error});
    redirect(`${workspacePath}?error=${reportWorkflowErrorCode(error)}`);
  }

  revalidatePath(workspacePath);
  const editorId =
    `report-edit-${classSubjectId.data}-${subjectGroupId.data ?? 'whole'}`;
  // A query change forces fresh route data after reopening a finalized cycle.
  // The hash still targets the inline editor once it is rendered.
  redirect(`${workspacePath}?editor=${encodeURIComponent(editorId)}#${editorId}`);
}
