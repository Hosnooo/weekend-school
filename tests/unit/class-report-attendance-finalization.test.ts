import {readFileSync} from 'node:fs';

import {describe, expect, it} from 'vitest';

import {renderStudentReportV2} from '@/features/reports/report.renderer';
import type {ReportSnapshotV2} from '@/features/reports/report.types';

describe('Class Report Cycle finalized attendance', () => {
  it('uses the shared attendance resolver and stored Admin override fields', () => {
    const source = readFileSync(
      'src/features/reports/class-report-finalization.repository.ts',
      'utf8'
    );

    expect(source).toContain('deriveReportAttendance');
    expect(source).toContain('effectiveReportAttendance');
    expect(source).toContain('attendance_attended');
    expect(source).toContain('attendance_total');
    expect(source).toContain('onlyStudentId');
  });

  it('renders one attended-out-of-total metric for each V2 subject', () => {
    const snapshot: ReportSnapshotV2 = {
      version: 2,
      school: {nameEn: 'Weekend School', nameAr: 'مدرسة نهاية الأسبوع'},
      student: {id: 'student-1', nameEn: 'Sara Ali', nameAr: 'سارة علي'},
      class: {id: 'class-1', nameEn: 'Level 1', nameAr: 'المستوى ١'},
      period: {start: '2026-09-01', end: '2026-09-30'},
      language: 'both',
      sections: [
        {
          classSubjectId: 'subject-1',
          subjectNameEn: 'Quran',
          subjectNameAr: 'القرآن',
          groupNameEn: null,
          groupNameAr: null,
          approvedProgressEn: 'Good progress',
          approvedProgressAr: 'تقدم جيد',
          performance: null,
          attendance: {present: 7, absent: 1, sessions: 8},
          commentEn: null,
          commentAr: null
        }
      ],
      template: {
        performanceEnabled: false,
        studentCommentsEnabled: false,
        introEn: null,
        introAr: null,
        closingEn: null,
        closingAr: null
      },
      author: 'MCE Weekend School',
      generatedAt: '2026-10-01T00:00:00.000Z'
    };

    const html = renderStudentReportV2(snapshot);

    expect(html).toContain('Attendance: 7 of 8 sessions');
    expect(html).toContain('الحضور: 7 من 8 حصص');
    expect(html).not.toContain('Present:');
    expect(html).not.toContain('Absent:');
  });
});
