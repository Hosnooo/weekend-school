import {describe, expect, it, vi} from 'vitest';

import {
  createTeacherBusinessRecord,
  ensureTeacherAccess,
  unlinkTeacherAccess
} from '@/features/teachers/teacher.service';

const schoolId = '11111111-1111-4111-8111-111111111111';
const otherSchoolId = '22222222-2222-4222-8222-222222222222';
const teacherId = '33333333-3333-4333-8333-333333333333';
const profileId = '44444444-4444-4444-8444-444444444444';

const teacherInput = {
  schoolId,
  displayName: 'Mohssen',
  email: 'mohssen.elshaar@gmail.com',
  preferredLanguage: 'en' as const
};

describe('independent Teacher identity', () => {
  it('creates a Teacher business record without inspecting Auth or linking an account', async () => {
    const createTeacher = vi.fn(async () => teacherId);
    const lookupAuthByEmail = vi.fn(async () => ({id: 'auth-admin'}));
    const linkTeacherAccount = vi.fn(async () => undefined);

    const result = await createTeacherBusinessRecord(teacherInput, {
      createTeacher,
      lookupAuthByEmail,
      linkTeacherAccount
    });

    expect(result).toBe(teacherId);
    expect(createTeacher).toHaveBeenCalledWith({
      ...teacherInput,
      email: 'mohssen.elshaar@gmail.com'
    });
    expect(lookupAuthByEmail).not.toHaveBeenCalled();
    expect(linkTeacherAccount).not.toHaveBeenCalled();
  });

  it('allows duplicate Teacher name/email and does not inspect Guardian identity', async () => {
    const createTeacher = vi
      .fn()
      .mockResolvedValueOnce(teacherId)
      .mockResolvedValueOnce('55555555-5555-4555-8555-555555555555');
    const lookupGuardianByEmail = vi.fn(async () => ({id: 'guardian-1'}));

    await createTeacherBusinessRecord(teacherInput, {createTeacher, lookupGuardianByEmail});
    await createTeacherBusinessRecord(teacherInput, {createTeacher, lookupGuardianByEmail});

    expect(createTeacher).toHaveBeenCalledTimes(2);
    expect(lookupGuardianByEmail).not.toHaveBeenCalled();
  });

  it('explicitly links an existing same-school login even when it already has Administrator access', async () => {
    const linkTeacherAccount = vi.fn(async () => undefined);
    const inviteAuthUser = vi.fn(async () => 'new-auth');
    const createProfile = vi.fn(async () => 'new-profile');
    const removeAdministratorAccount = vi.fn(async () => undefined);

    await ensureTeacherAccess({
      schoolId,
      teacherId,
      loginEmail: 'ADMIN@EXAMPLE.TEST',
      redirectTo: 'https://example.test/en/set-password'
    }, {
      async loadTeacher(id, requestedSchoolId) {
        expect([id, requestedSchoolId]).toEqual([teacherId, schoolId]);
        return {id: teacherId, schoolId, displayName: 'Mohssen', preferredLanguage: 'en'};
      },
      async findAuthUserByEmail(email) {
        expect(email).toBe('admin@example.test');
        return {id: 'auth-admin'};
      },
      async findProfileByAuthUserId(authUserId) {
        expect(authUserId).toBe('auth-admin');
        return {id: profileId, schoolId};
      },
      inviteAuthUser,
      createProfile,
      linkTeacherAccount,
      async sendAccessLink() {},
      removeAdministratorAccount
    });

    expect(linkTeacherAccount).toHaveBeenCalledWith({schoolId, teacherId, profileId});
    expect(inviteAuthUser).not.toHaveBeenCalled();
    expect(createProfile).not.toHaveBeenCalled();
    expect(removeAdministratorAccount).not.toHaveBeenCalled();
  });

  it('rejects explicit access linking to a profile from another school', async () => {
    const linkTeacherAccount = vi.fn(async () => undefined);

    await expect(ensureTeacherAccess({
      schoolId,
      teacherId,
      loginEmail: 'teacher@example.test',
      redirectTo: 'https://example.test/en/set-password'
    }, {
      async loadTeacher() {
        return {id: teacherId, schoolId, displayName: 'Mohssen', preferredLanguage: 'en'};
      },
      async findAuthUserByEmail() { return {id: 'auth-other'}; },
      async findProfileByAuthUserId() { return {id: 'profile-other', schoolId: otherSchoolId}; },
      async inviteAuthUser() { throw new Error('must not invite'); },
      async createProfile() { throw new Error('must not create profile'); },
      linkTeacherAccount,
      async sendAccessLink() {}
    })).rejects.toThrow(/school/i);

    expect(linkTeacherAccount).not.toHaveBeenCalled();
  });

  it('unlinking Teacher access preserves the Profile and Administrator capability', async () => {
    const unlinkTeacherAccount = vi.fn(async () => undefined);
    const deleteProfile = vi.fn(async () => undefined);
    const removeAdministratorAccount = vi.fn(async () => undefined);

    await unlinkTeacherAccess({schoolId, teacherId, profileId}, {
      unlinkTeacherAccount,
      deleteProfile,
      removeAdministratorAccount
    });

    expect(unlinkTeacherAccount).toHaveBeenCalledWith({schoolId, teacherId, profileId});
    expect(deleteProfile).not.toHaveBeenCalled();
    expect(removeAdministratorAccount).not.toHaveBeenCalled();
  });
});
