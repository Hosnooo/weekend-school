import 'server-only';

import type {
  AttendanceConflict,
  OfficialAttendanceStatus
} from '@/features/attendance/attendance.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import {
  approveAllSubmittedSources,
  createReportBatch,
  getReportBatchWorkspace
} from './report-batch.repository';
import {
  listAdminReportContexts
} from './admin-report-contexts.repository';
import {
  buildAdminReportWorkspaceModel,
  type AdminReportWorkspaceModel
} from './admin-report-workspace.model';
import {getActiveReportTemplate} from './report-template.repository';
import type {ReportPerformance} from './report.types';

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function ensureAdminReportContextBatch(input: {
  schoolId: string;
  createdByProfileId: string;
  classId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  periodStart: string;
  periodEnd: string;
}) {
  const db = await createServerSupabaseClient();

  let query = db
    .from('report_batches')
    .select('id,status')
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('class_subject_id', input.classSubjectId)
    .eq(
      'scope_type',
      input.subjectGroupId ? 'GROUP' : 'SUBJECT'
    )
    .eq('period_start', input.periodStart)
    .eq('period_end', input.periodEnd)
    .order('created_at', {ascending: false})
    .limit(1);

  query = input.subjectGroupId
    ? query.eq('subject_group_id', input.subjectGroupId)
    : query.is('subject_group_id', null);

  const {data: existingRows, error: existingError} = await query;
  if (existingError) throw existingError;

  let batchId = existingRows?.[0]?.id as string | undefined;

  if (!batchId) {
    batchId = await createReportBatch({
      schoolId: input.schoolId,
      createdByProfileId: input.createdByProfileId,
      scopeType: input.subjectGroupId ? 'GROUP' : 'SUBJECT',
      classId: input.classId,
      classSubjectId: input.classSubjectId,
      subjectGroupId: input.subjectGroupId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd
    });
  }

  const workspace = await getReportBatchWorkspace(
    input.schoolId,
    batchId
  );

  if (
    workspace &&
    workspace.batch.status !== 'FINALIZED' &&
    workspace.sources.length > 0 &&
    workspace.approvals.length === 0
  ) {
    await approveAllSubmittedSources(
      input.schoolId,
      batchId
    );
  }

  return batchId;
}

export async function getAdminReportWorkspace(
  schoolId: string,
  batchId: string
): Promise<AdminReportWorkspaceModel | null> {
  const workspace = await getReportBatchWorkspace(
    schoolId,
    batchId
  );

  if (!workspace) return null;

  const [template, contexts] = await Promise.all([
    getActiveReportTemplate(schoolId),
    listAdminReportContexts(
      schoolId,
      workspace.batch.periodStart,
      workspace.batch.periodEnd
    )
  ]);

  const context =
    contexts.find(({batchId: contextBatchId}) =>
      contextBatchId === batchId
    ) ??
    contexts.find(
      (item) =>
        item.classId === workspace.batch.classId &&
        item.classSubjectId ===
          workspace.batch.classSubjectId &&
        item.subjectGroupId ===
          workspace.batch.subjectGroupId
    );

  if (!context) return null;

  const db = await createServerSupabaseClient();
  const approval = workspace.approvals[0] ?? null;

  const {data: reportRows, error: reportError} = await db
    .from('reports')
    .select('id,status,email_deliveries(status)')
    .eq('school_id', schoolId)
    .eq('batch_id', batchId)
    .order('generated_at');

  if (reportError) throw reportError;

  const reports = (
    reportRows ?? []
  ).map((report) => ({
    id: report.id as string,
    status: report.status as
      | 'DRAFT'
      | 'READY'
      | 'SENT'
      | 'FAILED',
    deliveryStatuses: (
      report.email_deliveries ?? []
    ).map(({status}) =>
      status as
        | 'PENDING'
        | 'SENT'
        | 'DELIVERED'
        | 'FAILED'
        | 'BOUNCED'
    )
  }));

  let commentOverrides: Array<{
    student_id: string;
    comment_en: string | null;
    comment_ar: string | null;
  }> = [];

  if (approval) {
    const {data, error} = await db
      .from('report_student_overrides')
      .select('student_id,comment_en,comment_ar')
      .eq('school_id', schoolId)
      .eq('approval_id', approval.id);

    if (error) throw error;
    commentOverrides = data ?? [];
  }

  const overrideByStudent = new Map(
    commentOverrides.map((row) => [
      row.student_id,
      row
    ])
  );

  const students = workspace.summaryStudents.map((student) => {
    const override = overrideByStudent.get(student.studentId);

    return override
      ? {
          ...student,
          commentEn: override.comment_en,
          commentAr: override.comment_ar
        }
      : student;
  });

  const sourceIds = workspace.sources.map(({id}) => id);

  let observationRows: Array<{
    submission_id: string;
    student_id: string;
    attendance_status: OfficialAttendanceStatus;
  }> = [];

  if (sourceIds.length > 0) {
    const {data, error} = await db
      .from('weekly_submission_students')
      .select('submission_id,student_id,attendance_status')
      .eq('school_id', schoolId)
      .in('submission_id', sourceIds);

    if (error) throw error;

    observationRows = (
      data ?? []
    ) as typeof observationRows;
  }

  const classSubjectIds = [
    ...new Set(
      workspace.sources.map(
        ({classSubjectId}) => classSubjectId
      )
    )
  ];

  let resolutionRows: Array<{
    class_subject_id: string;
    subject_group_id: string | null;
    week_start: string;
    student_id: string;
  }> = [];

  if (classSubjectIds.length > 0) {
    const {data, error} = await db
      .from('attendance_resolutions')
      .select(
        'class_subject_id,subject_group_id,week_start,student_id'
      )
      .eq('school_id', schoolId)
      .gte('week_start', workspace.batch.periodStart)
      .lte('week_start', workspace.batch.periodEnd)
      .in('class_subject_id', classSubjectIds);

    if (error) throw error;
    resolutionRows = data ?? [];
  }

  const attendanceKey = (
    classSubjectId: string,
    subjectGroupId: string | null,
    weekStart: string,
    studentId: string
  ) =>
    `${classSubjectId}:${subjectGroupId ?? 'whole'}:${weekStart}:${studentId}`;

  const resolved = new Set(
    resolutionRows.map((row) =>
      attendanceKey(
        row.class_subject_id,
        row.subject_group_id,
        row.week_start,
        row.student_id
      )
    )
  );

  const sourceById = new Map(
    workspace.sources.map((source) => [source.id, source])
  );

  const studentById = new Map(
    workspace.summaryStudents.map((student) => [
      student.studentId,
      student
    ])
  );

  const buckets = new Map<
    string,
    {
      statuses: Set<OfficialAttendanceStatus>;
      conflict: AttendanceConflict;
    }
  >();

  for (const observation of observationRows) {
    const source = sourceById.get(observation.submission_id);
    const student = studentById.get(observation.student_id);

    if (!source || !student) continue;

    const key = attendanceKey(
      source.classSubjectId,
      source.subjectGroupId,
      source.weekStart,
      observation.student_id
    );

    if (resolved.has(key)) continue;

    const existing = buckets.get(key) ?? {
      statuses: new Set<OfficialAttendanceStatus>(),
      conflict: {
        classSubjectId: source.classSubjectId,
        subjectGroupId: source.subjectGroupId,
        weekStart: source.weekStart,
        studentId: observation.student_id,
        studentNameEn: student.studentNameEn,
        studentNameAr: student.studentNameAr,
        classNameEn: workspace.classInfo.nameEn,
        classNameAr: workspace.classInfo.nameAr,
        subjectNameEn: source.subjectNameEn,
        subjectNameAr: source.subjectNameAr,
        groupNameEn: source.groupNameEn,
        groupNameAr: source.groupNameAr,
        observations: [],
        resolution: null
      }
    };

    existing.statuses.add(observation.attendance_status);
    existing.conflict.observations.push({
      teacherId: source.teacherId,
      teacherName: source.teacherName,
      status: observation.attendance_status
    });

    buckets.set(key, existing);
  }

  const attendanceConflicts = [
    ...buckets.values()
  ]
    .filter(({statuses}) => statuses.size > 1)
    .map(({conflict}) => conflict)
    .sort((left, right) =>
      left.studentNameEn.localeCompare(right.studentNameEn)
    );

  return buildAdminReportWorkspaceModel({
    context,
    template,
    batch: {
      id: workspace.batch.id,
      periodStart: workspace.batch.periodStart,
      periodEnd: workspace.batch.periodEnd,
      status: workspace.batch.status
    },
    approval: approval
      ? {
          approvedProgressEn:
            approval.approvedProgressEn,
          approvedProgressAr:
            approval.approvedProgressAr,
          performance: approval.performance
        }
      : null,
    students,
    reports,
    attendanceConflicts
  });
}

export async function saveAdminReportWorkspace(input: {
  schoolId: string;
  batchId: string;
  mainReportEn: string | null;
  mainReportAr: string | null;
  performance: ReportPerformance | null;
  studentComments: Array<{
    studentId: string;
    commentEn: string | null;
    commentAr: string | null;
  }>;
}) {
  let workspace = await getReportBatchWorkspace(
    input.schoolId,
    input.batchId
  );

  if (!workspace) {
    throw new Error('Report workspace not found');
  }

  if (workspace.batch.status === 'FINALIZED') {
    throw new Error(
      'Finalized reports must be reopened before editing'
    );
  }

  if (
    workspace.approvals.length === 0 &&
    workspace.sources.length > 0
  ) {
    await approveAllSubmittedSources(
      input.schoolId,
      input.batchId
    );

    workspace = await getReportBatchWorkspace(
      input.schoolId,
      input.batchId
    );
  }

  const approval = workspace?.approvals[0];

  if (!approval) {
    throw new Error(
      'No submitted teacher update is available for this report'
    );
  }

  const db = await createServerSupabaseClient();

  const {error: approvalError} = await db
    .from('report_section_approvals')
    .update({
      approved_progress_en: clean(input.mainReportEn),
      approved_progress_ar: clean(input.mainReportAr),
      performance: input.performance
    })
    .eq('school_id', input.schoolId)
    .eq('id', approval.id);

  if (approvalError) throw approvalError;

  if (input.studentComments.length === 0) return;

  const rows = input.studentComments.map((comment) => ({
    school_id: input.schoolId,
    approval_id: approval.id,
    student_id: comment.studentId,
    comment_en: clean(comment.commentEn),
    comment_ar: clean(comment.commentAr)
  }));

  const {error: overrideError} = await db
    .from('report_student_overrides')
    .upsert(rows, {
      onConflict: 'school_id,approval_id,student_id'
    });

  if (overrideError) throw overrideError;
}

export async function reopenAdminReportWorkspace(
  schoolId: string,
  batchId: string
) {
  const db = await createServerSupabaseClient();

  const {data: ownedBatch, error: ownershipError} = await db
    .from('report_batches')
    .select('id')
    .eq('school_id', schoolId)
    .eq('id', batchId)
    .maybeSingle();

  if (ownershipError) throw ownershipError;
  if (!ownedBatch) throw new Error('Report workspace not found');

  const {error} = await db.rpc(
    'reopen_unsent_report_batch',
    {
      p_batch_id: batchId
    }
  );

  if (error) throw error;
}
