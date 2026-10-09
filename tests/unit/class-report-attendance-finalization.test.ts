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

  it('never substitutes Teacher text for saved Admin-approved text or a blank', () => {
    const source = readFileSync(
      'src/features/reports/class-report-finalization.repository.ts',
      'utf8'
    );
    expect(source).toContain('explicitOverride?.progress_en_overridden');
    expect(source).toContain('explicitOverride?.progress_ar_overridden');
    expect(source).toContain('approval.progressEnApproved');
    expect(source).toContain('approval.progressArApproved');
    expect(source).toContain('? approval.approvedProgressEn');
    expect(source).toContain('? approval.approvedProgressAr');
    expect(source).not.toMatch(
      /partialCoverage\\s*\\?\\s*joinUnique\\(selectedSources\\.map\\(\\(\\{progress(En|Ar)\\}/
    );
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

    const missing = renderStudentReportV2({
      ...snapshot,
      sections: [{
        ...snapshot.sections[0]!,
        attendance: {present: 0, absent: 0, sessions: 0}
      }]
    });
    expect(missing).toContain('Attendance: Not recorded');
    expect(missing).toContain('الحضور: غير مسجل');
    expect(missing).not.toContain('Attendance: 0 of 0 sessions');

    const disputed = renderStudentReportV2({
      ...snapshot,
      sections: [{
        ...snapshot.sections[0]!,
        attendance: {present: 7, absent: 1, sessions: 8, unverified: true}
      }]
    });
    expect(disputed).toContain('Attendance: Not recorded');
  });

  it('clears report text overrides without requiring DELETE privileges', () => {
    const repository = readFileSync('src/features/reports/class-report-review.repository.ts', 'utf8');
    expect(repository).not.toMatch(/\.from\('report_student_overrides'\)\s*\.delete\(\)/);
    expect(repository).toContain(
      'fields.performance_overridden = student.performanceOverridden'
    );
    expect(repository).toContain('if (input.includePerformance)');
    expect(repository).toContain('if (input.includeStudentComments)');
    expect(repository).toContain('.update(fields)');
    expect(repository).toContain('.insert({');
    expect(repository).not.toContain('performance_overridden: false');
  });
});
