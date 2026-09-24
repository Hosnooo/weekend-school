import {describe, expect, it, vi} from 'vitest';

import {ensureTeacherAccess} from '@/features/teachers/teacher.service';

const schoolId = '11111111-1111-4111-8111-111111111111';
const teacherId = '33333333-3333-4333-8333-333333333333';
const redirectTo = 'https://example.test/en/set-password';

function teacher() {
  return {
    id: teacherId,
    schoolId,
    displayName: 'Fatima Ali',
    preferredLanguage: 'ar' as const
  };
}

describe('explicit Teacher account access', () => {
  it('reuses an existing same-school profile and sends a new access link', async () => {
    const linkTeacherAccount = vi.fn(async () => undefined);
    const sendAccessLink = vi.fn(async () => undefined);
    const createProfile = vi.fn(async () => 'profile-new');
    const inviteAuthUser = vi.fn(async () => 'auth-new');

    await ensureTeacherAccess({
      schoolId,
      teacherId,
      loginEmail: '  FATIMA@EXAMPLE.COM ',
      redirectTo
    }, {
      async loadTeacher() { return teacher(); },
      async findAuthUserByEmail(email) {
        expect(email).toBe('fatima@example.com');
        return {id: 'auth-existing'};
      },
      async findProfileByAuthUserId() { return {id: 'profile-existing', schoolId}; },
      inviteAuthUser,
      createProfile,
      linkTeacherAccount,
      sendAccessLink
    });

    expect(linkTeacherAccount).toHaveBeenCalledWith({schoolId, teacherId, profileId: 'profile-existing'});
    expect(sendAccessLink).toHaveBeenCalledWith('fatima@example.com', redirectTo);
    expect(inviteAuthUser).not.toHaveBeenCalled();
    expect(createProfile).not.toHaveBeenCalled();
  });

  it('creates a same-school profile for an existing Auth identity without one', async () => {
    const linkTeacherAccount = vi.fn(async () => undefined);
    const createProfile = vi.fn(async () => 'profile-created');

    await ensureTeacherAccess({schoolId, teacherId, loginEmail: 'fatima@example.com', redirectTo}, {
      async loadTeacher() { return teacher(); },
      async findAuthUserByEmail() { return {id: 'auth-existing'}; },
      async findProfileByAuthUserId() { return null; },
      async inviteAuthUser() { throw new Error('must not invite'); },
      createProfile,
      linkTeacherAccount,
      async sendAccessLink() {}
    });

    expect(createProfile).toHaveBeenCalledWith({
      schoolId,
      authUserId: 'auth-existing',
      displayName: 'Fatima Ali',
      preferredLanguage: 'ar'
    });
    expect(linkTeacherAccount).toHaveBeenCalledWith({schoolId, teacherId, profileId: 'profile-created'});
  });

  it('invites only when no Auth identity exists, then creates and links the Profile', async () => {
    const inviteAuthUser = vi.fn(async () => 'auth-created');
    const createProfile = vi.fn(async () => 'profile-created');
    const linkTeacherAccount = vi.fn(async () => undefined);
    const sendAccessLink = vi.fn(async () => undefined);

    await ensureTeacherAccess({schoolId, teacherId, loginEmail: 'fatima@example.com', redirectTo}, {
      async loadTeacher() { return teacher(); },
      async findAuthUserByEmail() { return null; },
      async findProfileByAuthUserId() { throw new Error('must not lookup profile'); },
      inviteAuthUser,
      createProfile,
      linkTeacherAccount,
      sendAccessLink
    });

    expect(inviteAuthUser).toHaveBeenCalledWith({
      email: 'fatima@example.com',
      displayName: 'Fatima Ali',
      preferredLanguage: 'ar',
      redirectTo
    });
    expect(createProfile).toHaveBeenCalledWith({
      schoolId,
      authUserId: 'auth-created',
      displayName: 'Fatima Ali',
      preferredLanguage: 'ar'
    });
    expect(linkTeacherAccount).toHaveBeenCalledWith({schoolId, teacherId, profileId: 'profile-created'});
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it('rejects an Auth profile that belongs to another school', async () => {
    const linkTeacherAccount = vi.fn(async () => undefined);
    await expect(ensureTeacherAccess({schoolId, teacherId, loginEmail: 'fatima@example.com', redirectTo}, {
      async loadTeacher() { return teacher(); },
      async findAuthUserByEmail() { return {id: 'auth-other'}; },
      async findProfileByAuthUserId() {
        return {id: 'profile-other', schoolId: '22222222-2222-4222-8222-222222222222'};
      },
      async inviteAuthUser() { throw new Error('must not invite'); },
      async createProfile() { throw new Error('must not create'); },
      linkTeacherAccount,
      async sendAccessLink() {}
    })).rejects.toThrow(/school/i);
    expect(linkTeacherAccount).not.toHaveBeenCalled();
  });

  it('cleans up a newly invited Auth identity if Profile creation fails', async () => {
    const deleteAuthUser = vi.fn(async () => undefined);
    await expect(ensureTeacherAccess({schoolId, teacherId, loginEmail: 'fatima@example.com', redirectTo}, {
      async loadTeacher() { return teacher(); },
      async findAuthUserByEmail() { return null; },
      async findProfileByAuthUserId() { return null; },
      async inviteAuthUser() { return 'auth-created'; },
      async createProfile() { throw new Error('profile failed'); },
      async linkTeacherAccount() { throw new Error('must not link'); },
      async sendAccessLink() {},
      deleteAuthUser
    })).rejects.toThrow('profile failed');
    expect(deleteAuthUser).toHaveBeenCalledWith('auth-created');
  });
});
