import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

import {renderStudentReportV2} from '@/features/reports/report.renderer';
import type {ReportSnapshotV2} from '@/features/reports/report.types';

const snapshot: ReportSnapshotV2 = {
  version: 2,
  school: {
    nameEn: 'Weekend School',
    nameAr: 'مدرسة نهاية الأسبوع'
  },
  student: {
    id: 'student-1',
    nameEn: 'Ahmad Ali',
    nameAr: 'أحمد علي'
  },
  class: {
    id: 'class-1',
    nameEn: 'Level 1',
    nameAr: 'المستوى ١'
  },
  period: {
    start: '2026-09-01',
    end: '2026-09-30'
  },
  language: 'en',
  sections: [
    {
      classSubjectId: 'subject-1',
      subjectNameEn: 'Quran',
      subjectNameAr: 'القرآن',
      groupNameEn: null,
      groupNameAr: null,
      approvedProgressEn: 'Completed Surah review.',
      approvedProgressAr: null,
      performance: 'GOOD',
      attendance: {
        present: 3,
        absent: 1,
        sessions: 4
      },
      commentEn: 'Excellent participation.',
      commentAr: null
    }
  ],
  template: {
    name: 'Weekly family report',
    mainReportLabelEn: 'Weekly learning',
    mainReportLabelAr: 'التعلم الأسبوعي',
    mainReportHelpEn: 'What happened this week',
    mainReportHelpAr: 'ما حدث هذا الأسبوع',
    performanceEnabled: false,
    performanceLabelEn: 'Progress level',
    performanceLabelAr: 'مستوى التقدم',
    studentCommentsEnabled: false,
    studentCommentLabelEn: 'Individual note',
    studentCommentLabelAr: 'ملاحظة فردية',
    studentCommentHelpEn: 'Only when needed',
    studentCommentHelpAr: 'عند الحاجة فقط',
    introEn: 'Welcome',
    introAr: null,
    closingEn: 'Thank you',
    closingAr: null
  },
  author: 'MCE Weekend School',
  generatedAt: '2026-09-27T12:00:00.000Z'
};

describe('report-template finalized snapshot', () => {
  it('renders configured wording and hides disabled optional sections', () => {
    const html = renderStudentReportV2(snapshot);

    expect(html).toContain('Weekly learning');
    expect(html).toContain('Completed Surah review.');

    expect(html).not.toContain('Progress level');
    expect(html).not.toContain('Excellent participation.');
  });

  it('finalization loads the active template instead of hard-coded null wording', () => {
    const source = readFileSync(
      'src/features/reports/report-batch.repository.ts',
      'utf8'
    );

    expect(source).toContain('getActiveReportTemplate');
    expect(source).toContain('mainReportLabelEn');
    expect(source).toContain('performanceEnabled');
    expect(source).toContain('studentCommentsEnabled');

    expect(source).not.toContain(
      'template: {introEn: null, introAr: null, closingEn: null, closingAr: null}'
    );
  });
});
