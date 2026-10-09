import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('numeric Teacher Teaching Update attendance', () => {
  it('uses two numeric inputs rather than Present / Absent statuses', () => {
    const editor = readFileSync(
      'src/features/teaching-updates/teaching-update-editor.tsx', 'utf8'
    );
    expect(editor).toContain("t('sessionsAttended')");
    expect(editor).toContain("t('sessionsHeld')");
    expect(editor).toContain("t('markAllAttended')");
    expect(editor).toContain("setAttendanceCount(student.id, 'attended'");
    expect(editor).toContain("setAttendanceCount(student.id, 'total'");
    expect(editor).not.toContain('setAttendanceStatus');
    expect(editor).not.toContain('attendanceStatus.PRESENT');
    expect(editor).not.toContain('attendanceStatus.ABSENT');
    expect(editor).not.toContain('markAllPresent');
  });

  it('validates integer attended/total pairs before draft save and submit', () => {
    const schema = readFileSync(
      'src/features/teaching-updates/teaching-update.schemas.ts', 'utf8'
    );
    const editor = readFileSync(
      'src/features/teaching-updates/teaching-update-editor.tsx', 'utf8'
    );
    expect(schema).toContain('attended: z.number().int().min(0)');
    expect(schema).toContain('total: z.number().int().min(0)');
    expect(schema).toContain('value.attended <= value.total');
    expect(editor).toContain('total > 0');
    expect(editor).toContain('attended <= total');
  });

  it('stores attended/total in Teacher RPC without rewriting historical status', () => {
    const repository = readFileSync(
      'src/features/teaching-updates/teaching-update.repository.ts', 'utf8'
    );
    const migration = readFileSync(
      'supabase/migrations/20261009090000_numeric_teacher_attendance.sql', 'utf8'
    );
    expect(repository).toContain('attendance_attended,attendance_total');
    expect(repository).toContain('attended: row.attendance_attended');
    expect(repository).toContain('legacyStatus: row.attendance_status');
    expect(migration).toContain("attendance_format = 'NUMERIC'");
    expect(migration).toContain('null::public.attendance_status');
    expect(migration).toContain('attendance_attended <= attendance_total');
  });
});
