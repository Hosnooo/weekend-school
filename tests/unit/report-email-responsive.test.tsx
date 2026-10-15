import {describe, expect, it} from 'vitest';

import {renderReportEmail} from '@/features/email/report-email';
import type {ReportSnapshotV2} from '@/features/reports/report.types';

const base: ReportSnapshotV2 = {
  version: 2,
  school: {nameEn: 'Weekend School', nameAr: 'مدرسة نهاية الأسبوع'},
  student: {id: 's', nameEn: 'Sara Ali', nameAr: 'سارة علي'},
  class: {id: 'c', nameEn: 'Foundations', nameAr: 'الأساسيات'},
  period: {start: '2026-10-10', end: '2026-10-11'},
  language: 'both',
  sections: [
    {
      classSubjectId: 'q', subjectNameEn: 'Quran', subjectNameAr: 'القرآن',
      groupNameEn: null, groupNameAr: null,
      approvedProgressEn: 'Practice recitation', approvedProgressAr: 'تدرّب على التلاوة',
      performance: null, attendance: {present: 3, absent: 1, sessions: 4},
      commentEn: null, commentAr: null
    },
    {
      classSubjectId: 'a', subjectNameEn: 'Arabic', subjectNameAr: 'العربية',
      groupNameEn: null, groupNameAr: null,
      approvedProgressEn: 'Write letters', approvedProgressAr: 'كتابة الحروف',
      performance: null, attendance: {present: 4, absent: 0, sessions: 4},
      commentEn: null, commentAr: null
    }
  ],
  template: {introEn: null, introAr: null, closingEn: null, closingAr: null},
  author: 'Weekend School',
  generatedAt: '2026-10-14T18:00:00Z'
};

describe('guardian email readability across viewport sizes', () => {
  it('uses a fluid narrow-screen container with desktop-only spacing enhancements', () => {
    const html = renderReportEmail(base);
    expect(html).toContain('width=device-width,initial-scale=1');
    expect(html).toContain('guardian-email-card');
    expect(html).toContain('max-width:640px');
    expect(html).toContain('width:100%');
    expect(html).toContain('padding:18px 16px');
    expect(html).toContain('@media screen and (min-width: 600px)');
  });

  it('uses table-based separators that are visible without report head styles', () => {
    const html = renderReportEmail(base);
    expect(html.split('border-top:1px solid #d6e0e5')).toHaveLength(2);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('class="report-subject-section"');
    expect(html).toContain('background-color:#f1f5f8');
    expect(html.indexOf('Practice recitation')).toBeLessThan(
      html.indexOf('border-top:1px solid #d6e0e5')
    );
    expect(html.indexOf('border-top:1px solid #d6e0e5')).toBeLessThan(
      html.indexOf('Write letters')
    );
  });

  it('keeps readable bilingual direction, approved content and attendance intact', () => {
    const html = renderReportEmail(base);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('font-size:15px;line-height:1.75');
    expect(html).toContain('Attendance: 3 of 4 sessions');
    expect(html).toContain('الحضور: 3 من 4 حصص');
    expect(html).toContain('Write letters');
    expect(html).toContain('كتابة الحروف');
    expect(html).not.toContain('Source / المصدر');
  });

  it('renders the same deterministic HTML for successive review/send renderings', () => {
    expect(renderReportEmail(base)).toBe(renderReportEmail(base));
  });
});
