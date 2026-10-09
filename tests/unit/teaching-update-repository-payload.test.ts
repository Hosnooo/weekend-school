import {beforeEach, describe, expect, it, vi} from 'vitest';

import {saveTeachingUpdateDraft} from '@/features/teaching-updates/teaching-update.repository';
import type {TeachingUpdateDraftInput} from '@/features/teaching-updates/teaching-update.schemas';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({rpc})
}));

const studentId = 'e0000000-0000-0000-0000-000000000001';

const draft: TeachingUpdateDraftInput = {
  teacherId: 'c0000000-0000-0000-0000-000000000001',
  submissionId: '19000000-0000-0000-0000-000000000001',
  classSubjectId: '13000000-0000-0000-0000-000000000001',
  subjectGroupId: null,
  coverageKind: 'RANGE',
  periodStart: '2026-09-29',
  periodEnd: '2026-09-29',
  dates: [],
  progressEn: 'Covered lesson',
  progressAr: null,
  defaultPerformance: 'GOOD',
  attendance: [{studentId, attended: 4, total: 6}],
  exceptions: [{studentId, performanceOverride: 'EXCELLENT', commentEn: 'Well done', commentAr: null}],
  expectedVersion: 1
};

describe('Teaching Update draft RPC payload', () => {
  beforeEach(() => rpc.mockResolvedValue({data: draft.submissionId, error: null}));

  it('maps attendance and sparse exceptions to PostgreSQL JSON field names', async () => {
    await saveTeachingUpdateDraft(draft);

    expect(rpc).toHaveBeenCalledWith('save_teaching_update_draft', expect.objectContaining({
      p_attendance: [{student_id: studentId, attended: 4, total: 6}],
      p_exceptions: [{
        student_id: studentId,
        performance_override: 'EXCELLENT',
        comment_en: 'Well done',
        comment_ar: null
      }]
    }));
  });
});
