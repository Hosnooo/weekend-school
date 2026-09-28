import {describe, expect, it} from 'vitest';

import {
  renderReportEmail,
  renderReportEmailSubject
} from '@/features/email/report-email';
import type {ReportSnapshotV2} from '@/features/reports/report.types';

const snapshot = {
  version: 2,
  school: {
    nameEn: 'Weekend School',
    nameAr: 'مدرسة نهاية الأسبوع'
  },
  student: {
    id: 'student-1',
    nameEn: 'Sara Ali',
    nameAr: 'سارة علي'
  },
  class: {
    id: 'class-1',
    nameEn: 'Foundations',
    nameAr: 'الأساسيات'
  },
  period: {
    start: '2026-09-01',
    end: '2026-09-30'
  },
  language: 'both',
  sections: [],
  template: {
    mainReportLabelEn: 'Main report',
    mainReportLabelAr: 'التقرير الرئيسي',
    mainReportHelpEn: null,
    mainReportHelpAr: null,
    performanceEnabled: true,
    performanceLabelEn: 'Performance',
    performanceLabelAr: 'الأداء',
    studentCommentsEnabled: true,
    studentCommentLabelEn: 'Student comments',
    studentCommentLabelAr: 'ملاحظات الطالب',
    studentCommentHelpEn: null,
    studentCommentHelpAr: null,
    introEn: null,
    introAr: null,
    closingEn: null,
    closingAr: null,

    emailSubjectEn:
      '{{student_name}} — {{school_name}} Student Report',
    emailSubjectAr:
      'تقرير {{student_name}} — {{school_name}}',
    emailGreetingEn: 'Dear Parent/Guardian,',
    emailGreetingAr: 'ولي الأمر الكريم،',
    emailMessageEn:
      'Please find below {{student_name}} report for {{period_start}} to {{period_end}}.',
    emailMessageAr:
      'يرجى الاطلاع أدناه على تقرير {{student_name}} للفترة من {{period_start}} إلى {{period_end}}.',
    emailClosingEn: 'Regards,',
    emailClosingAr: 'مع التحية،',
    emailSignoffEn: '{{school_name}}',
    emailSignoffAr: '{{school_name}}'
  },
  author: 'Weekend School',
  generatedAt: '2026-09-30T18:00:00Z'
} as unknown as ReportSnapshotV2;

describe('customizable report email', () => {
  it('renders configured bilingual wrapper copy with safe placeholders', () => {
    const html = renderReportEmail(snapshot);

    expect(html).toContain('Dear Parent/Guardian,');
    expect(html).toContain('ولي الأمر الكريم،');
    expect(html).toContain('Sara Ali');
    expect(html).toContain('سارة علي');
    expect(html).toContain('2026-09-01');
    expect(html).toContain('2026-09-30');
    expect(html).toContain('Regards,');
    expect(html).toContain('مع التحية،');
  });

  it('renders the configured subject for the report language', () => {
    expect(renderReportEmailSubject(snapshot)).toBe(
      'Sara Ali — Weekend School Student Report / ' +
        'تقرير سارة علي — مدرسة نهاية الأسبوع'
    );
  });
});
