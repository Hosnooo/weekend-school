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

  it('renders bilingual narrative as separate directional blocks and preserves new lines', () => {
    const bilingual: ReportSnapshotV2 = {
      ...snapshot,
      language: 'both',
      template: {
        ...snapshot.template,
        introEn: 'Welcome\nFamily',
        introAr: 'مرحباً\nبالعائلة',
        studentCommentsEnabled: true
      },
      sections: [
        {
          ...snapshot.sections[0],
          approvedProgressEn: 'Line one\nLine two',
          approvedProgressAr: 'السطر الأول\nالسطر الثاني',
          commentEn: 'English note\nSecond line',
          commentAr: 'ملاحظة عربية\nسطر ثان'
        }
      ]
    };

    const html = renderStudentReportV2(bilingual);

    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain('Line one<br>Line two');
    expect(html).toContain('السطر الأول<br>السطر الثاني');
    expect(html).not.toContain('Line one<br>Line two / السطر الأول');
    expect(html).not.toContain('English note / ملاحظة عربية');
  });

  it('renders only the language that actually has narrative content', () => {
    const arabicOnly: ReportSnapshotV2 = {
      ...snapshot,
      language: 'both',
      template: {
        ...snapshot.template,
        mainReportLabelEn: null,
        mainReportLabelAr: 'التقرير الرئيسي',
        introEn: null,
        introAr: 'مقدمة عربية',
        closingEn: null,
        closingAr: null
      },
      sections: [
        {
          ...snapshot.sections[0],
          approvedProgressEn: null,
          approvedProgressAr: 'محتوى عربي فقط'
        }
      ]
    };

    const html = renderStudentReportV2(arabicOnly);

    expect(html).toContain('محتوى عربي فقط');
    expect(html).not.toContain('Completed Surah review.');
    expect(html).not.toContain('Weekly learning');
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
