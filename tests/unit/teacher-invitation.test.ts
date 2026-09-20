import {describe, expect, it} from 'vitest';

import {inviteTeacher, type TeacherInvitationDependencies} from '@/features/teachers/teacher.service';

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
    }
  };
  return {state, dependencies};
}

describe('teacher invitation', () => {
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
});
