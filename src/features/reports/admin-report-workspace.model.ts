import type {AttendanceConflict} from '@/features/attendance/attendance.types';

import type {AdminReportContextSummary} from './admin-report-contexts';
import type {ReportTemplateConfig} from './report-template.types';
import type {ReportPerformance} from './report.types';

export type AdminReportWorkspaceModel = {
  context: AdminReportContextSummary;
  batchId: string;
  periodStart: string;
  periodEnd: string;
  template: ReportTemplateConfig;
  mainReportEn: string | null;
  mainReportAr: string | null;
  performance: ReportPerformance | null;
  studentComments: Array<{
    studentId: string;
    studentNameEn: string;
    studentNameAr: string | null;
    commentEn: string | null;
    commentAr: string | null;
  }>;
  attendanceSummary: Array<{
    studentId: string;
    studentNameEn: string;
    studentNameAr: string | null;
    presentCount: number;
    absentCount: number;
    conflictCount: number;
  }>;
  attendanceConflicts: AttendanceConflict[];
  reportIds: string[];
  canEdit: boolean;
  canReopen: boolean;
};

type WorkspaceInput = {
  context: AdminReportContextSummary;
  template: ReportTemplateConfig;
  batch: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: 'DRAFT' | 'REVIEW' | 'FINALIZED';
  };
  approval: {
    approvedProgressEn: string | null;
    approvedProgressAr: string | null;
    performance: ReportPerformance | null;
  } | null;
  students: Array<{
    studentId: string;
    studentNameEn: string;
    studentNameAr: string | null;
    presentCount: number;
    absentCount: number;
    attendanceConflictCount: number;
    commentEn: string | null;
    commentAr: string | null;
  }>;
  reports: Array<{
    id: string;
    status: 'DRAFT' | 'READY' | 'SENT' | 'FAILED';
    deliveryStatuses: Array<
      'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED'
    >;
  }>;
  attendanceConflicts?: AttendanceConflict[];
};

function clean(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildAdminReportWorkspaceModel({
  context,
  template,
  batch,
  approval,
  students,
  reports,
  attendanceConflicts = []
}: WorkspaceInput): AdminReportWorkspaceModel {
  const hasProtectedDelivery = reports.some((report) =>
    report.deliveryStatuses.some((status) =>
      status === 'PENDING' ||
      status === 'SENT' ||
      status === 'DELIVERED'
    )
  );

  return {
    context,
    batchId: batch.id,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    template,
    mainReportEn: approval?.approvedProgressEn ?? null,
    mainReportAr: approval?.approvedProgressAr ?? null,
    performance: approval?.performance ?? null,
    studentComments: students.flatMap((student) => {
      const commentEn = clean(student.commentEn);
      const commentAr = clean(student.commentAr);

      return commentEn || commentAr
        ? [{
            studentId: student.studentId,
            studentNameEn: student.studentNameEn,
            studentNameAr: student.studentNameAr,
            commentEn,
            commentAr
          }]
        : [];
    }),
    attendanceSummary: students.map((student) => ({
      studentId: student.studentId,
      studentNameEn: student.studentNameEn,
      studentNameAr: student.studentNameAr,
      presentCount: student.presentCount,
      absentCount: student.absentCount,
      conflictCount: student.attendanceConflictCount
    })),
    attendanceConflicts,
    reportIds: reports.map(({id}) => id),
    canEdit: batch.status !== 'FINALIZED',
    canReopen:
      batch.status === 'FINALIZED' &&
      !hasProtectedDelivery
  };
}
