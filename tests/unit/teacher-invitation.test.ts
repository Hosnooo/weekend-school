import {describe, expect, it} from 'vitest';

import {inviteTeacher, resendTeacherAccess, type TeacherInvitationDependencies} from '@/features/teachers/teacher.service';

const input = {
  schoolId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Fatima Ali',
  email: 'fatima@example.com',
  preferredLanguage: 'ar' as const,
  assignedGroupIds: ['22222222-2222-4222-8222-222222222222']
};

function createFakeDependencies() {
  const state = {authUsers: [] as string[], profiles: [] as string[]};
  const dependencies: TeacherInvitationDependencies = {
    async validateAssignments() {},
    async inviteAuthUser() {
      state.authUsers.push('auth-1');
      return 'auth-1';
    },
    async createProfile() {
      state.profiles.push('profile-1');
      return 'profile-1';
    },
    async assignGroups() {},
    async deleteProfile(profileId) {
      state.profiles = state.profiles.filter((id) => id !== profileId);
    },
    async deleteAuthUser(authUserId) {
      state.authUsers = state.authUsers.filter((id) => id !== authUserId);
    },
    async findUnclaimedAuthUser() { return null; },
    async sendExistingAccessLink() {}
  };
  return {state, dependencies};
}

describe('teacher invitation', () => {
  it('resends access to the existing school teacher identity without creating an account', async () => {
    const sent: string[] = [];
    await resendTeacherAccess('profile-1', input.schoolId, {
      async findTeacher(profileId, schoolId) {
        expect([profileId, schoolId]).toEqual(['profile-1', input.schoolId]);
        return {authUserId: 'auth-1', preferredLanguage: 'ar'};
      },
      async getAuthEmail(authUserId) {
        expect(authUserId).toBe('auth-1');
        return input.email;
      },
      async sendAccessLink(email, language) { sent.push(`${email}:${language}`); }
    });
    expect(sent).toEqual(['fatima@example.com:ar']);
  });

  it('does not send an access link for another school or a missing Auth identity', async () => {
    const sendAccessLink = async () => {throw new Error('must not send');};
    await expect(resendTeacherAccess('profile-1', input.schoolId, {
      async findTeacher() { return null; }, async getAuthEmail() { return input.email; }, sendAccessLink
    })).rejects.toThrow('Teacher account unavailable');
  });

  it('validates assignments before sending an invitation', async () => {
    const {state, dependencies} = createFakeDependencies();
    dependencies.validateAssignments = async () => {
      throw new Error('assignment unavailable');
    };

    await expect(inviteTeacher(input, dependencies)).rejects.toThrow('assignment unavailable');
    expect(state).toEqual({authUsers: [], profiles: []});
  });

  it('returns the created profile when invitation and assignments succeed', async () => {
    const {state, dependencies} = createFakeDependencies();

    await expect(inviteTeacher(input, dependencies)).resolves.toBe('profile-1');
    expect(state).toEqual({authUsers: ['auth-1'], profiles: ['profile-1']});
  });

  it('removes the invited Auth user when profile creation fails', async () => {
    const {state, dependencies} = createFakeDependencies();
    dependencies.createProfile = async () => {
      throw new Error('profile failed');
    };

    await expect(inviteTeacher(input, dependencies)).rejects.toThrow('profile failed');
    expect(state).toEqual({authUsers: [], profiles: []});
  });

  it('removes both records when group assignment fails', async () => {
    const {state, dependencies} = createFakeDependencies();
    dependencies.assignGroups = async () => {
      throw new Error('assignment failed');
    };

    await expect(inviteTeacher(input, dependencies)).rejects.toThrow('assignment failed');
    expect(state).toEqual({authUsers: [], profiles: []});
  });

  it('reuses a normalized unclaimed Auth identity before calling inviteUserByEmail again', async () => {
    const {state, dependencies} = createFakeDependencies();
    state.authUsers.push('auth-existing');
    let inviteCalls = 0;
    let lookedUpEmail = '';
    dependencies.inviteAuthUser = async () => {
      inviteCalls += 1;
      throw new Error('email_exists');
    };
    dependencies.findUnclaimedAuthUser = async (email) => {
      lookedUpEmail = email;
      return 'auth-existing';
    };
    dependencies.sendExistingAccessLink = async () => {};

    await expect(inviteTeacher({...input, email: '  Fatima@Example.COM  '}, dependencies)).resolves.toBe('profile-1');
    expect(inviteCalls).toBe(0);
    expect(lookedUpEmail).toBe('fatima@example.com');
    expect(state).toEqual({authUsers: ['auth-existing'], profiles: ['profile-1']});
  });

  it('reconciles an existing unclaimed Auth identity without deleting it', async () => {
    const {state, dependencies} = createFakeDependencies();
    state.authUsers.push('auth-existing');
    dependencies.inviteAuthUser = async () => {throw new Error('already registered');};
    dependencies.findUnclaimedAuthUser = async () => 'auth-existing';
    dependencies.sendExistingAccessLink = async () => {};
    await expect(inviteTeacher(input, dependencies)).resolves.toBe('profile-1');
    expect(state).toEqual({authUsers: ['auth-existing'], profiles: ['profile-1']});
  });

  it('keeps an existing Auth identity if profile creation fails', async () => {
    const {state, dependencies} = createFakeDependencies();
    state.authUsers.push('auth-existing');
    dependencies.inviteAuthUser = async () => {throw new Error('already registered');};
    dependencies.findUnclaimedAuthUser = async () => 'auth-existing';
    dependencies.createProfile = async () => {throw new Error('profile failed');};
    await expect(inviteTeacher(input, dependencies)).rejects.toThrow('profile failed');
    expect(state).toEqual({authUsers: ['auth-existing'], profiles: []});
  });

  it('does not create a second profile for an existing administrator', async () => {
    const {state, dependencies} = createFakeDependencies();
    dependencies.inviteAuthUser = async () => {throw new Error('already registered');};
    dependencies.findUnclaimedAuthUser = async () => {throw new Error('administrator already has an account');};
    await expect(inviteTeacher(input, dependencies)).rejects.toThrow('administrator already has an account');
    expect(state).toEqual({authUsers: [], profiles: []});
  });
});
