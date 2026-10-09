import {describe, expect, it, vi} from 'vitest';
import {ensureTeacherAccess} from '@/features/teachers/teacher.service';
import {ensureAdministratorAccess, setAdministratorActiveSafely} from '@/features/administrators/administrator.service';
import {accountAccessError} from '@/features/auth/account-access-error';

const schoolId = '10000000-0000-4000-8000-000000000001';
const teacherId = '20000000-0000-4000-8000-000000000001';
const administratorId = '30000000-0000-4000-8000-000000000001';
const redirectTo = 'https://example.test/en/set-password';

function teacherDependencies() {
  return {
    loadTeacher: vi.fn(async () => ({id: teacherId, schoolId, displayName: 'Test Teacher',preferredLanguage:'en' as const})),
    findAuthUserByEmail: vi.fn(async (): Promise<{id:string}|null> => null),
    findProfileByAuthUserId: vi.fn(async (): Promise<{id:string; schoolId:string}|null> => null),
    inviteAuthUser: vi.fn(async () => 'test-auth'),
    createProfile: vi.fn(async () => 'test-profile'),
    linkTeacherAccount: vi.fn(async () => {}),
    sendAccessLink: vi.fn(async () => {}),
    deleteProfile: vi.fn(async () => {}),
    deleteAuthUser: vi.fn(async () => {})
  };
}

function administratorDependencies() {
  return {
    loadAdministrator: vi.fn(async () => ({id: administratorId, schoolId, displayName:'Test Admin'})),
    findAuthUserByEmail: vi.fn(async (): Promise<{id:string}|null> => null),
    findProfileByAuthUserId: vi.fn(async (): Promise<{id:string; schoolId:string; isActive?:boolean}|null> => null),
    inviteAuthUser: vi.fn(async () => 'test-auth'),
    createProfile: vi.fn(async () => 'test-profile'),
    linkAdministratorAccount: vi.fn(async () => {}),
    sendAccessLink: vi.fn(async () => {}),
    deleteProfile: vi.fn(async () => {}),
    deleteAuthUser: vi.fn(async () => {})
  };
}

describe('isolated access invitation and rollback scenarios (no emails or Supabase)', () => {
  it('removes newly created Teacher identity and profile if linking fails', async () => {
    const deps=teacherDependencies();
    deps.linkTeacherAccount.mockRejectedValue(new Error('simulated stale assignment'));
    await expect(ensureTeacherAccess({
      schoolId,teacherId,loginEmail:'new@example.test',redirectTo
    }, deps)).rejects.toThrow('simulated stale assignment');
    expect(deps.deleteProfile).toHaveBeenCalledWith('test-profile');
    expect(deps.deleteAuthUser).toHaveBeenCalledWith('test-auth');
    expect(deps.sendAccessLink).not.toHaveBeenCalled();
  });

  it('preserves preexisting Teacher accounts if linking fails', async () => {
    const deps=teacherDependencies();
    deps.findAuthUserByEmail.mockResolvedValue({id:'existing-auth'});
    deps.findProfileByAuthUserId.mockResolvedValue({id:'existing-profile',schoolId});
    deps.linkTeacherAccount.mockRejectedValue(new Error('simulated conflict'));
    await expect(ensureTeacherAccess({
      schoolId,teacherId,loginEmail:'existing@example.test',redirectTo
    }, deps)).rejects.toThrow('simulated conflict');
    expect(deps.deleteProfile).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('rejects cross-school access before changing an account or sending a link', async () => {
    const deps=teacherDependencies();
    deps.findAuthUserByEmail.mockResolvedValue({id:'existing-auth'});
    deps.findProfileByAuthUserId.mockResolvedValue({id:'profile-of-another-school',schoolId:'another-school'});
    await expect(ensureTeacherAccess({
      schoolId,teacherId,loginEmail:'elsewhere@example.test',redirectTo
    }, deps)).rejects.toThrow(/another school/);
    expect(deps.linkTeacherAccount).not.toHaveBeenCalled();
    expect(deps.inviteAuthUser).not.toHaveBeenCalled();
  });

  it('rolls back new Administrator access on a failed link', async () => {
    const deps=administratorDependencies();
    deps.linkAdministratorAccount.mockRejectedValue(new Error('simulated stale record'));
    await expect(ensureAdministratorAccess({
      schoolId,administratorId,loginEmail:'newadmin@example.test',redirectTo
    }, deps)).rejects.toThrow('simulated stale record');
    expect(deps.deleteProfile).toHaveBeenCalledWith('test-profile');
    expect(deps.deleteAuthUser).toHaveBeenCalledWith('test-auth');
  });

  it('blocks reusing an inactive Administrator login', async () => {
    const deps=administratorDependencies();
    deps.findAuthUserByEmail.mockResolvedValue({id:'existing-auth'});
    deps.findProfileByAuthUserId.mockResolvedValue({
      id:'inactive-profile',schoolId,isActive:false
    });
    await expect(ensureAdministratorAccess({
      schoolId,administratorId,loginEmail:'inactive@example.test',redirectTo
    }, deps)).rejects.toThrow(/inactive/);
    expect(deps.linkAdministratorAccount).not.toHaveBeenCalled();
    expect(deps.sendAccessLink).not.toHaveBeenCalled();
  });

  it('does not claim an access link was sent if the provider rejects a resend', async () => {
    const deps=teacherDependencies();
    deps.findAuthUserByEmail.mockResolvedValue({id:'existing-auth'});
    deps.findProfileByAuthUserId.mockResolvedValue({id:'existing-profile',schoolId});
    deps.sendAccessLink.mockRejectedValue(Object.assign(new Error('rate limit reached'),{status:429}));
    await expect(ensureTeacherAccess({
      schoolId,teacherId,loginEmail:'existing@example.test',redirectTo,resendExistingAccess:true
    }, deps)).rejects.toMatchObject({status:429});
    expect(deps.linkTeacherAccount).toHaveBeenCalledOnce();
    expect(accountAccessError({status:429,message:'rate limit reached'})).toBe('rateLimited');
  });

  it('does not deactivate the last administrator even when another stale edit is attempted', async () => {
    const setActive=vi.fn(async () => {});
    await expect(setAdministratorActiveSafely({
      schoolId,administratorId,isActive:false
    },{
      loadAdministrator:async () => ({id:administratorId,schoolId,isActive:true}),
      countActiveAdministrators:async () => 1,
      setAdministratorActive:setActive,
      deleteAdministratorWithAccountLinks:async () => {}
    })).rejects.toThrow(/last active Administrator/);
    expect(setActive).not.toHaveBeenCalled();
  });

  it('classifies missing records, provider limits and unknown errors without exposing messages', () => {
    expect(accountAccessError({status:429,message:'sensitive response'})).toBe('rateLimited');
    expect(accountAccessError(new Error('This login belongs to another school'))).toBe('accountUnavailable');
    expect(accountAccessError(new Error('Administrator is not available in this school'))).toBe('stale');
    expect(accountAccessError({message:'private exception'})).toBe('failed');
  });
});
