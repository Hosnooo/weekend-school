import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

import {teachingUpdateDraftSchema} from '@/features/teaching-updates/teaching-update.schemas';

const base = {
  teacherId: '94f19d34-50f6-40dc-bac8-b52ac4c1f2e4',
  submissionId: 'd1b28621-e850-4a37-a9d8-b17c0f09ce29',
  classSubjectId: '0c93bf3e-6766-4314-a1e7-749cab891e9b',
  subjectGroupId: null,
  coverageKind: 'RANGE' as const,
  periodStart: '2026-10-10',
  periodEnd: '2026-10-11',
  dates: [],
  progressEn: 'Teaching covered',
  progressAr: null,
  defaultPerformance: null,
  exceptions: [],
  expectedVersion: 1
};
const studentId = '72d0f175-79c2-4e8f-ae15-b3f0a12663fa';

describe('Teaching Update draft resilience', () => {
  it('allows an attended count to be saved before a total is entered', () => {
    const result = teachingUpdateDraftSchema.safeParse({
      ...base,
      attendance: [{studentId, attended: 2, total: null}]
    });
    expect(result.success).toBe(true);
  });

  it('allows saving a total before the attended count', () => {
    expect(teachingUpdateDraftSchema.safeParse({
      ...base,
      attendance: [{studentId, attended: null, total: 3}]
    }).success).toBe(true);
  });

  it('rejects impossible complete attendance counts', () => {
    expect(teachingUpdateDraftSchema.safeParse({
      ...base,
      attendance: [{studentId, attended: 5, total: 3}]
    }).success).toBe(false);
  });

  it('supports draft comments without numeric attendance', () => {
    expect(teachingUpdateDraftSchema.safeParse({
      ...base,
      attendance: [],
      exceptions: [{
        studentId,
        performanceOverride: null,
        commentEn: 'Good progress',
        commentAr: null
      }]
    }).success).toBe(true);

    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20261013195247_teaching_update_partial_draft_persistence.sql'),
      'utf8'
    );
    expect(migration).toContain('full outer join exception_items');
    expect(migration).toContain('weekly_submission_students_attendance_pair_chk');
    expect(migration).toContain('student outside the roster');
    expect(migration).toContain('p_expected_version <> target_version');
  });

  it('rechecks completed save actions to update the Saved indicator', () => {
    const editor = readFileSync(
      join(process.cwd(), 'src/features/teaching-updates/teaching-update-editor.tsx'),
      'utf8'
    );
    expect(editor).toContain('}, [state, router]);');
  });
});
