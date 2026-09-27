import {describe, expect, it} from 'vitest';

import {buildAdminReportWorkspaceModel} from '@/features/reports/admin-report-workspace.model';
import {defaultReportTemplateConfig} from '@/features/reports/report-template.types';

const context = {
  classId: 'class-1',
  classNameEn: 'Level 1',
  classNameAr: 'المستوى ١',
  classSubjectId: 'subject-1',
  subjectNameEn: 'Quran',
  subjectNameAr: 'القرآن',
  subjectGroupId: null,
  groupNameEn: null,
  groupNameAr: null,
  teacherNames: ['Teacher One'],
  submissionCount: 2,
  studentCommentCount: 1,
  batchId: 'batch-1',
  status: 'READY_FOR_REVIEW' as const
};

describe('admin report workspace', () => {
  it('shows one shared report and only students with comments', () => {
    const model = buildAdminReportWorkspaceModel({
      context,
      template: defaultReportTemplateConfig(),
      batch: {
        id: 'batch-1',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        status: 'DRAFT'
      },
      approval: {
        approvedProgressEn: 'Shared English report',
        approvedProgressAr: 'التقرير المشترك',
        performance: 'GOOD'
      },
      students: [
        {
          studentId: 'student-1',
          studentNameEn: 'Ahmad Ali',
          studentNameAr: 'أحمد علي',
          presentCount: 2,
          absentCount: 0,
          attendanceConflictCount: 0,
          commentEn: 'Strong week',
          commentAr: null
        },
        {
          studentId: 'student-2',
          studentNameEn: 'Sara Noor',
          studentNameAr: 'سارة نور',
          presentCount: 1,
          absentCount: 1,
          attendanceConflictCount: 1,
          commentEn: '   ',
          commentAr: null
        }
      ],
      reports: []
    });

    expect(model.mainReportEn).toBe('Shared English report');
    expect(model.mainReportAr).toBe('التقرير المشترك');
    expect(model.performance).toBe('GOOD');

    expect(model.studentComments).toEqual([
      {
        studentId: 'student-1',
        studentNameEn: 'Ahmad Ali',
        studentNameAr: 'أحمد علي',
        commentEn: 'Strong week',
        commentAr: null
      }
    ]);

    expect(model.attendanceSummary).toHaveLength(2);
    expect(model.canEdit).toBe(true);
    expect(model.canReopen).toBe(false);
  });

  it('allows reopening only finalized reports with no successful or pending delivery', () => {
    const editable = buildAdminReportWorkspaceModel({
      context: {
        ...context,
        status: 'READY_TO_SEND'
      },
      template: defaultReportTemplateConfig(),
      batch: {
        id: 'batch-1',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        status: 'FINALIZED'
      },
      approval: null,
      students: [],
      reports: [
        {
          id: 'report-1',
          status: 'READY',
          deliveryStatuses: []
        }
      ]
    });

    expect(editable.canEdit).toBe(false);
    expect(editable.canReopen).toBe(true);

    const sent = buildAdminReportWorkspaceModel({
      context: {
        ...context,
        status: 'SENT'
      },
      template: defaultReportTemplateConfig(),
      batch: {
        id: 'batch-1',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        status: 'FINALIZED'
      },
      approval: null,
      students: [],
      reports: [
        {
          id: 'report-1',
          status: 'SENT',
          deliveryStatuses: ['SENT']
        }
      ]
    });

    expect(sent.canReopen).toBe(false);
  });
});

describe('admin report workspace repository contract', () => {
  it('exposes reopening through the protected database function', async () => {
    const {readFile} = await import('node:fs/promises');

    const source = await readFile(
      'src/features/reports/admin-report-workspace.repository.ts',
      'utf8'
    );

    expect(source).toContain('reopenAdminReportWorkspace');
    expect(source).toMatch(
      /\.rpc\([^]*['"]reopen_unsent_report_batch['"]/
    );
  });
});

describe('admin report workspace loading contract', () => {
  it('reloads saved comment overrides and unresolved attendance conflicts', async () => {
    const {readFile} = await import('node:fs/promises');

    const source = await readFile(
      'src/features/reports/admin-report-workspace.repository.ts',
      'utf8'
    );

    expect(source).toContain(
      "select('student_id,comment_en,comment_ar')"
    );
    expect(source).toContain('attendance_resolutions');
    expect(source).toContain('attendanceConflicts');
  });
});
