import {describe, expect, it} from 'vitest';

import {buildAdminReportWorkspaceModel} from '@/features/reports/admin-report-workspace.model';
import {defaultReportTemplateConfig} from '@/features/reports/report-template.types';

describe('Admin report individual performance', () => {
  it('keeps a separate performance value for every student', () => {
    const model = buildAdminReportWorkspaceModel({
      context: {
        classId: 'class-1',
        classSubjectId: 'cs-1',
        subjectGroupId: null,
        classNameEn: 'Foundations',
        classNameAr: null,
        subjectNameEn: 'Faith & Character',
        subjectNameAr: null,
        groupNameEn: null,
        groupNameAr: null,
        teacherNames: ['Teacher One'],
        submissionCount: 1,
        studentCommentCount: 0,
        batchId: 'batch-1',
        status: 'READY_FOR_REVIEW'
      },
      template: {
        ...defaultReportTemplateConfig(),
        id: 'template-1'
      },
      batch: {
        id: 'batch-1',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        status: 'DRAFT'
      },
      approval: {
        approvedProgressEn: 'Class progress',
        approvedProgressAr: null,
        performance: 'GOOD'
      },
      students: [
        {
          studentId: 'student-1',
          studentNameEn: 'Sara Ali',
          studentNameAr: null,
          presentCount: 3,
          absentCount: 0,
          attendanceConflictCount: 0,
          performance: 'EXCELLENT',
          commentEn: null,
          commentAr: null
        },
        {
          studentId: 'student-2',
          studentNameEn: 'Omar Ali',
          studentNameAr: null,
          presentCount: 2,
          absentCount: 1,
          attendanceConflictCount: 0,
          performance: 'NEEDS_SUPPORT',
          commentEn: null,
          commentAr: null
        }
      ],
      reports: []
    });

    expect(model.attendanceSummary[0]).toMatchObject({
      studentId: 'student-1',
      performance: 'EXCELLENT'
    });
    expect(model.attendanceSummary[1]).toMatchObject({
      studentId: 'student-2',
      performance: 'NEEDS_SUPPORT'
    });
  });
});
