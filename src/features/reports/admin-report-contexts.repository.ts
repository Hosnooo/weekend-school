import 'server-only';

import {listEnrollmentClasses} from '@/features/enrollment/enrollment.repository';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import {
  deriveAdminReportContexts,
  type AdminReportAssignmentInput,
  type AdminReportBatchInput,
  type AdminReportContextSummary,
  type AdminReportRecordInput,
  type AdminReportStudentObservationInput,
  type AdminReportSubmissionInput
} from './admin-report-contexts';

export async function listAdminReportContexts(
  schoolId: string,
  periodStart: string,
  periodEnd: string
): Promise<AdminReportContextSummary[]> {
  const db = await createServerSupabaseClient();
  const classes = await listEnrollmentClasses(schoolId);

  const classSubjectIds = classes.flatMap(
    (schoolClass) =>
      schoolClass.subjects.map(({id}) => id)
  );

  if (classSubjectIds.length === 0) return [];

  const [
    assignmentResult,
    submissionResult,
    batchResult
  ] = await Promise.all([
    db
      .from('teaching_assignments')
      .select(
        'teacher_id,class_subject_id,subject_group_id,starts_on,ends_on'
      )
      .eq('school_id', schoolId)
      .in('class_subject_id', classSubjectIds)
      .lte('starts_on', periodEnd)
      .or(`ends_on.is.null,ends_on.gte.${periodStart}`),

    db
      .from('weekly_submissions')
      .select(
        'id,teacher_id,class_subject_id,subject_group_id'
      )
      .eq('school_id', schoolId)
      .eq('status', 'SUBMITTED')
      .in('class_subject_id', classSubjectIds)
      .gte('week_start', periodStart)
      .lte('week_start', periodEnd),

    db
      .from('report_batches')
      .select(
        'id,class_id,class_subject_id,subject_group_id,scope_type,status,created_at'
      )
      .eq('school_id', schoolId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .in('scope_type', ['SUBJECT', 'GROUP'])
  ]);

  if (assignmentResult.error) throw assignmentResult.error;
  if (submissionResult.error) throw submissionResult.error;
  if (batchResult.error) throw batchResult.error;

  const assignments = (assignmentResult.data ?? []).map(
    (row): AdminReportAssignmentInput => ({
      teacherId: row.teacher_id,
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id
    })
  );

  const submissions = (submissionResult.data ?? []).map(
    (row): AdminReportSubmissionInput => ({
      id: row.id,
      teacherId: row.teacher_id,
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id
    })
  );

  const batches = (batchResult.data ?? []).map(
    (row): AdminReportBatchInput => ({
      id: row.id,
      classId: row.class_id,
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id,
      scopeType: row.scope_type,
      status: row.status,
      createdAt: row.created_at
    })
  );

  const teacherIds = [
    ...new Set([
      ...assignments.map(({teacherId}) => teacherId),
      ...submissions.map(({teacherId}) => teacherId)
    ])
  ];

  const submissionIds = submissions.map(({id}) => id);
  const batchIds = batches.map(({id}) => id);

  const [
    teacherResult,
    observationResult,
    reportResult
  ] = await Promise.all([
    teacherIds.length > 0
      ? db
          .from('teachers')
          .select('id,display_name')
          .eq('school_id', schoolId)
          .in('id', teacherIds)
      : Promise.resolve({data: [], error: null}),

    submissionIds.length > 0
      ? db
          .from('weekly_submission_students')
          .select(
            'submission_id,student_id,comment_en,comment_ar'
          )
          .eq('school_id', schoolId)
          .in('submission_id', submissionIds)
      : Promise.resolve({data: [], error: null}),

    batchIds.length > 0
      ? db
          .from('reports')
          .select('batch_id,status')
          .eq('school_id', schoolId)
          .in('batch_id', batchIds)
      : Promise.resolve({data: [], error: null})
  ]);

  if (teacherResult.error) throw teacherResult.error;
  if (observationResult.error) throw observationResult.error;
  if (reportResult.error) throw reportResult.error;

  const teacherNames = new Map(
    (teacherResult.data ?? []).map(
      (row) => [row.id, row.display_name]
    )
  );

  const observations = (observationResult.data ?? []).map(
    (row): AdminReportStudentObservationInput => ({
      submissionId: row.submission_id,
      studentId: row.student_id,
      commentEn: row.comment_en,
      commentAr: row.comment_ar
    })
  );

  const reports = (reportResult.data ?? []).map(
    (row): AdminReportRecordInput => ({
      batchId: row.batch_id,
      status: row.status
    })
  );

  return deriveAdminReportContexts({
    classes,
    assignments,
    teacherNames,
    submissions,
    batches,
    reports,
    observations
  });
}
