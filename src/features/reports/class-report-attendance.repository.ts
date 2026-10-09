import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import {
  deriveReportAttendance,
  effectiveReportAttendance,
  type ReportAttendanceObservation,
  type ReportAttendanceResolution
} from './report-attendance';
import {getReportBatchWorkspace} from './report-batch.repository';
import {
  getClassReportReviewWorkspace,
  type ClassReportReviewStudent,
  type ClassReportReviewWorkspace
} from './class-report-review.repository';

import type {ReportPerformance} from './report.types';

type AttendanceOverrideRow = {
  approval_id: string;
  student_id: string;
  progress_en: string | null;
  progress_ar: string | null;
  performance: ReportPerformance | null;
  performance_overridden: boolean;
  comment_en: string | null;
  comment_ar: string | null;
  attendance_attended: number | null;
  attendance_total: number | null;
};

type SourceObservationRow = {
  submission_id: string;
  student_id: string;
  attendance_status: 'PRESENT' | 'ABSENT' | null;
  attendance_attended: number | null;
  attendance_total: number | null;
  performance_override: ReportPerformance | null;
  comment_en: string | null;
  comment_ar: string | null;
};

export type ClassReportReviewStudentWithAttendance =
  ClassReportReviewStudent & {
    attendanceAttended: number | null;
    attendanceTotal: number | null;
    attendanceSourceAttended: number | null;
    attendanceSourceTotal: number | null;
    attendanceOverridden: boolean;
    attendanceUnresolvedConflicts: number;
  };

export type ClassReportReviewWorkspaceWithAttendance =
  Omit<ClassReportReviewWorkspace, 'contexts'> & {
    contexts: Array<
      Omit<ClassReportReviewWorkspace['contexts'][number], 'students'> & {
        students: ClassReportReviewStudentWithAttendance[];
      }
    >;
  };

export async function getClassReportReviewWorkspaceWithAttendance(
  schoolId: string,
  batchId: string
): Promise<ClassReportReviewWorkspaceWithAttendance | null> {
  const [review, batch] = await Promise.all([
    getClassReportReviewWorkspace(schoolId, batchId),
    getReportBatchWorkspace(schoolId, batchId)
  ]);

  if (!review || !batch || batch.batch.scopeType !== 'CLASS') return null;

  const sourceIds = batch.sources
    .filter(({included}) => included)
    .map(({id}) => id);
  const approvalIds = review.contexts
    .map(({approvalId}) => approvalId)
    .filter((id): id is string => Boolean(id));
  const classSubjectIds = [
    ...new Set(review.contexts.map(({classSubjectId}) => classSubjectId))
  ];

  const db = await createServerSupabaseClient();
  const [observationResult, resolutionResult, overrideResult] =
    await Promise.all([
      sourceIds.length > 0
        ? db
            .from('weekly_submission_students')
            .select(
              'submission_id,student_id,attendance_status,attendance_attended,attendance_total,performance_override,comment_en,comment_ar'
            )
            .eq('school_id', schoolId)
            .in('submission_id', sourceIds)
        : Promise.resolve({data: [], error: null}),
      classSubjectIds.length > 0
        ? db
            .from('attendance_resolutions')
            .select(
              'class_subject_id,subject_group_id,week_start,student_id,resolved_status'
            )
            .eq('school_id', schoolId)
            .gte('week_start', batch.batch.periodStart)
            .lte('week_start', batch.batch.periodEnd)
            .in('class_subject_id', classSubjectIds)
        : Promise.resolve({data: [], error: null}),
      approvalIds.length > 0
        ? db
            .from('report_student_overrides')
            .select(
              'approval_id,student_id,progress_en,progress_ar,performance,performance_overridden,comment_en,comment_ar,attendance_attended,attendance_total'
            )
            .eq('school_id', schoolId)
            .in('approval_id', approvalIds)
        : Promise.resolve({data: [], error: null})
    ]);

  for (const result of [observationResult, resolutionResult, overrideResult]) {
    if (result.error) throw result.error;
  }

  const rawObservations =
    (observationResult.data ?? []) as SourceObservationRow[];
  const observations: ReportAttendanceObservation[] =
    rawObservations.map((row) => ({
      submissionId: row.submission_id,
      studentId: row.student_id,
      attendanceStatus: row.attendance_status,
      attended: row.attendance_attended,
      total: row.attendance_total
    }));
  const resolutions: ReportAttendanceResolution[] =
    (resolutionResult.data ?? []).map((row) => ({
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id,
      weekStart: row.week_start,
      studentId: row.student_id,
      resolvedStatus: row.resolved_status as 'PRESENT' | 'ABSENT'
    }));
  const overrides =
    (overrideResult.data ?? []) as AttendanceOverrideRow[];

  return {
    ...review,
    contexts: review.contexts.map((context) => {
      return {
        ...context,
        students: context.students.map((student) => {
          const source = deriveReportAttendance({
            sources: context.sources
              .filter(({id}) => student.applicableSourceIds.includes(id))
              .map(({id, weekStart, coverageKind, periodStart, periodEnd, coveredDates, partialOverlap}) => ({
                 id, weekStart, coverageKind, periodStart, periodEnd,
                 coveredDates, partialOverlap
               })),
            observations,
            resolutions,
            classSubjectId: context.classSubjectId,
            subjectGroupId: context.subjectGroupId,
            studentId: student.studentId
          });
          const override = context.approvalId
            ? overrides.find(
                (row) =>
                  row.approval_id === context.approvalId &&
                  row.student_id === student.studentId
              )
            : null;
          const effective = effectiveReportAttendance(
            source,
            override?.attendance_attended,
            override?.attendance_total
          );
          const sourceAttended = source.total > 0 ? source.attended : null;
          const sourceTotal = source.total > 0 ? source.total : null;
          const hasUsableAttendance =
            effective.overridden || sourceTotal !== null;

          return {
            ...student,
            attendanceAttended: hasUsableAttendance
              ? effective.attended
              : null,
            attendanceTotal: hasUsableAttendance
              ? effective.total
              : null,
            attendanceSourceAttended: sourceAttended,
            attendanceSourceTotal: sourceTotal,
            attendanceOverridden: effective.overridden,
            attendanceUnresolvedConflicts: effective.unresolvedConflicts
          };
        })
      };
    })
  };
}

export async function saveClassReportAttendanceOverrides(input: {
  schoolId: string;
  batchId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  students: Array<{
    studentId: string;
    attendanceAttended: number | null;
    attendanceTotal: number | null;
  }>;
}) {
  const db = await createServerSupabaseClient();
  let query = db
    .from('report_section_approvals')
    .select('id')
    .eq('school_id', input.schoolId)
    .eq('batch_id', input.batchId)
    .eq('class_subject_id', input.classSubjectId);

  query = input.subjectGroupId
    ? query.eq('subject_group_id', input.subjectGroupId)
    : query.is('subject_group_id', null);

  const {data: approval, error: approvalError} = await query.maybeSingle();
  if (approvalError) throw approvalError;
  if (!approval) throw new Error('Report review context not found');

  for (const student of input.students) {
    const hasAttendance =
      student.attendanceAttended !== null &&
      student.attendanceTotal !== null;

    if (!hasAttendance) {
      const {error} = await db
        .from('report_student_overrides')
        .update({
          attendance_attended: null,
          attendance_total: null
        })
        .eq('school_id', input.schoolId)
        .eq('approval_id', approval.id)
        .eq('student_id', student.studentId);
      if (error) throw error;
      continue;
    }

    const {error} = await db
      .from('report_student_overrides')
      .upsert(
        {
          school_id: input.schoolId,
          approval_id: approval.id,
          student_id: student.studentId,
          attendance_attended: student.attendanceAttended,
          attendance_total: student.attendanceTotal
        },
        {onConflict: 'school_id,approval_id,student_id'}
      );
    if (error) throw error;
  }
}