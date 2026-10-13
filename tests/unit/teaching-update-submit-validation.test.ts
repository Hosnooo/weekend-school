import {describe, expect, it} from 'vitest';
import {getTeachingUpdateSubmitIssues} from '@/features/teaching-updates/teaching-update-submit-validation';

const a = 'a0000000-0000-0000-0000-000000000001';
const b = 'b0000000-0000-0000-0000-000000000002';
const base = {
  coverageKind: 'RANGE' as const,
  periodStart: '2026-10-10',
  periodEnd: '2026-10-11',
  dates: [],
  today: '2026-10-13',
  roster: [{id: a}, {id: b}],
  attendance: [],
  unsaved: false
};

describe('Teaching Update submission requirements', () => {
  it('identifies the missing attendance field for each student', () => {
    expect(getTeachingUpdateSubmitIssues({
      ...base, attendance: [{studentId: a, attended: 2, total: null}]
    })).toEqual([
      {code: 'missingTotal', studentId: a},
      {code: 'missingBoth', studentId: b}
    ]);
  });
  it('requires positive totals and attended counts not exceeding totals', () => {
    expect(getTeachingUpdateSubmitIssues({
      ...base, attendance: [
        {studentId: a, attended: 0, total: 0},
        {studentId: b, attended: 4, total: 2}
      ]
    })).toEqual([
      {code: 'invalidTotal', studentId: a},
      {code: 'attendedExceedsTotal', studentId: b}
    ]);
  });
  it('reports an invalid total even when attended count is blank', () => {
    expect(getTeachingUpdateSubmitIssues({
      ...base, roster: [{id: a}],
      attendance: [{studentId: a, attended: null, total: 0}]
    })).toEqual([
      {code: 'missingAttended', studentId: a},
      {code: 'invalidTotal', studentId: a}
    ]);
  });

  it('explains missing and future coverage', () => {
    expect(getTeachingUpdateSubmitIssues({
      ...base, coverageKind: 'DATES', dates: [], roster: [],
      periodEnd: '2026-10-14'
    })).toEqual([{code: 'noStudents'}, {code: 'futureCoverage'}, {code: 'noDates'}]);
  });
  it('does not require optional report or student comment text', () => {
    expect(getTeachingUpdateSubmitIssues({
      ...base, attendance: [
        {studentId: a, attended: 1, total: 2},
        {studentId: b, attended: 2, total: 2}
      ]
    })).toEqual([]);
  });
  it('requires saving latest edits before submitting', () => {
    expect(getTeachingUpdateSubmitIssues({...base, unsaved: true})[0])
      .toEqual({code: 'unsaved'});
  });
});
