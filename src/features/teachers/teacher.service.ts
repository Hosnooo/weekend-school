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
};

export async function inviteTeacher(
  input: TeacherInvitationInput,
  dependencies: TeacherInvitationDependencies
) {
  await dependencies.validateAssignments(input);
  const authUserId = await dependencies.inviteAuthUser(input);
  let profileId: string | null = null;

  try {
    profileId = await dependencies.createProfile(input, authUserId);
    await dependencies.assignGroups(input.schoolId, profileId, input.assignedGroupIds);
    return profileId;
  } catch (error) {
    if (profileId) {
      try {
        await dependencies.deleteProfile(profileId);
      } catch {
        // Continue cleanup and preserve the operation's original error.
      }
    }

    try {
      await dependencies.deleteAuthUser(authUserId);
    } catch {
      // Cleanup is best effort; server logging belongs in the adapter.
    }

    throw error;
  }
}
