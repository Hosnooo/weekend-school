export type TeacherInvitationInput = {
  schoolId: string;
  displayName: string;
  email: string;
  preferredLanguage: 'en' | 'ar';
  assignedGroupIds: string[];
};

export type TeacherInvitationDependencies = {
  validateAssignments(input: TeacherInvitationInput): Promise<void>;
  inviteAuthUser(input: TeacherInvitationInput): Promise<string>;
  createProfile(input: TeacherInvitationInput, authUserId: string): Promise<string>;
  assignGroups(
    schoolId: string,
    profileId: string,
    groupIds: string[]
  ): Promise<void>;
  deleteProfile(profileId: string): Promise<void>;
  deleteAuthUser(authUserId: string): Promise<void>;
  findUnclaimedAuthUser(email: string, schoolId: string): Promise<string | null>;
  sendExistingAccessLink(email: string): Promise<void>;
};

export type TeacherAccessDependencies = {
  findTeacher(profileId: string, schoolId: string): Promise<{authUserId: string; preferredLanguage: 'en' | 'ar'} | null>;
  getAuthEmail(authUserId: string): Promise<string | null>;
  sendAccessLink(email: string, language: 'en' | 'ar'): Promise<void>;
};

export async function resendTeacherAccess(profileId: string, schoolId: string, dependencies: TeacherAccessDependencies): Promise<void> {
  const teacher = await dependencies.findTeacher(profileId, schoolId);
  if (!teacher) throw new Error('Teacher account unavailable');
  const email = await dependencies.getAuthEmail(teacher.authUserId);
  if (!email) throw new Error('Teacher account unavailable');
  await dependencies.sendAccessLink(email, teacher.preferredLanguage);
}

export async function inviteTeacher(
  input: TeacherInvitationInput,
  dependencies: TeacherInvitationDependencies
) {
  await dependencies.validateAssignments(input);
  let authUserId: string;
  let newAuthUser = true;
  try {
    authUserId = await dependencies.inviteAuthUser(input);
  } catch (error) {
    const existingAuthUserId = await dependencies.findUnclaimedAuthUser(input.email, input.schoolId);
    if (!existingAuthUserId) throw error;
    authUserId = existingAuthUserId;
    newAuthUser = false;
  }
  let profileId: string | null = null;

  try {
    profileId = await dependencies.createProfile(input, authUserId);
    await dependencies.assignGroups(input.schoolId, profileId, input.assignedGroupIds);
    if (!newAuthUser) await dependencies.sendExistingAccessLink(input.email);
    return profileId;
  } catch (error) {
    if (profileId) {
      try {
        await dependencies.deleteProfile(profileId);
      } catch {
        // Continue cleanup and preserve the operation's original error.
      }
    }

    if (newAuthUser) {
      try {
        await dependencies.deleteAuthUser(authUserId);
      } catch {
        // Cleanup is best effort; server logging belongs in the adapter.
      }
    }

    throw error;
  }
}
