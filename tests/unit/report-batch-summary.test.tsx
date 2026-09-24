import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {
  ReportBatchSummary,
  summarizeReportBatchReadiness
} from '@/features/reports/report-composer';

const students = [
  {studentId: 'student-ready', hasPersonalizedContent: false, attendanceConflictCount: 0, missingDataCount: 0},
  {studentId: 'student-personalized', hasPersonalizedContent: true, attendanceConflictCount: 0, missingDataCount: 0},
  {studentId: 'student-conflict', hasPersonalizedContent: false, attendanceConflictCount: 1, missingDataCount: 0},
  {studentId: 'student-missing', hasPersonalizedContent: false, attendanceConflictCount: 0, missingDataCount: 2},
  {studentId: 'student-mixed', hasPersonalizedContent: true, attendanceConflictCount: 1, missingDataCount: 1}
];

describe('report batch readiness', () => {
  it('summarizes automatic readiness and overlapping exception categories without opening each student', () => {
    expect(summarizeReportBatchReadiness(students)).toEqual({
      readyAutomatically: 1,
      personalizedComments: 2,
      attendanceConflicts: 2,
      missingData: 2
    });
  });

  it('renders the four actionable batch counts for admin review', () => {
    render(<ReportBatchSummary students={students} />);

    expect(screen.getByText('1 ready automatically')).toBeVisible();
    expect(screen.getByText('2 personalized comments')).toBeVisible();
    expect(screen.getByText('2 attendance conflicts')).toBeVisible();
    expect(screen.getByText('2 missing data')).toBeVisible();
  });
});
