import {readFileSync} from 'node:fs';

import {describe, expect, it} from 'vitest';

import {studentBelongsToReportContext} from '@/features/reports/report-source-roster';
import {renderReportEmail} from '@/features/email/report-email';
import {defaultReportTemplateConfig} from '@/features/reports/report-template.types';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('live Class Report Cycle regressions', () => {
  it('uses source observations as the historical roster for grouped report contexts', () => {
    const observations = [
      {submissionId: 'a-source', studentId: 'student-a'},
      {submissionId: 'a-source', studentId: 'student-b'}
    ];

    expect(studentBelongsToReportContext({
      studentId: 'student-b',
      subjectGroupId: 'group-a',
      selectedSourceIds: ['a-source'],
      observations,
      currentMembership: false
    })).toBe(true);

    expect(studentBelongsToReportContext({
      studentId: 'student-c',
      subjectGroupId: 'group-a',
      selectedSourceIds: ['a-source'],
      observations,
      currentMembership: true
    })).toBe(false);
  });

  it('replaces View update with an Edit update link to the report editor', () => {
    const sources = read('src/features/reports/report-cycle-sources.tsx');

    expect(sources).toContain('Edit update');
    expect(sources).not.toContain('View update');
    expect(sources).toContain('href="#report-edit"');
    expect(sources).toContain('id="report-edit"');
  });

  it('renders Arabic email copy for bilingual report snapshots', () => {
    const template = defaultReportTemplateConfig();
    const html = renderReportEmail({
      version: 2,
      school: {nameEn: 'Weekend School', nameAr: 'مدرسة نهاية الأسبوع'},
      student: {id: 'student-a', nameEn: 'Sara Ali', nameAr: 'سارة علي'},
      class: {id: 'class-a', nameEn: 'Class A', nameAr: 'الصف أ'},
      period: {start: '2026-09-19', end: '2026-09-27'},
      language: 'both',
      sections: [{
        classSubjectId: 'subject-a',
        subjectNameEn: 'Arabic Language',
        subjectNameAr: 'اللغة العربية',
        groupNameEn: 'A',
        groupNameAr: 'أ',
        approvedProgressEn: 'English progress',
        approvedProgressAr: 'التقدم بالعربية',
        performance: null,
        attendance: {present: 1, absent: 0, sessions: 1},
        commentEn: null,
        commentAr: null,
        sourceTeacherNames: ['Teacher']
      }],
      template,
      author: 'MCE Weekend School',
      generatedAt: '2026-10-01T00:00:00.000Z'
    } as never);

    expect(html).toContain('ولي الأمر الكريم');
    expect(html).toContain('يرجى الاطلاع أدناه');
    expect(html).toContain('التقدم بالعربية');
    expect(html).toContain('dir="rtl"');
  });
});
