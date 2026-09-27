import type {EnrollmentClassOption} from '@/features/enrollment/enrollment.types';

export type AdminReportContextStatus =
  | 'WAITING'
  | 'READY_FOR_REVIEW'
  | 'READY_TO_SEND'
  | 'SENT'
  | 'DELIVERY_ISSUE';

export type AdminReportContextSummary = {
  classId: string;
  classNameEn: string;
  classNameAr: string | null;
  classSubjectId: string;
  subjectNameEn: string;
  subjectNameAr: string | null;
  subjectGroupId: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
  teacherNames: string[];
  submissionCount: number;
  studentCommentCount: number;
  batchId: string | null;
  status: AdminReportContextStatus;
};

export type AdminReportAssignmentInput = {
  teacherId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
};

export type AdminReportSubmissionInput = {
  id: string;
  teacherId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
};

export type AdminReportBatchInput = {
  id: string;
  classId: string;
  classSubjectId: string | null;
  subjectGroupId: string | null;
  scopeType: 'CLASS' | 'SUBJECT' | 'GROUP';
  status: 'DRAFT' | 'REVIEW' | 'FINALIZED';
  createdAt: string;
};

export type AdminReportRecordInput = {
  batchId: string | null;
  status: 'DRAFT' | 'READY' | 'SENT' | 'FAILED';
};

export type AdminReportStudentObservationInput = {
  submissionId: string;
  studentId: string;
  commentEn: string | null;
  commentAr: string | null;
};

type StatusInput = {
  submissionCount: number;
  batch: {status: AdminReportBatchInput['status']} | null;
  reports: Array<{
    status: AdminReportRecordInput['status'];
  }>;
};

function contextKey(
  classSubjectId: string,
  subjectGroupId: string | null
) {
  return `${classSubjectId}:${subjectGroupId ?? 'whole'}`;
}

function hasText(value: string | null) {
  return Boolean(value?.trim());
}

export function deriveReportContextStatus({
  submissionCount,
  batch,
  reports
}: StatusInput): AdminReportContextStatus {
  if (!batch) {
    return submissionCount > 0
      ? 'READY_FOR_REVIEW'
      : 'WAITING';
  }

  if (batch.status !== 'FINALIZED') {
    return submissionCount > 0
      ? 'READY_FOR_REVIEW'
      : 'WAITING';
  }

  const activeReports = reports.filter(
    ({status}) => status !== 'DRAFT'
  );

  if (
    activeReports.some(({status}) => status === 'FAILED')
  ) {
    return 'DELIVERY_ISSUE';
  }

  if (
    activeReports.length > 0 &&
    activeReports.every(({status}) => status === 'SENT')
  ) {
    return 'SENT';
  }

  return 'READY_TO_SEND';
}

export function deriveAdminReportContexts({
  classes,
  assignments,
  teacherNames,
  submissions,
  batches,
  reports,
  observations
}: {
  classes: EnrollmentClassOption[];
  assignments: AdminReportAssignmentInput[];
  teacherNames: Map<string, string>;
  submissions: AdminReportSubmissionInput[];
  batches: AdminReportBatchInput[];
  reports: AdminReportRecordInput[];
  observations: AdminReportStudentObservationInput[];
}): AdminReportContextSummary[] {
  const subjectLookup = new Map<
    string,
    {
      classId: string;
      classNameEn: string;
      classNameAr: string | null;
      subjectNameEn: string;
      subjectNameAr: string | null;
      groups: Map<
        string,
        {
          nameEn: string;
          nameAr: string | null;
        }
      >;
    }
  >();

  for (const schoolClass of classes) {
    for (const subject of schoolClass.subjects) {
      subjectLookup.set(subject.id, {
        classId: schoolClass.id,
        classNameEn: schoolClass.nameEn,
        classNameAr: schoolClass.nameAr,
        subjectNameEn: subject.nameEn,
        subjectNameAr: subject.nameAr,
        groups: new Map(
          subject.groups.map((group) => [
            group.id,
            {
              nameEn: group.nameEn,
              nameAr: group.nameAr
            }
          ])
        )
      });
    }
  }

  const keys = new Set<string>();

  for (const assignment of assignments) {
    keys.add(
      contextKey(
        assignment.classSubjectId,
        assignment.subjectGroupId
      )
    );
  }

  for (const submission of submissions) {
    keys.add(
      contextKey(
        submission.classSubjectId,
        submission.subjectGroupId
      )
    );
  }

  for (const batch of batches) {
    if (
      batch.scopeType !== 'CLASS' &&
      batch.classSubjectId
    ) {
      keys.add(
        contextKey(
          batch.classSubjectId,
          batch.subjectGroupId
        )
      );
    }
  }

  return [...keys]
    .flatMap((key): AdminReportContextSummary[] => {
      const [classSubjectId, rawGroupId] = key.split(':');
      const subjectGroupId =
        rawGroupId === 'whole' ? null : rawGroupId;

      const subject = subjectLookup.get(classSubjectId);
      if (!subject) return [];

      const group = subjectGroupId
        ? subject.groups.get(subjectGroupId) ?? null
        : null;

      if (subjectGroupId && !group) return [];

      const contextAssignments = assignments.filter(
        (assignment) =>
          assignment.classSubjectId === classSubjectId &&
          assignment.subjectGroupId === subjectGroupId
      );

      const contextSubmissions = submissions.filter(
        (submission) =>
          submission.classSubjectId === classSubjectId &&
          submission.subjectGroupId === subjectGroupId
      );

      const contextBatches = batches
        .filter(
          (batch) =>
            batch.classId === subject.classId &&
            batch.classSubjectId === classSubjectId &&
            batch.subjectGroupId === subjectGroupId &&
            batch.scopeType ===
              (subjectGroupId ? 'GROUP' : 'SUBJECT')
        )
        .sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        );

      const batch = contextBatches[0] ?? null;

      const contextReports = batch
        ? reports.filter(
            (report) => report.batchId === batch.id
          )
        : [];

      const teacherIds = new Set([
        ...contextAssignments.map(({teacherId}) => teacherId),
        ...contextSubmissions.map(({teacherId}) => teacherId)
      ]);

      const submissionIds = new Set(
        contextSubmissions.map(({id}) => id)
      );

      const studentsWithComments = new Set(
        observations
          .filter(
            (observation) =>
              submissionIds.has(observation.submissionId) &&
              (
                hasText(observation.commentEn) ||
                hasText(observation.commentAr)
              )
          )
          .map(({studentId}) => studentId)
      );

      return [{
        classId: subject.classId,
        classNameEn: subject.classNameEn,
        classNameAr: subject.classNameAr,
        classSubjectId,
        subjectNameEn: subject.subjectNameEn,
        subjectNameAr: subject.subjectNameAr,
        subjectGroupId,
        groupNameEn: group?.nameEn ?? null,
        groupNameAr: group?.nameAr ?? null,
        teacherNames: [...teacherIds]
          .map(
            (teacherId) =>
              teacherNames.get(teacherId) ?? 'Teacher'
          )
          .sort((left, right) =>
            left.localeCompare(right)
          ),
        submissionCount: contextSubmissions.length,
        studentCommentCount: studentsWithComments.size,
        batchId: batch?.id ?? null,
        status: deriveReportContextStatus({
          submissionCount: contextSubmissions.length,
          batch,
          reports: contextReports
        })
      }];
    })
    .sort((left, right) =>
      [
        left.classNameEn,
        left.subjectNameEn,
        left.groupNameEn ?? ''
      ].join('\u0000').localeCompare(
        [
          right.classNameEn,
          right.subjectNameEn,
          right.groupNameEn ?? ''
        ].join('\u0000')
      )
    );
}
