export type OfficialAttendanceStatus = 'PRESENT' | 'ABSENT';

export type EffectiveAttendance = {
  status: OfficialAttendanceStatus | null;
  conflict: boolean;
  resolved: boolean;
  observationCount: number;
};
