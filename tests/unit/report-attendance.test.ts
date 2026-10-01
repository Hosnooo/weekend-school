import {describe, expect, it} from 'vitest';

import {
  deriveReportAttendance,
  effectiveReportAttendance,
  reportAttendanceOverride
} from '@/features/reports/report-attendance';

describe('report attendance', () => {
  const sources = [
    {id: 'source-1', weekStart: '2026-09-19'},
    {id: 'source-2', weekStart: '2026-09-19'},
    {id: 'source-3', weekStart: '2026-09-26'}
  ];

  const observations = [
    {
      submissionId: 'source-1',
      studentId: 'student-1',
      attendanceStatus: 'PRESENT' as const
    },
    {
      submissionId: 'source-2',
      studentId: 'student-1',
      attendanceStatus: 'ABSENT' as const
    },
    {
      submissionId: 'source-3',
      studentId: 'student-1',
      attendanceStatus: 'PRESENT' as const
    }
  ];

  it('derives attended and total sessions from one official status per week', () => {
    const result = deriveReportAttendance({
      sources,
      observations,
      resolutions: [
        {
          classSubjectId: 'subject-1',
          subjectGroupId: null,
          weekStart: '2026-09-19',
          studentId: 'student-1',
          resolvedStatus: 'ABSENT' as const
        }
      ],
      classSubjectId: 'subject-1',
      subjectGroupId: null,
      studentId: 'student-1'
    });

    expect(result).toEqual({
      attended: 1,
      total: 2,
      unresolvedConflicts: 0
    });
  });

  it('reports unresolved source disagreement without inventing a session result', () => {
    const result = deriveReportAttendance({
      sources,
      observations,
      resolutions: [],
      classSubjectId: 'subject-1',
      subjectGroupId: null,
      studentId: 'student-1'
    });

    expect(result).toEqual({
      attended: 1,
      total: 1,
      unresolvedConflicts: 1
    });
  });

  it('uses a complete Admin override as the authoritative report attendance', () => {
    const source = {
      attended: 1,
      total: 1,
      unresolvedConflicts: 1
    };

    expect(
      effectiveReportAttendance(source, 7, 8)
    ).toEqual({
      attended: 7,
      total: 8,
      unresolvedConflicts: 0,
      overridden: true
    });

    expect(
      effectiveReportAttendance(source, null, null)
    ).toEqual({
      ...source,
      overridden: false
    });
  });

  it('does not create an override when unchanged derived attendance is saved', () => {
    expect(
      reportAttendanceOverride({
        submittedAttended: 3,
        submittedTotal: 4,
        sourceAttended: 3,
        sourceTotal: 4,
        wasOverridden: false
      })
    ).toEqual({attendanceAttended: null, attendanceTotal: null});
  });

  it('stores only intentional Admin changes and clears an existing override when blank', () => {
    expect(
      reportAttendanceOverride({
        submittedAttended: 7,
        submittedTotal: 8,
        sourceAttended: 3,
        sourceTotal: 4,
        wasOverridden: false
      })
    ).toEqual({attendanceAttended: 7, attendanceTotal: 8});

    expect(
      reportAttendanceOverride({
        submittedAttended: null,
        submittedTotal: null,
        sourceAttended: 3,
        sourceTotal: 4,
        wasOverridden: true
      })
    ).toEqual({attendanceAttended: null, attendanceTotal: null});
  });
});
