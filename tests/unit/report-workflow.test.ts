import {describe, expect, it} from 'vitest';

import {
  buildReportRevisionMetadata,
  transitionReportBatchStatus
} from '@/features/reports/report.service';
import type {ReportSnapshotV2} from '@/features/reports/report.types';

const snapshot: ReportSnapshotV2 = {
  version: 2,
  school: {nameEn: 'MCE Weekend School', nameAr: 'مدرسة MCE لنهاية الأسبوع'},
  student: {id: 'student-1', nameEn: 'Sara Ali', nameAr: 'سارة علي'},
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

describe('report batch workflow', () => {
  it('allows only Draft -> Review -> Finalized progression', () => {
    expect(transitionReportBatchStatus('DRAFT', 'REVIEW')).toBe('REVIEW');
    expect(transitionReportBatchStatus('REVIEW', 'FINALIZED')).toBe('FINALIZED');
    expect(() => transitionReportBatchStatus('DRAFT', 'FINALIZED')).toThrow(/review/i);
    expect(() => transitionReportBatchStatus('FINALIZED', 'REVIEW')).toThrow(/finalized/i);
  });

  it('creates correction metadata as a new revision without mutating the finalized snapshot', () => {
    const before = JSON.stringify(snapshot);
    const metadata = buildReportRevisionMetadata({id: 'report-2', revision: 2, snapshot});

    expect(metadata).toEqual({revision: 3, supersedesReportId: 'report-2'});
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});
