import {describe, expect, it, vi} from 'vitest';

async function loadAttendanceService() {
  try {
    return await vi.importActual<Record<string, unknown>>('@/features/attendance/attendance.service');
  } catch {
    return null;
  }
}

describe('attendance resolution', () => {
  it('provides the effective-attendance resolver used by official attendance', async () => {
    const service = await loadAttendanceService();

    expect(service).not.toBeNull();
    if (!service) return;
    expect(service.deriveEffectiveAttendance).toBeTypeOf('function');
  });
});
