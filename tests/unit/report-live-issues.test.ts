import {describe, expect, it} from 'vitest';

import {
  eligibleReportSourcesForStudent,
  studentBelongsToReportContext
} from '@/features/reports/report-source-roster';
import {renderReportEmail} from '@/features/email/report-email';
import {defaultReportTemplateConfig} from '@/features/reports/report-template.types';

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

  it('includes only sources overlapping class and group enrollment dates', () => {
    const input = {
      studentId: 'omar',
      classSubjectId: 'arabic',
      subjectGroupId: 'B',
      reportStart: '2026-09-19',
      reportEnd: '2026-10-04',
      sources: [
        {id: 'september', coverageKind: 'RANGE' as const, periodStart: '2026-09-19', periodEnd: '2026-09-27', coveredDates: []},
        {id: 'october', coverageKind: 'RANGE' as const, periodStart: '2026-10-03', periodEnd: '2026-10-04', coveredDates: []}
      ],
      enrollments: [{student_id: 'omar', starts_on: '2026-10-02', ends_on: null}],
      memberships: [{student_id: 'omar', class_subject_id: 'arabic', subject_group_id: 'B', starts_on: '2026-10-02', ends_on: null}],
      exclusions: []
    };
    expect(eligibleReportSourcesForStudent(input).map(({id}) => id)).toEqual(['october']);
    expect(eligibleReportSourcesForStudent({
      ...input,
      studentId: 'jade',
      enrollments: [{student_id: 'jade', starts_on: '2026-09-19', ends_on: null}],
      memberships: [{student_id: 'jade', class_subject_id: 'arabic', subject_group_id: 'B', starts_on: '2026-09-19', ends_on: null}]
    }).map(({id}) => id)).toEqual(['september', 'october']);
  });

  it('requires concurrent group membership and honors exact dates and exclusions', () => {
    const options = {
      studentId: 'student',
      classSubjectId: 'arabic',
      subjectGroupId: 'B',
      reportStart: '2026-09-19',
      reportEnd: '2026-10-04',
      sources: [
        {id: 'dated', coverageKind: 'DATES' as const, periodStart: '2026-09-19', periodEnd: '2026-10-04', coveredDates: ['2026-09-20', '2026-10-03']},
        {id: 'range', coverageKind: 'RANGE' as const, periodStart: '2026-10-03', periodEnd: '2026-10-04', coveredDates: []}
      ],
      enrollments: [{student_id: 'student', starts_on: '2026-10-02', ends_on: null}],
      memberships: [{student_id: 'student', class_subject_id: 'arabic', subject_group_id: 'B', starts_on: '2026-10-04', ends_on: null}],
      exclusions: []
    };
    expect(eligibleReportSourcesForStudent(options).map(({id}) => id)).toEqual(['range']);
    expect(eligibleReportSourcesForStudent({
      ...options,
      memberships: [{...options.memberships[0], starts_on: '2026-10-03'}],
      exclusions: [{student_id: 'student', class_subject_id: 'arabic', starts_on: '2026-10-03', ends_on: '2026-10-03'}]
    }).map(({id}) => id)).toEqual(['range']);
    expect(eligibleReportSourcesForStudent({
      ...options,
      exclusions: [{student_id: 'student', class_subject_id: 'arabic', starts_on: '2026-10-03', ends_on: null}]
    })).toEqual([]);
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
