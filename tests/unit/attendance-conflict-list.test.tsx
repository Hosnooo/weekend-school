import {NextIntlClientProvider} from 'next-intl';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import messages from '../../messages/en.json';

vi.mock('@/features/attendance/attendance.actions', () => ({
  resolveAttendanceConflictAction: vi.fn()
}));

import {AttendanceConflictList} from '@/features/attendance/attendance-conflict-list';

const conflict = {
  classSubjectId: '11111111-1111-4111-8111-111111111111',
  subjectGroupId: '22222222-2222-4222-8222-222222222222',
  weekStart: '2026-09-21',
  studentId: '33333333-3333-4333-8333-333333333333',
  studentNameEn: 'Ahmad Ali',
  studentNameAr: 'أحمد علي',
  classNameEn: 'Level 1',
  classNameAr: 'المستوى ١',
  subjectNameEn: 'Quran',
  subjectNameAr: 'القرآن',
  groupNameEn: 'Group A',
  groupNameAr: 'المجموعة أ',
  observations: [
    {teacherId: '44444444-4444-4444-8444-444444444444', teacherName: 'Teacher One', status: 'PRESENT' as const},
    {teacherId: '55555555-5555-4555-8555-555555555555', teacherName: 'Teacher Two', status: 'ABSENT' as const}
  ],
  resolution: null
};

describe('attendance conflict list', () => {
  it('shows both teacher observations and explicit admin resolution choices', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AttendanceConflictList locale="en" conflicts={[conflict]} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Ahmad Ali')).toBeVisible();
    expect(screen.getByText(/Quran/)).toBeVisible();
    expect(screen.getByText(/Teacher One/)).toBeVisible();
    expect(screen.getByText(/Teacher Two/)).toBeVisible();
    expect(screen.getByRole('button', {name: 'Use Present'})).toBeVisible();
    expect(screen.getByRole('button', {name: 'Use Absent'})).toBeVisible();
  });
});
