import {describe, expect, it} from 'vitest';

import {selectLatestReportRevisionsByStudent} from '@/features/reports/select-latest-report-revisions';

describe('current Class Report Cycle revisions', () => {
  it('selects only the newer finalized revision for each student', () => {
    const reports = [
      {id: 'older-one', student_id: 'student-1', revision: 1, status: 'DRAFT'},
      {id: 'newer-one', student_id: 'student-1', revision: 2, status: 'READY'},
      {id: 'older-two', student_id: 'student-2', revision: 1, status: 'DRAFT'},
      {id: 'newer-two', student_id: 'student-2', revision: 2, status: 'READY'}
    ];

    const result = selectLatestReportRevisionsByStudent(reports);

    expect(result.map(({id}) => id)).toEqual(['newer-one', 'newer-two']);
    expect(reports).toHaveLength(4); // Older immutable revisions are not deleted.
  });

  it('handles unordered revisions without dropping distinct students', () => {
    const reports = [
      {id: 'student-1-r3', student_id: 'student-1', revision: 3},
      {id: 'student-2-r1', student_id: 'student-2', revision: 1},
      {id: 'student-1-r1', student_id: 'student-1', revision: 1},
      {id: 'student-2-r2', student_id: 'student-2', revision: 2},
      {id: 'student-1-r2', student_id: 'student-1', revision: 2}
    ];

    expect(
      selectLatestReportRevisionsByStudent(reports).map(({id}) => id)
    ).toEqual(['student-1-r3', 'student-2-r2']);
  });

  it('returns an empty selector for a cycle with no finalized reports', () => {
    expect(selectLatestReportRevisionsByStudent([])).toEqual([]);
  });
});
