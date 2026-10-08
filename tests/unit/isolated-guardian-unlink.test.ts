import {beforeEach, describe, expect, it, vi} from 'vitest';

import {unlinkStudentGuardianAction} from '@/features/guardians/guardian.actions';
import {unlinkGuardianFromStudent} from '@/features/guardians/guardian.repository';
import {requireProfile} from '@/lib/auth/require-profile';
import {revalidatePath} from 'next/cache';

vi.mock('next/cache', () => ({revalidatePath: vi.fn()}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {throw new Error(`redirect to ${path}`);})
}));
vi.mock('@/lib/auth/require-profile', () => ({
  requireProfile: vi.fn()
}));
vi.mock('@/features/guardians/guardian.repository', () => ({
  unlinkGuardianFromStudent: vi.fn()
}));

const studentId = '11111111-1111-4111-8111-111111111111';
const guardianId = '22222222-2222-4222-8222-222222222222';

function formData(guardian = guardianId) {
  const data = new FormData();
  data.set('locale','en');
  data.set('studentId',studentId);
  data.set('guardianId',guardian);
  return data;
}

describe('isolated Student–Guardian unlink error path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireProfile).mockResolvedValue({schoolId: 'test-school'} as never);
  });

  it('returns field-level validation and never touches records for malformed IDs', async () => {
    const result = await unlinkStudentGuardianAction({status:'idle',error:null}, formData('not-a-uuid'));
    expect(result.error).toBe('validation');
    expect(vi.mocked(unlinkGuardianFromStudent)).not.toHaveBeenCalled();
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  it('explains a link removed by another administrator instead of throwing', async () => {
    vi.mocked(unlinkGuardianFromStudent).mockRejectedValue({
      code:'P0002',message:'guardian link not found: private metadata'
    });
    const result = await unlinkStudentGuardianAction({status:'idle',error:null}, formData());
    expect(result).toEqual({status:'error',error:'stale'});
    expect(vi.mocked(unlinkGuardianFromStudent)).toHaveBeenCalledWith(studentId, guardianId);
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private metadata');
  });

  it('leaves the relationship unchanged on permission failure', async () => {
    vi.mocked(unlinkGuardianFromStudent).mockRejectedValue({code:'42501',message:'private RLS error'});
    const result = await unlinkStudentGuardianAction({status:'idle',error:null}, formData());
    expect(result.error).toBe('permission');
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  it('revalidates student and guardian pages only after the database confirms unlinking', async () => {
    vi.mocked(unlinkGuardianFromStudent).mockResolvedValue(undefined);
    const result = await unlinkStudentGuardianAction({status:'idle',error:null}, formData());
    expect(result).toEqual({status:'idle',error:null});
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/en/students/${studentId}`);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/en/guardians/${guardianId}`);
  });
});
