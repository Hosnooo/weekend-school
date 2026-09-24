import {describe, expect, it} from 'vitest';
import {renderReportEmail} from '@/features/email/report-email';
import type {ReportSnapshot, ReportSnapshotV2} from '@/features/reports/report.types';

const snapshot: ReportSnapshot = {
  version: 1,
  school: {nameEn: 'Weekend School', nameAr: 'مدرسة نهاية الأسبوع'},
  student: {id: 's', nameEn: 'Sara Ali', nameAr: 'سارة علي'},
  period: {start: '2026-09-01', end: '2026-09-30'},
  language: 'both',
  groups: [{id: 'g', nameEn: 'Level 1', nameAr: 'المستوى ١'}],
  attendance: {present: 1, absent: 0, late: 0, excused: 0, sessions: 1},
  progress: [{
    sessionDate: '2026-09-07',
    groupNameEn: 'Level 1',
    groupNameAr: 'المستوى ١',
    textEn: 'Letters',
    textAr: 'الحروف'
  }],
  currentPerformance: 'GOOD',
  comments: [],
  generatedAt: '2026-09-30T18:00:00Z'
};

const snapshotV2: ReportSnapshotV2 = {
  version: 2,
  school: {nameEn: 'MCE Weekend School', nameAr: 'مدرسة MCE لنهاية الأسبوع'},
  student: {id: 's', nameEn: 'Sara Ali', nameAr: 'سارة علي'},
  class: {id: 'class-1', nameEn: 'Level 1', nameAr: 'المستوى ١'},
  period: {start: '2026-09-01', end: '2026-09-30'},
  language: 'both',
  sections: [{
    classSubjectId: 'cs-quran',
    subjectNameEn: 'Quran',
    subjectNameAr: 'القرآن',
    groupNameEn: 'Quran A',
    groupNameAr: 'القرآن أ',
    approvedProgressEn: 'Surah Al-Fatiha',
    approvedProgressAr: 'سورة الفاتحة',
    performance: 'GOOD',
    attendance: {present: 3, absent: 1, sessions: 4},
    commentEn: 'Steady recitation',
    commentAr: null
  }],
  template: {introEn: null, introAr: null, closingEn: null, closingAr: null},
  author: 'MCE Weekend School',
  generatedAt: '2026-09-30T18:00:00Z'
};

describe('report email', () => {
  it('renders the shared bilingual v1 report content in an email document', () => {
    const html = renderReportEmail(snapshot);
    expect(html).toContain('Student Report / تقرير الطالب');
    expect(html).toContain('Letters');
    expect(html).toContain('الحروف');
  });

  it('renders the same immutable v2 subject-aware snapshot used by browser reports', () => {
    const html = renderReportEmail(snapshotV2);
    expect(html).toContain('MCE Weekend School');
    expect(html).toContain('Quran');
    expect(html).toContain('Surah Al-Fatiha');
    expect(html).toContain('سورة الفاتحة');
  });
});
