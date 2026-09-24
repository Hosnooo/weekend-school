import {describe, expect, it} from 'vitest';

import {deriveEffectiveAttendance} from '@/features/attendance/attendance.service';

type AttendanceStatus = 'PRESENT' | 'ABSENT';
type EffectiveAttendance = {
  status: AttendanceStatus | null;
  conflict: boolean;
  resolved: boolean;
  observationCount: number;
};

const derive = deriveEffectiveAttendance as unknown as (
  observations: AttendanceStatus[],
  resolution?: AttendanceStatus | null
) => EffectiveAttendance;

describe('attendance resolution', () => {
  it('uses unanimous PRESENT observations as the official value', () => {
    expect(derive(['PRESENT', 'PRESENT'])).toEqual({
      status: 'PRESENT',
      conflict: false,
      resolved: false,
      observationCount: 2
    });
  });

  it('uses unanimous ABSENT observations as the official value', () => {
    expect(derive(['ABSENT', 'ABSENT'])).toEqual({
      status: 'ABSENT',
      conflict: false,
      resolved: false,
      observationCount: 2
    });
  });

  it('leaves conflicting teacher observations unresolved', () => {
    expect(derive(['PRESENT', 'ABSENT'])).toEqual({
      status: null,
      conflict: true,
      resolved: false,
      observationCount: 2
    });
  });

  it('uses an admin resolution only to settle an underlying conflict', () => {
    expect(derive(['PRESENT', 'ABSENT'], 'PRESENT')).toEqual({
      status: 'PRESENT',
      conflict: true,
      resolved: true,
      observationCount: 2
    });
    expect(derive(['ABSENT'], 'PRESENT')).toEqual({
      status: 'ABSENT',
      conflict: false,
      resolved: false,
      observationCount: 1
    });
  });
});
