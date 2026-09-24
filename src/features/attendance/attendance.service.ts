import type {EffectiveAttendance, OfficialAttendanceStatus} from './attendance.types';

export function deriveEffectiveAttendance(
  observations: OfficialAttendanceStatus[],
  resolution: OfficialAttendanceStatus | null = null
): EffectiveAttendance {
  const distinct = new Set(observations);
  const conflict = distinct.size > 1;
  const consensus = distinct.size === 1 ? observations[0] : null;
  const resolved = conflict && resolution !== null;

  return {
    status: conflict ? resolution : consensus,
    conflict,
    resolved,
    observationCount: observations.length
  };
}
