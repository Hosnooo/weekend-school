import {describe, expect, it} from 'vitest';

import {
  countUnresolvedAttendanceConflicts,
  schoolWeekForDate,
  summarizeActionableDashboard,
  summarizeGroupSubmissions,
  summarizeTeachingUpdates
} from '@/features/dashboard/dashboard.model';

type TeachingContext = {
  teacherId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
};

type Submission = TeachingContext & {status: 'DRAFT' | 'SUBMITTED'};

const summarize = summarizeTeachingUpdates as unknown as (
  expectedContexts: TeachingContext[],
  submissions: Submission[]
) => {
  expectedCount: number;
  submittedCount: number;
  draftCount: number;
  missingCount: number;
  contexts: Array<TeachingContext & {status: 'MISSING' | 'DRAFT' | 'SUBMITTED'}>;
};

describe('dashboard summary rules', () => {
  it('uses the Monday-through-Sunday week containing the school-local date', () => {
    expect(schoolWeekForDate('2026-09-20')).toEqual({start: '2026-09-14', end: '2026-09-20'});
    expect(schoolWeekForDate('2026-09-21')).toEqual({start: '2026-09-21', end: '2026-09-27'});
    expect(schoolWeekForDate('2027-01-01')).toEqual({start: '2026-12-28', end: '2027-01-03'});
  });

  it('counts each active group once, even with multiple submitted sessions', () => {
    expect(summarizeGroupSubmissions(
      [{id: 'a', nameEn: 'A', nameAr: null}, {id: 'b', nameEn: 'B', nameAr: null}],
      [{group_id: 'a'}, {group_id: 'a'}, {group_id: 'retired'}]
    )).toEqual({submittedCount: 1, groups: [
      {id: 'a', nameEn: 'A', nameAr: null, submitted: true},
      {id: 'b', nameEn: 'B', nameAr: null, submitted: false}
    ]});
  });

  it('counts co-teachers as separate expected updates for the same context', () => {
    const teacherOne = {teacherId: 't1', classSubjectId: 'cs1', subjectGroupId: 'g1'};
    const teacherTwo = {teacherId: 't2', classSubjectId: 'cs1', subjectGroupId: 'g1'};
    const wholeClass = {teacherId: 't1', classSubjectId: 'cs2', subjectGroupId: null};

    expect(summarize(
      [teacherOne, teacherTwo, wholeClass, teacherOne],
      [
        {...teacherOne, status: 'SUBMITTED'},
        {...wholeClass, status: 'DRAFT'}
      ]
    )).toEqual({
      expectedCount: 3,
      submittedCount: 1,
      draftCount: 1,
      missingCount: 1,
      contexts: [
        {...teacherOne, status: 'SUBMITTED'},
        {...teacherTwo, status: 'MISSING'},
        {...wholeClass, status: 'DRAFT'}
      ]
    });
  });

  it('counts only unresolved mixed-status attendance conflicts once per context and student', () => {
    const observations = [
      {classSubjectId: 'cs1', subjectGroupId: 'g1', weekStart: '2026-09-21', studentId: 's1', status: 'PRESENT' as const},
      {classSubjectId: 'cs1', subjectGroupId: 'g1', weekStart: '2026-09-21', studentId: 's1', status: 'ABSENT' as const},
      {classSubjectId: 'cs2', subjectGroupId: null, weekStart: '2026-09-21', studentId: 's2', status: 'PRESENT' as const},
      {classSubjectId: 'cs2', subjectGroupId: null, weekStart: '2026-09-21', studentId: 's2', status: 'PRESENT' as const},
      {classSubjectId: 'cs3', subjectGroupId: 'g3', weekStart: '2026-09-21', studentId: 's3', status: 'PRESENT' as const},
      {classSubjectId: 'cs3', subjectGroupId: 'g3', weekStart: '2026-09-21', studentId: 's3', status: 'ABSENT' as const}
    ];
    const resolutions = [
      {classSubjectId: 'cs3', subjectGroupId: 'g3', weekStart: '2026-09-21', studentId: 's3'}
    ];

    expect(countUnresolvedAttendanceConflicts(observations, resolutions)).toBe(1);
  });

  it('combines teacher-context update status and unresolved conflicts for the actionable dashboard', () => {
    const teacherOne = {teacherId: 't1', classSubjectId: 'cs1', subjectGroupId: 'g1'};
    const teacherTwo = {teacherId: 't2', classSubjectId: 'cs1', subjectGroupId: 'g1'};
    const wholeClass = {teacherId: 't1', classSubjectId: 'cs2', subjectGroupId: null};
    const observations = [
      {classSubjectId: 'cs1', subjectGroupId: 'g1', weekStart: '2026-09-21', studentId: 's1', status: 'PRESENT' as const},
      {classSubjectId: 'cs1', subjectGroupId: 'g1', weekStart: '2026-09-21', studentId: 's1', status: 'ABSENT' as const}
    ];

    expect(summarizeActionableDashboard({
      expectedContexts: [teacherOne, teacherTwo, wholeClass],
      submissions: [
        {...teacherOne, status: 'SUBMITTED'},
        {...wholeClass, status: 'DRAFT'}
      ],
      observations,
      resolutions: []
    })).toMatchObject({
      expectedCount: 3,
      submittedCount: 1,
      draftCount: 1,
      missingCount: 1,
      unresolvedAttendanceConflicts: 1
    });
  });
});
